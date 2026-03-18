const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const { generateOTP, storeOTP, validateOTP } = require('../utils/otpHelper');
const { sendSMS } = require('../services/smsService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_EXPIRY = '1h';
const REFRESH_EXPIRY = '7d';

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

async function registerCustomer(req, res) {
  try {
    const { full_name, email, phone, password } = req.body;
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({ error: 'full_name, email, phone and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, user_type)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, full_name, email, phone, user_type, is_verified, created_at`,
      [full_name, email, phone, passwordHash]
    );
    const user = result.rows[0];
    const otp = generateOTP();
    await storeOTP(user.id, phone, otp, 'verify_phone');
    await sendSMS(phone, `Your SwiftDrop verification code is: ${otp}. Valid for 10 minutes.`);
    return res.status(201).json({
      message: 'Registration successful. Please verify your phone with the OTP sent.',
      user: sanitizeUser(user),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or phone already registered' });
    }
    console.error('registerCustomer:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

async function registerDriver(req, res) {
  try {
    const { full_name, email, phone, password } = req.body;
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({ error: 'full_name, email, phone and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, user_type)
         VALUES ($1, $2, $3, $4, 'driver')
         RETURNING id, full_name, email, phone, user_type, is_verified, created_at`,
        [full_name, email, phone, passwordHash]
      );
      const user = userResult.rows[0];
      await client.query(
        `INSERT INTO driver_profiles (user_id, verification_status) VALUES ($1, 'pending')`,
        [user.id]
      );
      await client.query(
        `INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed) VALUES ($1, 'new', 0)`,
        [user.id]
      );
      await client.query('COMMIT');
      return res.status(201).json({
        message: 'Driver registration successful. Upload documents to complete verification.',
        user: sanitizeUser(user),
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or phone already registered' });
    }
    console.error('registerDriver:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

async function verifyPhone(req, res) {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'phone and otp are required' });
    }

    const userId = await validateOTP(phone, otp, 'verify_phone');
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await db.query(
      `UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    const userResult = await db.query(
      `SELECT id, full_name, email, phone, user_type, is_verified, profile_photo_url, wallet_balance
       FROM users WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    const accessToken = jwt.sign(
      { userId: user.id, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    return res.json({
      token: accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('verifyPhone:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
}

async function login(req, res) {
  try {
    const { email, phone, password } = req.body;
    const identifier = email || phone;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'email or phone, and password are required' });
    }

    const userResult = await db.query(
      `SELECT * FROM users
       WHERE (email = $1 OR phone = $1)
         AND is_active = true
         AND is_verified = true`,
      [identifier]
    );
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials or phone not verified' });
    }

    let extra = {};
    if (user.user_type === 'driver') {
      const profile = await db.query(
        `SELECT verification_status FROM driver_profiles WHERE user_id = $1`,
        [user.id]
      );
      extra.verification_status = profile.rows[0]?.verification_status || 'pending';
    }

    const accessToken = jwt.sign(
      { userId: user.id, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );

    return res.json({
      token: accessToken,
      refreshToken,
      user: { ...sanitizeUser(user), ...extra },
    });
  } catch (err) {
    console.error('login:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const userResult = await db.query(
      `SELECT id, phone FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.json({ message: 'If an account exists, a reset code has been sent.' });
    }

    const otp = generateOTP();
    await storeOTP(user.id, user.phone, otp, 'reset_password');
    await sendSMS(user.phone, `Your SwiftDrop password reset code is: ${otp}. Valid for 10 minutes.`);
    return res.json({ message: 'If an account exists, a reset code has been sent.' });
  } catch (err) {
    console.error('forgotPassword:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

async function resetPassword(req, res) {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'phone, otp and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const userId = await validateOTP(phone, otp, 'reset_password');
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );
    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('resetPassword:', err);
    return res.status(500).json({ error: 'Reset failed' });
  }
}

async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userResult = await db.query(
      `SELECT id, full_name, email, phone, user_type, is_verified, profile_photo_url, wallet_balance
       FROM users
       WHERE id = $1 AND is_active = true AND is_verified = true`,
      [decoded.userId]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    return res.json({
      token: accessToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    console.error('refreshToken:', err);
    return res.status(500).json({ error: 'Refresh failed' });
  }
}

module.exports = {
  registerCustomer,
  registerDriver,
  verifyPhone,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const { generateOTP, storeOTP, validateOTP } = require('../utils/otpHelper');
const { sendSMS } = require('../services/smsService');
const { normalizeSouthAfricaToE164 } = require('../utils/phoneNormalize');

function normalizeEmailForDb(email) {
  return String(email ?? '').trim().toLowerCase();
}

/** PostgreSQL unique_violation: tell user whether email or phone collided. */
function duplicateRegistrationMessage(err) {
  const c = (err.constraint || '').toLowerCase();
  const d = (err.detail || '').toLowerCase();
  if (c.includes('email') || d.includes('(email)')) {
    return 'This email is already registered';
  }
  if (c.includes('phone') || d.includes('(phone)')) {
    return 'This phone number is already registered';
  }
  return 'Email or phone already registered';
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_EXPIRY = '1h';
const REFRESH_EXPIRY = '7d';

/** If false, login/refresh work without phone OTP verification (testing only). Default: true. */
function requirePhoneVerificationForAuth() {
  const v = process.env.REQUIRE_PHONE_VERIFICATION;
  if (v === undefined || v === null || String(v).trim() === '') return true;
  const lowered = String(v).trim().toLowerCase();
  if (lowered === 'false' || lowered === '0' || lowered === 'no') return false;
  return true;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

async function registerCustomer(req, res) {
  try {
    const { full_name, email, phone, password } = req.body;
    if (!full_name || !phone || !password) {
      return res.status(400).json({ error: 'full_name, phone and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const phoneNorm = normalizeSouthAfricaToE164(phone);
    if (!phoneNorm) {
      return res.status(400).json({
        error: 'Invalid phone number. Use a South African mobile (e.g. 082… or 82… after +27).',
      });
    }

    let emailNorm;
    if (email != null && String(email).trim() !== '') {
      emailNorm = normalizeEmailForDb(email);
      if (!emailNorm) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
    } else {
      emailNorm = `phone_${phoneNorm.replace(/\D/g, '')}@customer.swiftdrop.app`;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, user_type)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, full_name, email, phone, user_type, is_verified, created_at`,
      [full_name, emailNorm, phoneNorm, passwordHash]
    );
    const user = result.rows[0];

    // Testing / relaxed mode: skip OTP SMS and return tokens so the client can go straight in.
    if (!requirePhoneVerificationForAuth()) {
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
      return res.status(201).json({
        message: 'Registration successful.',
        user: sanitizeUser(user),
        phoneVerificationRequired: false,
        token: accessToken,
        refreshToken,
      });
    }

    const otp = generateOTP();
    await storeOTP(user.id, phoneNorm, otp, 'verify_phone');
    await sendSMS(phoneNorm, `Your SwiftDrop verification code is: ${otp}. Valid for 10 minutes.`);
    return res.status(201).json({
      message: 'Registration successful. Please verify your phone with the OTP sent.',
      user: sanitizeUser(user),
      phoneVerificationRequired: true,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: duplicateRegistrationMessage(err) });
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

    const emailNorm = normalizeEmailForDb(email);
    const phoneNorm = normalizeSouthAfricaToE164(phone);
    if (!emailNorm) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (!phoneNorm) {
      return res.status(400).json({
        error: 'Invalid phone number. Use a South African mobile (e.g. 082… or 82… after +27).',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, user_type)
         VALUES ($1, $2, $3, $4, 'driver')
         RETURNING id, full_name, email, phone, user_type, is_verified, created_at`,
        [full_name, emailNorm, phoneNorm, passwordHash]
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
      
      // Testing / relaxed mode: skip OTP and return tokens.
      if (!requirePhoneVerificationForAuth()) {
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

        return res.status(201).json({
          message: 'Driver registration successful.',
          user: sanitizeUser(user),
          phoneVerificationRequired: false,
          token: accessToken,
          refreshToken,
        });
      }

      const otp = generateOTP();
      await storeOTP(user.id, phoneNorm, otp, 'verify_phone');
      await sendSMS(phoneNorm, `Your SwiftDrop verification code is: ${otp}. Valid for 10 minutes.`);

      return res.status(201).json({
        message: 'Driver registration successful. Please verify your phone with the OTP sent.',
        user: sanitizeUser(user),
        phoneVerificationRequired: true,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: duplicateRegistrationMessage(err) });
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

    const phoneNorm = normalizeSouthAfricaToE164(phone);
    if (!phoneNorm) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const userId = await validateOTP(phoneNorm, otp, 'verify_phone');
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

    const verifiedSql = requirePhoneVerificationForAuth() ? 'AND is_verified = true' : '';
    const trimmedId = String(identifier).trim();
    const isEmailLogin = trimmedId.includes('@');

    let userResult;
    if (isEmailLogin) {
      const emailNorm = normalizeEmailForDb(trimmedId);
      userResult = await db.query(
        `SELECT * FROM users
         WHERE LOWER(TRIM(email)) = $1
           AND is_active = true
           ${verifiedSql}`,
        [emailNorm]
      );
    } else {
      const phoneNorm = normalizeSouthAfricaToE164(trimmedId);
      const variants = [...new Set([trimmedId, phoneNorm].filter(Boolean))];
      userResult = await db.query(
        `SELECT * FROM users
         WHERE phone = ANY($1::text[])
           AND is_active = true
           ${verifiedSql}`,
        [variants]
      );
    }
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      const msg = requirePhoneVerificationForAuth()
        ? 'Invalid credentials or phone not verified'
        : 'Invalid credentials';
      return res.status(401).json({ error: msg });
    }

    let extra = {};
    if (user.user_type === 'driver') {
      const profile = await db.query(
        `SELECT verification_status FROM driver_profiles WHERE user_id = $1`,
        [user.id]
      );
      const verificationStatus = profile.rows[0]?.verification_status || 'pending';
      extra.verification_status = verificationStatus;

      // Drivers can only log in after admin approval.
      if (verificationStatus !== 'approved') {
        return res.status(403).json({
          error: 'Driver account is under review. Please try again later.',
          verification_status: verificationStatus,
        });
      }
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
    const { email, phone } = req.body;

    let user = null;

    if (phone) {
      const phoneNorm = normalizeSouthAfricaToE164(phone);
      if (!phoneNorm) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }
      const userResult = await db.query(
        `SELECT id, phone FROM users WHERE phone = $1 AND is_active = true`,
        [phoneNorm]
      );
      user = userResult.rows[0];
    } else if (email) {
      const emailNorm = normalizeEmailForDb(email);
      const userResult = await db.query(
        `SELECT id, phone FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
        [emailNorm]
      );
      user = userResult.rows[0];
    } else {
      return res.status(400).json({ error: 'email or phone is required' });
    }

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

    const phoneNorm = normalizeSouthAfricaToE164(phone);
    if (!phoneNorm) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const userId = await validateOTP(phoneNorm, otp, 'reset_password');
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

    const verifiedSql = requirePhoneVerificationForAuth() ? 'AND is_verified = true' : '';
    const userResult = await db.query(
      `SELECT id, full_name, email, phone, user_type, is_verified, profile_photo_url, wallet_balance
       FROM users
       WHERE id = $1 AND is_active = true ${verifiedSql}`,
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

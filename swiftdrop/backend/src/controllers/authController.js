const db = require('../database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const smsService = require('../services/smsService');
const { uploadImage } = require('../services/cloudinaryService');
const { generateOTP, storeOTP, validateOTP } = require('../utils/otpHelper');
const { normalizeSouthAfricaToE164 } = require('../utils/phoneNormalize');

function signTokens(user) {
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign(
    { id: user.id, user_type: user.user_type, email: user.email },
    secret,
    { expiresIn: '7d' }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    secret,
    { expiresIn: '30d' }
  );
  return { token, refreshToken };
}

function buildUserPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    firebase_uid: row.firebase_uid || null,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    user_type: row.user_type,
    role: row.app_role || (row.user_type === 'customer' ? 'sender' : row.user_type),
    profile_complete: Boolean(row.profile_completed),
    default_pickup_address: row.default_pickup_address || null,
    is_verified: row.is_verified,
    is_active: row.is_active,
    profile_photo_url: row.profile_photo_url || null,
    wallet_balance: row.wallet_balance,
  };
}

async function getMe(req, res) {
  const user = buildUserPayload(req.user);
  return res.json({
    user,
    role: user?.role ?? null,
    profileComplete: user?.profile_complete ?? false,
  });
}

async function register(req, res) {
  const firebaseUid = req.firebaseUser?.uid;
  const firebaseEmail = req.firebaseUser?.email ? String(req.firebaseUser.email).trim().toLowerCase() : '';
  const fullName = String(req.body?.name || req.body?.full_name || req.firebaseUser?.name || '').trim();
  const normalizedPhone = normalizeSouthAfricaToE164(req.body?.phone);

  if (!firebaseUid || !firebaseEmail) {
    return res.status(400).json({ error: 'Firebase account must include an email address' });
  }
  if (!fullName) {
    return res.status(400).json({ error: 'full_name is required' });
  }
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'A valid South African phone number is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT id, firebase_uid, app_role, profile_completed, default_pickup_address,
              full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance
       FROM users
       WHERE firebase_uid = $1
          OR LOWER(email) = $2
          OR phone = $3
       ORDER BY CASE WHEN firebase_uid = $1 THEN 0 WHEN LOWER(email) = $2 THEN 1 ELSE 2 END
       LIMIT 1
       FOR UPDATE`,
      [firebaseUid, firebaseEmail, normalizedPhone]
    );

    let user;
    if (existingRes.rows[0]) {
      const updated = await client.query(
        `UPDATE users
         SET firebase_uid = $1,
             email = $2,
             phone = $3,
             full_name = $4,
             user_type = CASE WHEN user_type = 'admin' THEN user_type ELSE 'customer' END,
             app_role = COALESCE(app_role, NULL),
             profile_completed = COALESCE(profile_completed, false),
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, firebase_uid, app_role, profile_completed, default_pickup_address,
                   full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance`,
        [firebaseUid, firebaseEmail, normalizedPhone, fullName, existingRes.rows[0].id]
      );
      user = updated.rows[0];
    } else {
      const inserted = await client.query(
        `INSERT INTO users (
           firebase_uid,
           email,
           phone,
           password_hash,
           full_name,
           user_type,
           app_role,
           profile_completed,
           is_verified,
           is_active
         )
         VALUES ($1, $2, $3, $4, $5, 'customer', NULL, false, false, true)
         RETURNING id, firebase_uid, app_role, profile_completed, default_pickup_address,
                   full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance`,
        [firebaseUid, firebaseEmail, normalizedPhone, 'firebase-auth', fullName]
      );
      user = inserted.rows[0];
    }

    await client.query('COMMIT');
    return res.status(existingRes.rows[0] ? 200 : 201).json({ user: buildUserPayload(user) });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to register profile' });
  } finally {
    client.release();
  }
}

async function setRole(req, res) {
  if (!req.user) {
    return res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
  }
  const role = String(req.body?.role || '').trim().toLowerCase();
  if (!['sender', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'role must be sender or driver' });
  }
  const userType = role === 'driver' ? 'driver' : 'customer';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const updatedUser = await client.query(
      `UPDATE users
       SET app_role = $1,
           user_type = CASE WHEN user_type = 'admin' THEN user_type ELSE $2 END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, firebase_uid, app_role, profile_completed, default_pickup_address,
                 full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance`,
      [role, userType, req.user.id]
    );

    if (role === 'driver') {
      const existingDriverProfile = await client.query(
        `SELECT id FROM driver_profiles WHERE user_id = $1 LIMIT 1`,
        [req.user.id]
      );
      if (existingDriverProfile.rows.length === 0) {
        await client.query(
          `INSERT INTO driver_profiles (user_id, verification_status)
           VALUES ($1, 'pending')`,
          [req.user.id]
        );
      }
    }

    await client.query('COMMIT');
    return res.json({ user: buildUserPayload(updatedUser.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to save role' });
  } finally {
    client.release();
  }
}

async function completeProfile(req, res) {
  if (!req.user) {
    return res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
  }

  const role = req.user.app_role || (req.user.user_type === 'driver' ? 'driver' : 'sender');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (role === 'driver') {
      const idNumber = String(req.body?.idNumber || '').trim();
      const vehicleType = String(req.body?.vehicleType || '').trim();
      const vehicleReg = String(req.body?.vehicleReg || '').trim().toUpperCase();
      if (!idNumber || !vehicleType || !vehicleReg) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'idNumber, vehicleType and vehicleReg are required' });
      }
      await client.query(
        `UPDATE users
         SET sa_id_number = $1,
             profile_completed = true,
             updated_at = NOW()
         WHERE id = $2`,
        [idNumber, req.user.id]
      );
      await client.query(
        `UPDATE driver_profiles
         SET vehicle_make = $1,
             vehicle_plate = $2
         WHERE user_id = $3`,
        [vehicleType, vehicleReg, req.user.id]
      );
    } else {
      const defaultAddress = String(req.body?.defaultAddress || '').trim();
      if (!defaultAddress) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'defaultAddress is required' });
      }
      await client.query(
        `UPDATE users
         SET default_pickup_address = $1,
             profile_completed = true,
             updated_at = NOW()
         WHERE id = $2`,
        [defaultAddress, req.user.id]
      );
    }

    const result = await client.query(
      `SELECT id, firebase_uid, app_role, profile_completed, default_pickup_address,
              full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    await client.query('COMMIT');
    return res.json({ user: buildUserPayload(result.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to complete profile' });
  } finally {
    client.release();
  }
}

async function requestPhoneVerification(req, res) {
  if (!req.user) {
    return res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
  }
  if (!req.user.phone) {
    return res.status(400).json({ error: 'Phone number required before verification' });
  }

  const code = generateOTP();
  await storeOTP(req.user.id, req.user.phone, code, 'phone_verification');
  const smsResult = await smsService.sendOTP(req.user.phone, code);
  if (!smsResult.ok) {
    return res.status(503).json({ error: 'Failed to send OTP', code: 'OTP_SEND_FAILED' });
  }
  return res.json({ ok: true });
}

async function verifyPhone(req, res) {
  if (!req.user) {
    return res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
  }
  const { code, otp } = req.body || {};
  const verificationCode = String(code || otp || '').trim();
  if (!verificationCode) {
    return res.status(400).json({ error: 'code or otp is required' });
  }
  const verifiedUserId = await validateOTP(req.user.phone, verificationCode, 'phone_verification');
  if (!verifiedUserId || Number(verifiedUserId) !== Number(req.user.id)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  const result = await db.query(
    `UPDATE users
     SET is_verified = true,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, firebase_uid, app_role, profile_completed, default_pickup_address,
               full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance`,
    [req.user.id]
  );
  const userRow = result.rows[0];
  const { token, refreshToken } = signTokens(userRow);
  return res.json({ token, refreshToken, user: buildUserPayload(userRow) });
}

async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const result = await db.query(
      `SELECT id, firebase_uid, app_role, profile_completed, default_pickup_address,
              full_name, email, phone, user_type, is_verified, is_active,
              profile_photo_url, wallet_balance, password_hash
       FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.password_hash || user.password_hash === 'firebase-auth') {
      return res.status(401).json({ error: 'This account uses a different sign-in method' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { token, refreshToken } = signTokens(user);
    return res.json({ token, refreshToken, user: buildUserPayload(user) });
  } catch (err) {
    console.error('login:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

async function registerCustomer(req, res) {
  const full_name = String(req.body?.full_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const rawPhone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!full_name || !email || !rawPhone || !password) {
    return res.status(400).json({ error: 'full_name, email, phone and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const phone = normalizeSouthAfricaToE164(rawPhone);
  if (!phone) {
    return res.status(400).json({ error: 'A valid South African phone number is required' });
  }

  const client = await db.pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1`,
      [email, phone]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'An account with this email or phone already exists' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const inserted = await client.query(
      `INSERT INTO users
         (full_name, email, phone, password_hash, user_type, app_role,
          profile_completed, is_verified, is_active, wallet_balance)
       VALUES ($1, $2, $3, $4, 'customer', 'sender', false, false, true, 0)
       RETURNING id, firebase_uid, app_role, profile_completed, default_pickup_address,
                 full_name, email, phone, user_type, is_verified, is_active,
                 profile_photo_url, wallet_balance`,
      [full_name, email, phone, password_hash]
    );
    const user = inserted.rows[0];
    const { token, refreshToken } = signTokens(user);
    return res.status(201).json({
      token,
      refreshToken,
      user: buildUserPayload(user),
      phoneVerificationRequired: false,
    });
  } catch (err) {
    console.error('registerCustomer:', err);
    return res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
}

function mergeDriverVerificationNotes(existingRaw, patch) {
  let base = {};
  if (existingRaw && typeof existingRaw === 'string') {
    try {
      const j = JSON.parse(existingRaw);
      if (typeof j === 'object' && j !== null) base = j;
    } catch {
      base = {};
    }
  }
  return JSON.stringify({ ...base, ...patch });
}

function pickUploadedFile(files, fieldname) {
  if (!files || !Array.isArray(files)) return null;
  return files.find((f) => f.fieldname === fieldname) || null;
}

async function uploadFieldToUrl(files, fieldname) {
  const f = pickUploadedFile(files, fieldname);
  if (!f || !f.buffer) return null;
  const r = await uploadImage(f);
  return r.secure_url || null;
}

/** POST /api/auth/register-driver — email/password driver signup */
async function registerDriver(req, res) {
  const full_name = String(req.body?.full_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const rawPhone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!full_name || !email || !rawPhone || !password) {
    return res.status(400).json({ error: 'Name, email, phone and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const phone = normalizeSouthAfricaToE164(rawPhone);
  if (!phone) {
    return res.status(400).json({ error: 'A valid South African phone number is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 OR phone = $2 LIMIT 1`,
      [email, phone]
    );
    if (existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Account already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const inserted = await client.query(
      `INSERT INTO users (
         full_name, email, phone, password_hash, user_type, app_role,
         profile_completed, is_verified, is_active, wallet_balance
       )
       VALUES ($1, $2, $3, $4, 'driver', 'driver', false, true, true, 0)
       RETURNING id, firebase_uid, app_role, profile_completed, default_pickup_address,
                 full_name, email, phone, user_type, is_verified, is_active,
                 profile_photo_url, wallet_balance`,
      [full_name, email, phone, password_hash]
    );
    const user = inserted.rows[0];

    const prof = await client.query(`SELECT id FROM driver_profiles WHERE user_id = $1 LIMIT 1`, [user.id]);
    if (prof.rows.length === 0) {
      await client.query(
        `INSERT INTO driver_profiles (user_id, verification_status)
         VALUES ($1, 'pending')`,
        [user.id]
      );
    }

    await client.query('COMMIT');

    const { token, refreshToken } = signTokens(user);
    return res.status(201).json({
      token,
      refreshToken,
      user: buildUserPayload(user),
      phoneVerificationRequired: false,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('registerDriver:', err);
    return res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
}

/** POST /api/auth/driver/submit-application — multipart; requires driver JWT */
async function submitDriverApplication(req, res) {
  if (!req.user || req.user.user_type !== 'driver') {
    return res.status(403).json({ error: 'Driver account required' });
  }

  const application_path = String(req.body?.application_path || '').trim();
  if (!application_path || !['uber_bolt', 'new_driver'].includes(application_path)) {
    return res.status(400).json({ error: 'application_path must be uber_bolt or new_driver' });
  }

  const files = req.files;
  const vehicle_make = req.body?.vehicle_make != null ? String(req.body.vehicle_make).trim() : null;
  const vehicle_model = req.body?.vehicle_model != null ? String(req.body.vehicle_model).trim() : null;
  const vehicle_year_raw = req.body?.vehicle_year;
  let vehicle_year = null;
  if (vehicle_year_raw !== undefined && vehicle_year_raw !== null && String(vehicle_year_raw).trim() !== '') {
    const y = parseInt(String(vehicle_year_raw).trim(), 10);
    vehicle_year = Number.isInteger(y) ? y : null;
  }
  const vehicle_color = req.body?.vehicle_color != null ? String(req.body.vehicle_color).trim() : null;
  const vehicle_plate = req.body?.vehicle_plate != null ? String(req.body.vehicle_plate).trim() : null;

  try {
    const selfieUrl = await uploadFieldToUrl(files, 'selfie');
    if (!selfieUrl) {
      return res.status(400).json({ error: 'selfie image is required' });
    }

    let id_document_url = null;
    let license_url = null;
    let vehicle_registration_url = null;
    let license_disc_url = null;
    let saps_clearance_url = null;
    let vehicle_photo_url = null;
    let uber_profile_screenshot_url = null;
    let vehicle_photo_back_url = null;
    let vehicle_photo_side_url = null;

    if (application_path === 'uber_bolt') {
      uber_profile_screenshot_url = await uploadFieldToUrl(files, 'uber_profile_screenshot');
      vehicle_photo_url = await uploadFieldToUrl(files, 'vehicle_photo');
      if (!uber_profile_screenshot_url || !vehicle_photo_url) {
        return res.status(400).json({ error: 'uber_profile_screenshot and vehicle_photo are required' });
      }
    } else {
      id_document_url = await uploadFieldToUrl(files, 'national_id');
      license_url = await uploadFieldToUrl(files, 'drivers_license');
      vehicle_registration_url = await uploadFieldToUrl(files, 'vehicle_registration');
      license_disc_url = await uploadFieldToUrl(files, 'license_disc');
      saps_clearance_url = await uploadFieldToUrl(files, 'saps_clearance');
      const vehicle_front = await uploadFieldToUrl(files, 'vehicle_photo_front');
      vehicle_photo_back_url = await uploadFieldToUrl(files, 'vehicle_photo_back');
      vehicle_photo_side_url = await uploadFieldToUrl(files, 'vehicle_photo_side');
      vehicle_photo_url = vehicle_front;
      if (!id_document_url || !license_url || !vehicle_registration_url || !license_disc_url) {
        return res.status(400).json({ error: 'national_id, drivers_license, vehicle_registration, and license_disc are required' });
      }
      if (!vehicle_photo_url || !vehicle_photo_back_url || !vehicle_photo_side_url) {
        return res.status(400).json({ error: 'vehicle_photo_front, vehicle_photo_back, and vehicle_photo_side are required' });
      }
    }

    const profRes = await db.query(`SELECT verification_notes FROM driver_profiles WHERE user_id = $1 LIMIT 1`, [
      req.user.id,
    ]);
    if (profRes.rows.length === 0) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const notesPatch = {
      application_path,
      uberProfileScreenshotUrl: uber_profile_screenshot_url,
      vehiclePhotoBackUrl: vehicle_photo_back_url,
      vehiclePhotoSideUrl: vehicle_photo_side_url,
      submitted_at: new Date().toISOString(),
    };
    const verification_notes = mergeDriverVerificationNotes(profRes.rows[0].verification_notes, notesPatch);

    await db.query(
      `UPDATE driver_profiles SET
         selfie_url = $1,
         id_document_url = COALESCE($2, id_document_url),
         license_url = COALESCE($3, license_url),
         vehicle_registration_url = COALESCE($4, vehicle_registration_url),
         license_disc_url = COALESCE($5, license_disc_url),
         saps_clearance_url = COALESCE($6, saps_clearance_url),
         vehicle_photo_url = COALESCE($7, vehicle_photo_url),
         vehicle_make = COALESCE($8, vehicle_make),
         vehicle_model = COALESCE($9, vehicle_model),
         vehicle_year = COALESCE($10, vehicle_year),
         vehicle_color = COALESCE($11, vehicle_color),
         vehicle_plate = COALESCE($12, vehicle_plate),
         verification_status = 'pending',
         verification_notes = $13
       WHERE user_id = $14`,
      [
        selfieUrl,
        id_document_url,
        license_url,
        vehicle_registration_url,
        license_disc_url,
        saps_clearance_url,
        vehicle_photo_url,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        vehicle_color,
        vehicle_plate,
        verification_notes,
        req.user.id,
      ]
    );

    return res.json({
      success: true,
      message: 'Application submitted. We will review and contact you.',
    });
  } catch (err) {
    console.error('submitDriverApplication:', err);
    const msg = err.message || 'Application submission failed';
    if (msg.includes('Cloudinary')) {
      return res.status(503).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
}

async function refreshToken(req, res) {
  const rt = String(req.body?.refreshToken || '').trim();
  if (!rt) return res.status(400).json({ error: 'refreshToken is required' });
  try {
    const decoded = jwt.verify(rt, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const result = await db.query(
      `SELECT id, firebase_uid, app_role, profile_completed, default_pickup_address,
              full_name, email, phone, user_type, is_verified, is_active,
              profile_photo_url, wallet_balance
       FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    const { token } = signTokens(user);
    return res.json({ token, user: buildUserPayload(user) });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

module.exports = {
  getMe,
  login,
  register,
  registerCustomer,
  registerDriver,
  submitDriverApplication,
  refreshToken,
  setRole,
  completeProfile,
  bootstrapProfile: register,
  requestPhoneVerification,
  verifyPhone,
};

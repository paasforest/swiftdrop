const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { getAdminAuth } = require('../services/firebaseAdmin');
const { requireJwtSecret } = require('../utils/jwtSecret');

const USER_FIELDS = `id, firebase_uid, app_role, profile_completed, default_pickup_address,
                     full_name, email, phone, user_type, is_verified, is_active,
                     profile_photo_url, wallet_balance`;

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired Firebase token' });
  }
}

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];

  let secret;
  try {
    secret = requireJwtSecret();
  } catch (e) {
    console.error('[auth] JWT_SECRET misconfigured:', e.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 1. Try JWT access token (login / register flows)
  try {
    const decoded = jwt.verify(token, secret);

    if (decoded.type === 'refresh') {
      throw new jwt.JsonWebTokenError('refresh token used as access');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp != null && decoded.exp < nowSec) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    if (decoded.id) {
      const result = await db.query(
        `SELECT ${USER_FIELDS} FROM users WHERE id = $1 LIMIT 1`,
        [decoded.id]
      );
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ error: 'Account not found' });
      }
      if (user.is_active === false) {
        return res.status(403).json({ error: 'Account has been deactivated' });
      }
      if (decoded.user_type && decoded.user_type !== user.user_type) {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      req.user = user;
      return next();
    }

    throw new jwt.JsonWebTokenError('invalid access payload');
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    if (e.name !== 'JsonWebTokenError') {
      console.error('[auth] Unexpected JWT error:', e);
      return res.status(500).json({ error: 'Authentication failed' });
    }
    // Invalid / wrong token type — fall through to Firebase bearer
  }

  // 2. Firebase ID token fallback
  try {
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const firebaseUid = decoded.uid;
    const email = decoded.email ? String(decoded.email).trim().toLowerCase() : null;
    const result = await db.query(
      `SELECT ${USER_FIELDS} FROM users
       WHERE firebase_uid = $1
          OR ($2::text IS NOT NULL AND LOWER(email) = $2)
       ORDER BY CASE WHEN firebase_uid = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [firebaseUid, email]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

module.exports = { auth, verifyFirebaseToken };

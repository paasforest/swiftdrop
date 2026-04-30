const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { getAdminAuth } = require('../services/firebaseAdmin');

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
    return res.status(401).json({ error: 'Authorization token required' });
  }
  const token = authHeader.split(' ')[1];

  // 1. Try our own JWT first (email/password login)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Reject refresh tokens used as access tokens
    if (decoded.id && decoded.type !== 'refresh') {
      const result = await db.query(
        `SELECT ${USER_FIELDS} FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
        [decoded.id]
      );
      const user = result.rows[0];
      if (user) {
        req.user = user;
        return next();
      }
    }
  } catch (_jwtErr) {
    // Not a valid JWT — fall through to Firebase
  }

  // 2. Fall back to Firebase ID token
  try {
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return res.status(401).json({ error: 'Invalid or expired token' });
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
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { auth, verifyFirebaseToken };

const db = require('../database/connection');
const { getAdminAuth } = require('../services/firebaseAdmin');

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
  await verifyFirebaseToken(req, res, async () => {
    try {
      const firebaseUid = req.firebaseUser?.uid;
      const email = req.firebaseUser?.email ? String(req.firebaseUser.email).trim().toLowerCase() : null;
      const result = await db.query(
        `SELECT id, firebase_uid, app_role, profile_completed, default_pickup_address,
                full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance
         FROM users
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
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

module.exports = { auth, verifyFirebaseToken };

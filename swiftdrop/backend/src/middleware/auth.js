const jwt = require('jsonwebtoken');
const db = require('../database/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      `SELECT id, full_name, email, phone, user_type, is_verified, is_active, profile_photo_url, wallet_balance
       FROM users WHERE id = $1`,
      [decoded.userId]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = { auth };

const db = require('../database/connection');

async function registerFcmToken(req, res) {
  try {
    const { fcm_token } = req.body;
    if (fcm_token == null || typeof fcm_token !== 'string' || !fcm_token.trim()) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }
    await db.query(`UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2`, [
      fcm_token.trim(),
      req.user.id,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('registerFcmToken:', err);
    return res.status(500).json({ error: 'Failed to save token' });
  }
}

module.exports = { registerFcmToken };

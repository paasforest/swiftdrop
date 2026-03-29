const db = require('../database/connection');

async function registerFcmToken(req, res) {
  const { fcm_token: fcmToken } = req.body || {};
  if (!fcmToken || typeof fcmToken !== 'string') {
    return res.status(400).json({ error: 'fcm_token is required' });
  }
  const trimmed = fcmToken.trim();
  if (trimmed.length < 20) {
    return res.status(400).json({ error: 'Invalid fcm_token' });
  }

  try {
    await db.query(
      `UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2`,
      [trimmed, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[notifications] registerFcmToken:', err.message);
    return res.status(500).json({ error: 'Failed to save push token' });
  }
}

module.exports = { registerFcmToken };

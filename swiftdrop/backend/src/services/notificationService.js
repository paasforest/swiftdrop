const db = require('../database/connection');

// FCM will be wired in Step 6; for now we log and save to notifications table
async function sendPushNotification(userId, title, body, data = {}) {
  await db.query(
    `INSERT INTO notifications (user_id, title, body, type, data) VALUES ($1, $2, $3, $4, $5)`,
    [userId, title, body, data.type || 'push', JSON.stringify(data)]
  );
  console.log('[Push]', userId, title, body);
}

module.exports = { sendPushNotification };

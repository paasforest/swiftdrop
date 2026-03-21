const db = require('../database/connection');
const { getMessaging } = require('./firebaseAdmin');

/**
 * FCM `data` payload must use string values for all keys.
 */
function stringifyDataPayload(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

async function insertNotificationRow(userId, title, body, data) {
  const type = (data && data.type) || 'push';
  try {
    await db.query(
      `INSERT INTO notifications (user_id, title, body, type, data) VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, body, type, JSON.stringify(data || {})]
    );
  } catch (e) {
    console.error('[notifications] DB insert failed:', e.message);
  }
}

/**
 * Sends a push via FCM. Always attempts insert into `notifications` table.
 * Does not throw on DB or FCM failure.
 */
async function sendPushNotification(userId, title, body, data = {}) {
  await insertNotificationRow(userId, title, body, data);

  let token = null;
  try {
    const r = await db.query(`SELECT fcm_token FROM users WHERE id = $1`, [userId]);
    token = r.rows[0]?.fcm_token || null;
  } catch (e) {
    console.error('[FCM] Failed to load token:', e.message);
    return;
  }

  if (!token) {
    console.warn(`[FCM] No fcm_token for user ${userId}; notification stored only.`);
    return;
  }

  const messaging = getMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase Admin messaging not initialized; notification stored only.');
    return;
  }

  const dataPayload = stringifyDataPayload(data);

  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: dataPayload,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'swiftdrop_deliveries',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    console.log(`[FCM] Sent OK user=${userId} type=${dataPayload.type || 'push'}`);
  } catch (err) {
    console.error(`[FCM] Send failed user=${userId}:`, err.code || err.message, err.message);
  }
}

module.exports = { sendPushNotification };

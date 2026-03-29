const db = require('../database/connection');
const { getRealtimeDb } = require('../services/firebaseAdmin');

async function getStatus(req, res) {
  try {
    const firebaseUid = req.user?.firebase_uid;
    const rtdb = getRealtimeDb();
    let rtdbData = null;
    if (rtdb && firebaseUid) {
      const snap = await rtdb.ref(`drivers/${firebaseUid}`).once('value');
      rtdbData = snap.val();
    }
    return res.json({
      isOnline: rtdbData?.status === 'online',
      location: rtdbData ? { lat: rtdbData.lat, lng: rtdbData.lng } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function patchStatus(req, res) {
  try {
    const firebaseUid = req.user?.firebase_uid;
    const { is_online } = req.body;
    const rtdb = getRealtimeDb();
    if (rtdb && firebaseUid) {
      await rtdb.ref(`drivers/${firebaseUid}`).update({
        status: is_online ? 'online' : 'offline',
        updatedAt: Date.now(),
      });
    }
    return res.json({ success: true, is_online: !!is_online });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function patchLocation(req, res) {
  try {
    const firebaseUid = req.user?.firebase_uid;
    if (!firebaseUid) return res.status(401).json({ error: 'Unauthorized' });

    const { lat, lng, is_online } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const rtdb = getRealtimeDb();
    if (!rtdb) {
      console.error('[patchLocation] RTDB not initialized — driver location not written');
      return res.status(503).json({ error: 'RTDB_UNAVAILABLE', message: 'Realtime database not configured on server' });
    }

    const payload = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      updatedAt: Date.now(),
    };
    if (is_online !== undefined) {
      payload.status = is_online ? 'online' : 'offline';
    }
    await rtdb.ref(`drivers/${firebaseUid}`).update(payload);
    console.log(`[patchLocation] Driver ${firebaseUid} → lat:${lat} lng:${lng} online:${is_online}`);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getTodayEarnings(req, res) {
  try {
    const firebaseUid = req.user?.firebase_uid;
    const result = await db.query(
      `SELECT
         COUNT(*)::int AS deliveries,
         COALESCE(SUM(driver_payout), 0)::numeric AS total
       FROM bookings
       WHERE driver_firebase_uid = $1
         AND status = 'delivered'
         AND delivered_at IS NOT NULL
         AND (delivered_at AT TIME ZONE 'Africa/Johannesburg')::date
             = (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg')::date`,
      [firebaseUid]
    );
    const row = result.rows[0] || {};
    const deliveries = parseInt(row.deliveries, 10) || 0;
    const total = row.total != null ? Number(row.total) : 0;
    return res.json({
      total: Math.round(total * 100) / 100,
      deliveries,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getStatus, patchStatus, patchLocation, getTodayEarnings };

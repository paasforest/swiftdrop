const db = require('../database/connection');
const { getRealtimeDb } = require('../services/firebaseAdmin');

/**
 * Driver availability and GPS live in `driver_locations` (used by the matching engine).
 * There is no separate `drivers` table — `is_online` is stored per driver_id here.
 */

async function getStatus(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;
    const r = await db.query(
      `SELECT is_online, updated_at FROM driver_locations WHERE driver_id = $1`,
      [driverId]
    );
    if (r.rows.length === 0) {
      return res.json({ is_online: false, updated_at: null });
    }
    const row = r.rows[0];
    return res.json({
      is_online: Boolean(row.is_online),
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error('getDriverStatus:', err);
    return res.status(500).json({ error: 'Failed to load status' });
  }
}

async function patchStatus(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const { is_online } = req.body;
    if (typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online (boolean) is required' });
    }
    const driverId = req.user.id;

    await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
       VALUES ($1, NULL, NULL, $2, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET
         is_online = EXCLUDED.is_online,
         updated_at = NOW()`,
      [driverId, is_online]
    );

    const r = await db.query(
      `SELECT is_online, updated_at FROM driver_locations WHERE driver_id = $1`,
      [driverId]
    );
    const row = r.rows[0];
    return res.json({
      is_online: Boolean(row.is_online),
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error('patchDriverStatus:', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}

async function patchLocation(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const { lat, lng } = req.body;
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }
    const driverId = req.user.id;
    const latN = Number(lat);
    const lngN = Number(lng);

    await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         updated_at = NOW()`,
      [driverId, latN, lngN]
    );

    const rt = getRealtimeDb();
    if (rt) {
      try {
        await rt.ref(`drivers/${driverId}/location`).set({
          lat: latN,
          lng: lngN,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('patchDriverLocation RTDB:', e.message);
      }
    }

    return res.json({ updated: true });
  } catch (err) {
    console.error('patchDriverLocation:', err);
    return res.status(500).json({ error: 'Failed to update location' });
  }
}

module.exports = {
  getStatus,
  patchStatus,
  patchLocation,
};

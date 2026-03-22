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
         is_online = TRUE,
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

/**
 * POST /api/driver-routes — driver posts a planned route (for route-based matching).
 */
async function createDriverRoute(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }

    const {
      from_address,
      from_lat,
      from_lng,
      to_address,
      to_lat,
      to_lng,
      departure_time,
      max_parcels,
      boot_space,
    } = req.body;

    if (!from_address || !String(from_address).trim()) {
      return res.status(400).json({ error: 'From address is required' });
    }
    if (!to_address || !String(to_address).trim()) {
      return res.status(400).json({ error: 'To address is required' });
    }
    if (from_lat == null || from_lng == null || Number.isNaN(Number(from_lat)) || Number.isNaN(Number(from_lng))) {
      return res.status(400).json({ error: 'From location (lat/lng) is required — pick an address from suggestions' });
    }
    if (to_lat == null || to_lng == null || Number.isNaN(Number(to_lat)) || Number.isNaN(Number(to_lng))) {
      return res.status(400).json({ error: 'To location (lat/lng) is required — pick an address from suggestions' });
    }

    const mp = parseInt(max_parcels, 10);
    if (!Number.isInteger(mp) || mp < 1 || mp > 5) {
      return res.status(400).json({ error: 'max_parcels must be between 1 and 5' });
    }

    if (!boot_space || !['small', 'medium', 'large'].includes(String(boot_space).toLowerCase())) {
      return res.status(400).json({ error: 'boot_space must be small, medium, or large' });
    }
    const boot = String(boot_space).toLowerCase();

    const dep = departure_time != null ? new Date(departure_time) : null;
    if (!dep || Number.isNaN(dep.getTime())) {
      return res.status(400).json({ error: 'departure_time must be a valid ISO datetime' });
    }
    if (dep.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Departure time must be in the future' });
    }
    const minFuture = Date.now() + 30 * 60 * 1000;
    if (dep.getTime() < minFuture) {
      return res.status(400).json({ error: 'Departure time must be at least 30 minutes from now' });
    }

    const driverId = req.user.id;
    const result = await db.query(
      `INSERT INTO driver_routes (
        driver_id, from_address, from_lat, from_lng, to_address, to_lat, to_lng,
        departure_time, max_parcels, boot_space, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING *`,
      [
        driverId,
        String(from_address).trim(),
        Number(from_lat),
        Number(from_lng),
        String(to_address).trim(),
        Number(to_lat),
        Number(to_lng),
        dep.toISOString(),
        mp,
        boot,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createDriverRoute:', err);
    return res.status(500).json({ error: 'Failed to create route' });
  }
}

/**
 * GET /api/driver-routes/my — active routes for this driver (departure ascending).
 */
async function listMyDriverRoutes(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;
    const r = await db.query(
      `SELECT id, from_address, to_address, from_lat, from_lng, to_lat, to_lng,
              departure_time, max_parcels, boot_space, status, created_at
       FROM driver_routes
       WHERE driver_id = $1 AND status = 'active'
       ORDER BY departure_time ASC`,
      [driverId]
    );
    return res.json({ routes: r.rows });
  } catch (err) {
    console.error('listMyDriverRoutes:', err);
    return res.status(500).json({ error: 'Failed to list routes' });
  }
}

/**
 * DELETE /api/driver-routes/:id — cancel a route (future departure only).
 */
async function cancelDriverRoute(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const routeId = parseInt(req.params.id, 10);
    if (!Number.isInteger(routeId)) {
      return res.status(400).json({ error: 'Invalid route id' });
    }
    const driverId = req.user.id;
    const r = await db.query(
      `SELECT id, driver_id, departure_time, status FROM driver_routes WHERE id = $1`,
      [routeId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }
    const row = r.rows[0];
    if (Number(row.driver_id) !== driverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (String(row.status) !== 'active') {
      return res.status(400).json({ error: 'Route is not active' });
    }
    const dep = new Date(row.departure_time);
    if (dep.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Cannot cancel a route that has already departed' });
    }
    await db.query(
      `UPDATE driver_routes SET status = 'cancelled' WHERE id = $1 AND driver_id = $2`,
      [routeId, driverId]
    );
    return res.json({ message: 'Route cancelled' });
  } catch (err) {
    console.error('cancelDriverRoute:', err);
    return res.status(500).json({ error: 'Failed to cancel route' });
  }
}

module.exports = {
  getStatus,
  patchStatus,
  patchLocation,
  createDriverRoute,
  listMyDriverRoutes,
  cancelDriverRoute,
};

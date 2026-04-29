const db = require('../database/connection');
const { getRealtimeDb } = require('../services/firebaseAdmin');
const { sendPushNotification } = require('../services/notificationService');

const LOCATION_MAX_AGE_MINUTES = 5;

function hasUsableCoords(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

async function rerunWaitingOrdersForProvince(province) {
  if (!province) return;
  const { runMatching } = require('../services/matchingService');
  const waitingOrders = await db.query(
    `SELECT o.id, o.status
     FROM orders o
     WHERE o.driver_id IS NULL
       AND o.province = $1
       AND o.created_at > NOW() - INTERVAL '2 hours'
       AND (
         o.status = 'matching'
         OR (
           o.status = 'unmatched'
           AND (
             o.match_attempted_at IS NULL
             OR o.match_attempted_at < NOW() - INTERVAL '5 minutes'
           )
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM job_offers jo
         WHERE jo.order_id = o.id AND jo.status = 'pending'
       )
     ORDER BY o.created_at ASC
     LIMIT 10`,
    [province]
  );

  for (const row of waitingOrders.rows) {
    const oid = row.id;
    setImmediate(() => {
      const kickOffMatching =
        row.status === 'matching'
          ? Promise.resolve({ rowCount: 1 })
          : db.query(
              `UPDATE orders SET status = 'matching', driver_id = NULL, updated_at = NOW()
               WHERE id = $1 AND status = 'unmatched'`,
              [oid]
            );
      kickOffMatching
        .then((r) => { if (r.rowCount) runMatching(oid); })
        .catch((e) => console.error('rerunWaitingOrdersForProvince:', e));
    });
  }
}

async function getStatus(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;
    const r = await db.query(
      `SELECT is_online, lat, lng, updated_at,
              updated_at > NOW() - ($2::int * INTERVAL '1 minute') AS has_fresh_location
       FROM driver_locations
       WHERE driver_id = $1`,
      [driverId, LOCATION_MAX_AGE_MINUTES]
    );
    if (r.rows.length === 0) {
      return res.json({ is_online: false, updated_at: null });
    }
    const row = r.rows[0];
    const hasCoords = hasUsableCoords(row.lat, row.lng);
    const online = Boolean(row.is_online) && hasCoords && Boolean(row.has_fresh_location);
    return res.json({ is_online: online, updated_at: row.updated_at, has_location: hasCoords });
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
    const existingRes = await db.query(
      `SELECT dl.lat, dl.lng, u.current_lat, u.current_lng
       FROM users u
       LEFT JOIN driver_locations dl ON dl.driver_id = u.id
       WHERE u.id = $1 AND u.user_type = 'driver'
       LIMIT 1`,
      [driverId]
    );
    const existing = existingRes.rows[0] || {};
    const lat =
      existing.lat != null && !Number.isNaN(Number(existing.lat)) ? Number(existing.lat) :
      existing.current_lat != null && !Number.isNaN(Number(existing.current_lat)) ? Number(existing.current_lat) :
      null;
    const lng =
      existing.lng != null && !Number.isNaN(Number(existing.lng)) ? Number(existing.lng) :
      existing.current_lng != null && !Number.isNaN(Number(existing.current_lng)) ? Number(existing.current_lng) :
      null;

    if (is_online && (lat == null || lng == null)) {
      return res.status(409).json({
        error: 'Current location required before going online',
        code: 'LOCATION_REQUIRED',
      });
    }

    await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET
         lat = COALESCE(EXCLUDED.lat, driver_locations.lat),
         lng = COALESCE(EXCLUDED.lng, driver_locations.lng),
         is_online = EXCLUDED.is_online,
         updated_at = NOW()`,
      [driverId, lat, lng, is_online]
    );
    await db.query(
      `UPDATE users SET is_online = $1, updated_at = NOW() WHERE id = $2 AND user_type = 'driver'`,
      [is_online, driverId]
    );

    const r = await db.query(
      `SELECT is_online, updated_at FROM driver_locations WHERE driver_id = $1`,
      [driverId]
    );
    const row = r.rows[0];
    if (Boolean(row.is_online) && hasUsableCoords(lat, lng)) {
      const { detectProvince } = require('../services/provinceService');
      const province = detectProvince(lat, lng);
      void rerunWaitingOrdersForProvince(province);
    }
    return res.json({ is_online: Boolean(row.is_online), updated_at: row.updated_at, has_location: hasUsableCoords(lat, lng) });
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
    const rawLat = req.body.lat ?? req.body.latitude;
    const rawLng = req.body.lng ?? req.body.longitude;
    const { is_online: bodyOnline } = req.body;

    if (rawLat == null || rawLng == null || Number.isNaN(Number(rawLat)) || Number.isNaN(Number(rawLng))) {
      return res.status(400).json({ error: 'lat and lng (or latitude/longitude) are required numbers' });
    }
    const driverId = req.user.id;
    const latN   = Number(rawLat);
    const lngN   = Number(rawLng);
    const online = typeof bodyOnline === 'boolean' ? bodyOnline : true;

    const previousRes = await db.query(
      `SELECT is_online, lat, lng, updated_at FROM driver_locations WHERE driver_id = $1`,
      [driverId]
    );
    const previous = previousRes.rows[0];
    const previousTimestamp = previous?.updated_at ? new Date(previous.updated_at).getTime() : null;
    const hadFreshLocation =
      hasUsableCoords(previous?.lat, previous?.lng) &&
      Number.isFinite(previousTimestamp) &&
      Date.now() - previousTimestamp < LOCATION_MAX_AGE_MINUTES * 60 * 1000;
    const shouldKickWaitingOrders = online && (!Boolean(previous?.is_online) || !hadFreshLocation);

    await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         is_online = EXCLUDED.is_online,
         updated_at = NOW()`,
      [driverId, latN, lngN, online]
    );
    await db.query(
      `UPDATE users SET
         current_lat = $1, current_lng = $2,
         last_seen_at = NOW(), is_online = $4, updated_at = NOW()
       WHERE id = $3 AND user_type = 'driver'`,
      [latN, lngN, driverId, online]
    );
    await db.query(
      `UPDATE orders
       SET driver_current_lat = $1, driver_current_lng = $2,
           driver_last_seen_at = NOW(), updated_at = NOW()
       WHERE driver_id = $3
         AND status IN ('accepted','pickup_en_route','pickup_arrived',
                        'collected','delivery_en_route','delivery_arrived')`,
      [latN, lngN, driverId]
    );

    const rt = getRealtimeDb();
    if (rt) {
      try {
        await rt.ref(`drivers/${driverId}/location`).set({ lat: latN, lng: lngN, timestamp: Date.now() });
      } catch (e) {
        console.error('patchDriverLocation RTDB:', e.message);
      }
    }

    if (shouldKickWaitingOrders) {
      const { detectProvince } = require('../services/provinceService');
      const province = detectProvince(latN, lngN);
      void rerunWaitingOrdersForProvince(province);
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
      from_address, from_lat, from_lng,
      to_address, to_lat, to_lng,
      departure_time, max_parcels, boot_space,
      trip_type, pickup_method,
      meeting_point_address, meeting_point_lat, meeting_point_lng,
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

    const { detectProvince } = require('../services/provinceService');
    const { fetchRoutePolyline } = require('../services/directionsService');

    const province = detectProvince(Number(from_lat), Number(from_lng));
    if (!province) {
      return res.status(400).json({ error: 'Route posting not available in your area.', code: 'OUTSIDE_SERVICE_AREA' });
    }

    const route_polyline = await fetchRoutePolyline(from_lat, from_lng, to_lat, to_lng);
    const driver_type = req.body.driver_type || 'commuter';
    const driverId = req.user.id;

    const tripTypeSafe    = ['local', 'intercity'].includes(trip_type) ? trip_type : 'local';
    const pickupMethodSafe = ['driver_collects', 'sender_drops_off'].includes(pickup_method)
      ? pickup_method : 'driver_collects';
    const meetingAddr = pickupMethodSafe === 'sender_drops_off' && meeting_point_address
      ? String(meeting_point_address).trim() : null;
    const meetingLat  = pickupMethodSafe === 'sender_drops_off' && meeting_point_lat != null
      ? Number(meeting_point_lat) : null;
    const meetingLng  = pickupMethodSafe === 'sender_drops_off' && meeting_point_lng != null
      ? Number(meeting_point_lng) : null;

    const result = await db.query(
      `INSERT INTO driver_routes (
        driver_id, from_address, from_lat, from_lng, to_address, to_lat, to_lng,
        departure_time, max_parcels, boot_space, status, province, route_polyline,
        driver_type, trip_type, pickup_method,
        meeting_point_address, meeting_point_lat, meeting_point_lng
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        driverId, String(from_address).trim(),
        Number(from_lat), Number(from_lng),
        String(to_address).trim(),
        Number(to_lat), Number(to_lng),
        dep.toISOString(), mp, boot, province, route_polyline, driver_type,
        tripTypeSafe, pickupMethodSafe, meetingAddr, meetingLat, meetingLng,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createDriverRoute:', err);
    return res.status(500).json({ error: 'Failed to create route' });
  }
}

/**
 * GET /api/driver-routes/my — active routes for this driver.
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
 * DELETE /api/driver-routes/:id
 * PATCH  /api/driver-routes/:id/cancel
 *
 * Cancel a posted trip. Refunds all active bookings, records a driver strike,
 * and suspends the account if 3 strikes accumulate within 90 days.
 */
async function cancelDriverRoute(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const routeId  = parseInt(req.params.id, 10);
    const driverId = req.user.id;

    const { rows: routeRows } = await db.query(
      `SELECT * FROM driver_routes WHERE id = $1 AND driver_id = $2`,
      [routeId, driverId]
    );
    if (!routeRows[0]) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (String(routeRows[0].status) !== 'active') {
      return res.status(400).json({ error: 'Trip is not active' });
    }

    // All active bookings on this trip
    const { rows: bookings } = await db.query(
      `SELECT o.*, u.phone AS customer_phone,
              p.amount AS paid_amount, p.escrow_status
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.assigned_driver_route_id = $1
         AND o.status NOT IN ('cancelled', 'delivered', 'completed')`,
      [routeId]
    );

    const client = await db.pool.connect();
    let strikeCount = 0;
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE driver_routes SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [routeId]
      );

      for (const booking of bookings) {
        await client.query(
          `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [booking.id]
        );
        if (booking.escrow_status === 'held') {
          await client.query(
            `UPDATE payments
             SET escrow_status = 'refunded', payout_status = 'refunded', updated_at = NOW()
             WHERE order_id = $1`,
            [booking.id]
          );
          await client.query(
            `UPDATE users
             SET wallet_balance = COALESCE(wallet_balance, 0) + $1
             WHERE id = $2`,
            [booking.paid_amount, booking.customer_id]
          );
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
             VALUES ($1, 'credit', $2, $3, 'Refund — driver cancelled trip')`,
            [booking.customer_id, booking.paid_amount, `REFUND-TRIP-${routeId}`]
          );
        }
      }

      await client.query(
        `INSERT INTO driver_strikes (driver_id, reason) VALUES ($1, 'trip_cancelled')`,
        [driverId]
      );

      const { rows: strikes } = await client.query(
        `SELECT COUNT(*)::int AS count FROM driver_strikes
         WHERE driver_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
        [driverId]
      );
      strikeCount = Number(strikes[0].count);

      if (strikeCount >= 3) {
        await client.query(`UPDATE users SET is_active = false WHERE id = $1`, [driverId]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Post-commit notifications (non-fatal)
    for (const booking of bookings) {
      await sendPushNotification(
        booking.customer_id,
        'Trip Cancelled',
        'Your driver cancelled the trip. Full refund has been processed.'
      ).catch(() => {});
    }
    if (strikeCount >= 3) {
      await sendPushNotification(
        driverId,
        'Account Suspended',
        'Your account has been suspended due to 3 trip cancellations. Contact support to appeal.'
      ).catch(() => {});
    }

    return res.json({ success: true, refunded_count: bookings.length, strikes: strikeCount });
  } catch (err) {
    console.error('cancelDriverRoute:', err);
    return res.status(500).json({ error: 'Failed to cancel trip' });
  }
}

async function getTodayEarnings(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total
       FROM wallet_transactions
       WHERE user_id = $1 AND type = 'credit' AND created_at >= CURRENT_DATE`,
      [driverId]
    );
    return res.json({ count: rows[0].count, total: Number(rows[0].total) });
  } catch (err) {
    console.error('getTodayEarnings:', err);
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
}

module.exports = {
  getStatus,
  patchStatus,
  patchLocation,
  createDriverRoute,
  listMyDriverRoutes,
  cancelDriverRoute,
  getTodayEarnings,
};

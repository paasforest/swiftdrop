const db = require('../database/connection');
const { getRealtimeDb } = require('../services/firebaseAdmin');
const { sendPushNotification } = require('../services/notificationService');

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
      trip_type,
      pickup_method,
      meeting_point_address,
      meeting_point_lat,
      meeting_point_lng,
      delivery_radius_km,
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

    const driverId = req.user.id;

    const tripTypeSafe = ['local', 'intercity'].includes(trip_type) ? trip_type : 'local';
    const pickupMethodSafe = ['driver_collects', 'sender_drops_off'].includes(pickup_method)
      ? pickup_method
      : 'driver_collects';
    const meetingAddr = pickupMethodSafe === 'sender_drops_off' && meeting_point_address
      ? String(meeting_point_address).trim()
      : null;
    const meetingLat = pickupMethodSafe === 'sender_drops_off' && meeting_point_lat != null
      ? Number(meeting_point_lat)
      : null;
    const meetingLng = pickupMethodSafe === 'sender_drops_off' && meeting_point_lng != null
      ? Number(meeting_point_lng)
      : null;

    const validRadii = [5, 10, 20, 30];
    const radiusKm = tripTypeSafe === 'intercity' && validRadii.includes(Number(delivery_radius_km))
      ? Number(delivery_radius_km)
      : 10;

    const result = await db.query(
      `INSERT INTO driver_routes (
        driver_id, from_address, from_lat, from_lng, to_address, to_lat, to_lng,
        departure_time, max_parcels, boot_space, status,
        trip_type, pickup_method,
        meeting_point_address, meeting_point_lat, meeting_point_lng,
        delivery_radius_km
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12,$13,$14,$15,$16)
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
        tripTypeSafe,
        pickupMethodSafe,
        meetingAddr,
        meetingLat,
        meetingLng,
        radiusKm,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createDriverRoute:', err);
    return res.status(500).json({ error: 'Failed to create route' });
  }
}

/**
 * PATCH /api/driver-routes/:id/cancel — driver cancels a posted trip.
 *
 * Refunds every order assigned to this route, notifies affected customers,
 * records a cancellation strike against the driver, and deactivates the
 * driver account if 3 strikes have occurred in the last 90 days.
 */
async function cancelDriverRoute(req, res) {
  const client = await db.pool.connect();
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }

    const routeId = parseInt(req.params.id, 10);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: 'Invalid route id' });
    }

    await client.query('BEGIN');

    const routeRes = await client.query(
      `SELECT * FROM driver_routes WHERE id = $1 FOR UPDATE`,
      [routeId]
    );
    const route = routeRes.rows[0];
    if (!route) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Route not found' });
    }
    if (route.driver_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (route.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Route cannot be cancelled in current state' });
    }

    await client.query(
      `UPDATE driver_routes SET status = 'cancelled' WHERE id = $1`,
      [routeId]
    );

    // Refund every active order assigned to this route
    const ordersRes = await client.query(
      `SELECT id, customer_id, total_price, status
         FROM orders
        WHERE assigned_driver_route_id = $1
          AND status NOT IN ('cancelled', 'completed', 'delivered')`,
      [routeId]
    );
    const affectedOrders = ordersRes.rows;

    for (const o of affectedOrders) {
      await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [o.id]
      );
      const payRes = await client.query(
        `SELECT payment_method FROM payments WHERE order_id = $1`,
        [o.id]
      );
      const pay = payRes.rows[0];
      if (pay) {
        await client.query(
          `UPDATE payments SET escrow_status = 'refunded', updated_at = NOW() WHERE order_id = $1`,
          [o.id]
        );
        if (pay.payment_method === 'wallet') {
          await client.query(
            `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
            [o.total_price, o.customer_id]
          );
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
             VALUES ($1, 'credit', $2, $3, 'Refund: driver cancelled trip')`,
            [o.customer_id, o.total_price, `order:${o.id}`]
          );
        }
      }
    }

    // Record a strike + check 90-day window
    await client.query(
      `INSERT INTO driver_strikes (driver_id, driver_route_id, reason)
       VALUES ($1, $2, 'trip_cancelled')`,
      [req.user.id, routeId]
    );

    await client.query(
      `UPDATE driver_routes
          SET cancellation_strikes = COALESCE(cancellation_strikes, 0) + 1
        WHERE id = $1`,
      [routeId]
    );

    const strikesRes = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM driver_strikes
        WHERE driver_id = $1
          AND created_at >= NOW() - INTERVAL '90 days'`,
      [req.user.id]
    );
    const recentStrikes = strikesRes.rows[0]?.n ?? 0;

    let driverDeactivated = false;
    if (recentStrikes >= 3) {
      await client.query(
        `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
        [req.user.id]
      );
      driverDeactivated = true;
    }

    await client.query('COMMIT');

    // Best-effort push notifications (post-commit; failure does not affect cancel)
    for (const o of affectedOrders) {
      sendPushNotification(
        o.customer_id,
        'Trip cancelled',
        'Your driver cancelled their trip. Your payment has been refunded.',
        { type: 'trip_cancelled', order_id: o.id }
      ).catch(() => {});
    }
    if (driverDeactivated) {
      sendPushNotification(
        req.user.id,
        'Account deactivated',
        'Your account has been deactivated due to 3 trip cancellations in 90 days.',
        { type: 'driver_deactivated' }
      ).catch(() => {});
    } else {
      sendPushNotification(
        req.user.id,
        'Trip cancelled',
        `Trip cancelled. Strike ${recentStrikes}/3 in the last 90 days.`,
        { type: 'driver_strike', strikes: recentStrikes }
      ).catch(() => {});
    }

    return res.json({
      message: 'Trip cancelled',
      affected_orders: affectedOrders.length,
      strikes_in_90_days: recentStrikes,
      driver_deactivated: driverDeactivated,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('cancelDriverRoute:', err);
    return res.status(500).json({ error: 'Failed to cancel trip' });
  } finally {
    client.release();
  }
}

async function getTodayEarnings(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;
    const r = await db.query(
      `SELECT COALESCE(SUM(driver_earnings), 0) AS total,
              COUNT(*) AS deliveries
       FROM orders
       WHERE driver_id = $1
         AND status = 'delivered'
         AND updated_at >= NOW()::date`,
      [driverId]
    );
    const row = r.rows[0];
    return res.json({
      total: parseFloat(row.total) || 0,
      deliveries: parseInt(row.deliveries, 10) || 0,
    });
  } catch (err) {
    console.error('getTodayEarnings:', err);
    return res.status(500).json({ error: 'Failed to load earnings' });
  }
}

async function getMyRoutes(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const { rows } = await db.query(
      `SELECT dr.*,
              COUNT(o.id) AS parcel_count
       FROM driver_routes dr
       LEFT JOIN orders o ON o.assigned_driver_route_id = dr.id
         AND o.status NOT IN ('cancelled')
       WHERE dr.driver_id = $1
         AND dr.status = 'active'
         AND dr.departure_time > NOW() - INTERVAL '24 hours'
       GROUP BY dr.id
       ORDER BY dr.departure_time ASC`,
      [req.user.id]
    );
    return res.json({ routes: rows });
  } catch (err) {
    console.error('getMyRoutes:', err);
    return res.status(500).json({ error: 'Failed to load routes' });
  }
}

async function getTripParcels(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const { id } = req.params;
    const { rows: routeRows } = await db.query(
      `SELECT * FROM driver_routes WHERE id = $1 AND driver_id = $2`,
      [id, req.user.id]
    );
    if (!routeRows[0]) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const { rows } = await db.query(
      `SELECT
         o.id, o.order_number, o.status,
         o.pickup_address, o.dropoff_address,
         o.pickup_lat, o.pickup_lng,
         o.dropoff_lat, o.dropoff_lng,
         o.parcel_size, o.parcel_type,
         o.pickup_otp, o.delivery_otp,
         o.pickup_photo_url, o.delivery_photo_url,
         o.pickup_confirmed_at, o.delivery_confirmed_at,
         o.driver_earnings,
         u.full_name AS customer_name,
         u.phone AS customer_phone
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       WHERE o.assigned_driver_route_id = $1
         AND o.status NOT IN ('cancelled')
       ORDER BY o.created_at ASC`,
      [id]
    );
    const delivered = rows.filter((r) => ['delivered', 'completed'].includes(r.status));
    const collected = rows.filter((r) =>
      ['collected', 'delivery_en_route', 'delivery_arrived', 'delivered', 'completed'].includes(r.status)
    );
    return res.json({
      route: routeRows[0],
      parcels: rows,
      total: rows.length,
      collected: collected.length,
      delivered: delivered.length,
    });
  } catch (err) {
    console.error('getTripParcels:', err);
    return res.status(500).json({ error: 'Failed to load parcels' });
  }
}

async function getEarningsSummary(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const { rows } = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days'  THEN amount END), 0) AS week_total,
         COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN amount END), 0) AS month_total,
         COALESCE(SUM(amount), 0) AS all_time_total
       FROM wallet_transactions
       WHERE user_id = $1 AND type = 'credit'`,
      [req.user.id]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('getEarningsSummary:', err);
    return res.status(500).json({ error: 'Failed to load earnings summary' });
  }
}

module.exports = {
  getStatus,
  patchStatus,
  patchLocation,
  createDriverRoute,
  cancelDriverRoute,
  getTodayEarnings,
  getEarningsSummary,
  getMyRoutes,
  getTripParcels,
};

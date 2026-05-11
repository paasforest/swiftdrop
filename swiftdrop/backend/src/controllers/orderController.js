const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { generateOTP } = require('../utils/otpHelper');
const { detectProvince } = require('../services/provinceService');
const { runMatching, offerReturnLoadAfterIntercityPickup } = require('../services/matchingService');
const { releaseEscrow } = require('../services/paymentService');
const { sendPushNotification } = require('../services/notificationService');
const smsService = require('../services/smsService');
const { uploadImage } = require('../services/cloudinaryService');
const { hasAvailableSlots } = require('../services/slotService');
const {
  deductWallet,
  refundWallet,
  InsufficientWalletBalanceError,
} = require('../utils/wallet');

const VALUE_COMPONENT_BY_PARCEL_VALUE = [
  { max: 199.999, value: 0 }, // Under R200
  { max: 500, value: 15 }, // R200-R500
  { max: 1000, value: 25 }, // R501-R1000
  { max: 2000, value: 40 }, // R1001-R2000
  { max: 5000, value: 65 }, // R2001-R5000
  { max: Infinity, value: 65 }, // fallback
];

const LOCAL_PRICING = {
  small: [
    { maxKm: 10, price: 120 },
    { maxKm: 30, price: 160 },
    { maxKm: 80, price: 200 },
    { maxKm: Infinity, price: 250 },
  ],
  medium: [
    { maxKm: 10, price: 170 },
    { maxKm: 30, price: 220 },
    { maxKm: 80, price: 280 },
    { maxKm: Infinity, price: 340 },
  ],
  large: [
    { maxKm: 10, price: 230 },
    { maxKm: 30, price: 300 },
    { maxKm: 80, price: 380 },
    { maxKm: Infinity, price: 460 },
  ],
};

function getLocalPrice(parcelSize, distKm) {
  const tiers = LOCAL_PRICING[String(parcelSize || '').toLowerCase()] || LOCAL_PRICING.small;
  const d = Number(distKm);
  if (!Number.isFinite(d) || d < 0) return tiers[0].price;
  const tier = tiers.find((t) => d <= t.maxKm);
  return tier?.price || 200;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function zoneForDistance(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return 'city';
  if (d <= 30) return 'city';
  if (d <= 80) return 'regional';
  if (d <= 150) return 'intercity';
  return 'long_distance';
}

function valueComponentForParcelValue(parcelValue) {
  const v = Number(parcelValue);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const found = VALUE_COMPONENT_BY_PARCEL_VALUE.find((r) => v <= r.max);
  return found ? found.value : 0;
}

const INTERCITY_PRICING = {
  small: [
    { maxKm: 150, price: 80 },
    { maxKm: 400, price: 130 },
    { maxKm: 700, price: 180 },
    { maxKm: Infinity, price: 250 },
  ],
  medium: [
    { maxKm: 150, price: 120 },
    { maxKm: 400, price: 200 },
    { maxKm: 700, price: 270 },
    { maxKm: Infinity, price: 370 },
  ],
  large: [
    { maxKm: 150, price: 170 },
    { maxKm: 400, price: 280 },
    { maxKm: 700, price: 380 },
    { maxKm: Infinity, price: 500 },
  ],
};

function getIntercityPrice(parcelSize, distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return INTERCITY_PRICING.small[0].price;
  const tiers = INTERCITY_PRICING[String(parcelSize || 'small').toLowerCase()] || INTERCITY_PRICING.small;
  const tier = tiers.find((t) => d <= t.maxKm);
  return tier?.price ?? 250;
}

function generateOrderNumber() {
  return 'SD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/** Driver assigned on order or owning the assigned trip route (legacy / trip parcels). */
function driverMatchesOrderRow(order, driverId) {
  const uid = Number(driverId);
  if (!Number.isFinite(uid)) return false;
  if (Number(order.driver_id) === uid) return true;
  const routeDriver = order.route_driver_id != null ? Number(order.route_driver_id) : null;
  return Number.isFinite(routeDriver) && routeDriver === uid;
}

async function createOrder(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Only customers can create delivery orders' });
    }

    const {
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, dropoff_lat, dropoff_lng,
      parcel_type, parcel_size, parcel_value, special_handling,
      delivery_tier, insurance_selected,
      payment_method = 'card',
      assigned_driver_route_id,
      trip_type = 'local',
    } = req.body;

    const isIntercity = String(trip_type) === 'intercity';
    const deliveryTierForDb = 'standard';

    if (!pickup_address || pickup_lat == null || pickup_lng == null ||
        !dropoff_address || dropoff_lat == null || dropoff_lng == null) {
      return res.status(400).json({ error: 'pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng are required' });
    }

    if (!['standard', 'express', 'urgent'].includes(String(delivery_tier || 'standard').toLowerCase())) {
      return res.status(400).json({ error: 'Invalid delivery_tier' });
    }

    if (isIntercity && !assigned_driver_route_id) {
      return res.status(400).json({ error: 'assigned_driver_route_id is required for intercity bookings' });
    }

    // Intercity slot reservation: only when the customer is booking onto a posted trip.
    if (assigned_driver_route_id) {
      const { rows: routeRows } = await db.query(
        `SELECT id, max_parcels, driver_id, to_lat, to_lng, to_city, delivery_radius_km, trip_type
         FROM driver_routes WHERE id = $1 AND status = 'active'`,
        [assigned_driver_route_id]
      );
      const routeRow = routeRows[0];
      if (!routeRow) {
        return res.status(400).json({
          error: 'This trip is no longer available.',
          code: 'TRIP_NOT_FOUND',
        });
      }

      if (isIntercity) {
        const destLat = Number(routeRow.to_lat);
        const destLng = Number(routeRow.to_lng);
        const radiusKm = Number(routeRow.delivery_radius_km) || 20;

        if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
          console.warn('No destination coords for route', routeRow.id);
        } else {
          const distKm = haversineKm(
            Number(dropoff_lat),
            Number(dropoff_lng),
            destLat,
            destLng
          );

          if (Number.isFinite(distKm) && distKm > radiusKm) {
            return res.status(400).json({
              error:
                `Your delivery address is ${Math.round(distKm)}km from ${
                  routeRow.to_city || 'the driver destination'
                }. This driver delivers within ${radiusKm}km of their destination.`,
              distance_km: Math.round(distKm),
              max_radius_km: radiusKm,
            });
          }
        }
      }

      const available = await hasAvailableSlots(
        assigned_driver_route_id,
        routeRow.max_parcels,
        parcel_size
      );
      if (!available) {
        return res.status(400).json({
          error: 'Sorry this trip is now full.',
          code: 'TRIP_FULL',
        });
      }
    }

    const dist = haversineKm(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(dropoff_lat), parseFloat(dropoff_lng)
    );

    const pickupProvince = detectProvince(Number(pickup_lat), Number(pickup_lng));
    const province = pickupProvince || null;

    let basePrice;
    let insuranceFee;
    let commission;
    let driverEarnings;
    let totalPrice;

    if (isIntercity) {
      const interBase = getIntercityPrice(parcel_size, dist);
      const valueComponentRaw = valueComponentForParcelValue(parcel_value);
      basePrice = roundMoney(interBase);
      insuranceFee = roundMoney(valueComponentRaw);
      driverEarnings = roundMoney(Math.round(interBase * 0.8));
      commission = roundMoney(Math.round(interBase * 0.2));
      totalPrice = roundMoney(interBase + valueComponentRaw);
    } else {
      const localBase = getLocalPrice(parcel_size, dist);
      const valueComponentRaw = valueComponentForParcelValue(parcel_value);
      basePrice = roundMoney(localBase);
      insuranceFee = roundMoney(valueComponentRaw);
      driverEarnings = roundMoney(Math.round(localBase * 0.8));
      commission = roundMoney(Math.round(localBase * 0.2));
      totalPrice = roundMoney(localBase + valueComponentRaw);
    }

    const pickupOtp = generateOTP();
    const deliveryOtp = generateOTP();
    const orderNumber = generateOrderNumber();
    const customerId = req.user.id;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (payment_method === 'wallet') {
        try {
          await deductWallet(client, customerId, totalPrice, `ORDER-${orderNumber}`);
        } catch (wErr) {
          await client.query('ROLLBACK');
          if (wErr instanceof InsufficientWalletBalanceError) {
            return res.status(400).json({
              error: wErr.message,
              required: wErr.required,
              available: wErr.available,
            });
          }
          throw wErr;
        }
      }

      const orderRes = await client.query(
        `INSERT INTO orders (
          order_number, customer_id, pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng, province,
          parcel_type, parcel_size, parcel_value,
          special_handling, delivery_tier, status, base_price, insurance_fee, total_price,
          commission_amount, driver_earnings, pickup_otp, delivery_otp,
          assigned_driver_route_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'matching',$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING *`,
        [
          orderNumber, customerId, pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng, province,
          parcel_type || null, parcel_size || null,
          parcel_value || null, special_handling || null, deliveryTierForDb,
          basePrice, insuranceFee, totalPrice, commission, driverEarnings, pickupOtp, deliveryOtp,
          assigned_driver_route_id || null,
        ]
      );
      const order = orderRes.rows[0];

      await client.query(
        `INSERT INTO payments (order_id, amount, payment_method, escrow_status)
         VALUES ($1, $2, $3, 'held')`,
        [order.id, totalPrice, payment_method]
      );

      // Intercity trip bookings: assign route owner immediately (skip job-offer matching).
      if (isIntercity && assigned_driver_route_id) {
        const routeOwnerRes = await client.query(
          `SELECT driver_id FROM driver_routes WHERE id = $1`,
          [assigned_driver_route_id]
        );
        const routeOwnerId = routeOwnerRes.rows[0]?.driver_id;
        if (routeOwnerId) {
          await client.query(
            `UPDATE orders SET driver_id = $1, status = 'accepted', matched_at = NOW(), updated_at = NOW() WHERE id = $2`,
            [routeOwnerId, order.id]
          );
        }
      }

      await client.query('COMMIT');

      if (!(isIntercity && assigned_driver_route_id)) {
        runMatching(order.id);
      }

      if (assigned_driver_route_id) {
        try {
          const { rows: routeDetailRows } = await db.query(
            `SELECT pickup_method, meeting_point_address, departure_time
             FROM driver_routes WHERE id = $1`,
            [assigned_driver_route_id]
          );
          const driverRoute = routeDetailRows[0];
          if (
            driverRoute?.pickup_method === 'sender_drops_off'
            && driverRoute?.meeting_point_address
          ) {
            const { rows: custRows } = await db.query(
              `SELECT phone FROM users WHERE id = $1`,
              [order.customer_id]
            );
            const customerPhone = custRows[0]?.phone;
            if (customerPhone) {
              const departureTime = new Date(driverRoute.departure_time);
              const dropoffDeadline = new Date(departureTime.getTime() - 30 * 60 * 1000);
              const deadlineStr = dropoffDeadline.toLocaleTimeString('en-ZA', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const departureDateStr = departureTime.toLocaleDateString('en-ZA', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              await smsService.sendSMS(
                customerPhone,
                'SwiftDrop: Your intercity booking is confirmed!\n\n'
                  + 'Drop off your parcel at:\n'
                  + `${driverRoute.meeting_point_address}\n\n`
                  + `Deadline: ${deadlineStr} on ${departureDateStr}\n`
                  + '(30 min before driver departs)\n\n'
                  + 'The driver will verify with a code and photo.'
              );
            }
          }
        } catch (smsErr) {
          console.error('createOrder meeting-point SMS:', smsErr?.message || smsErr);
        }
      }

      const out = {
        ...order,
        price_breakdown: {
          base_price: basePrice,
          insurance_fee: insuranceFee,
          commission: commission,
          driver_earnings: driverEarnings,
          total: totalPrice,
        },
      };
      return res.status(201).json(out);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('createOrder:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

async function calculatePrice(req, res) {
  try {
    const {
      pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
      parcel_value, trip_type, parcel_size,
    } = req.body;
    if (pickup_lat == null || pickup_lng == null || dropoff_lat == null || dropoff_lng == null) {
      return res.status(400).json({ error: 'pickup and dropoff coordinates required' });
    }

    const dist = haversineKm(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(dropoff_lat), parseFloat(dropoff_lng)
    );

    if (String(trip_type) === 'intercity') {
      const price = getIntercityPrice(parcel_size, dist);
      const valueComponent = valueComponentForParcelValue(parcel_value);
      return res.json({
        intercity: true,
        distance_km: Math.round(dist),
        base_price: price,
        insurance_fee: valueComponent,
        total_price: price + valueComponent,
        driver_earnings: Math.round(price * 0.8),
        commission: Math.round(price * 0.2),
      });
    }

    const distKm = dist;
    const basePrice = getLocalPrice(parcel_size, distKm);
    const valueComp = valueComponentForParcelValue(Number(parcel_value) || 0);
    const driverEarnings = Math.round(basePrice * 0.8);
    const commission = Math.round(basePrice * 0.2);

    return res.json({
      local: true,
      distance_km: Math.round(distKm),
      base_price: basePrice,
      insurance_fee: valueComp,
      total_price: basePrice + valueComp,
      driver_earnings: driverEarnings,
      commission,
    });
  } catch (err) {
    console.error('calculatePrice:', err);
    return res.status(500).json({ error: 'Price calculation failed' });
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const orderRes = await db.query(
      `SELECT o.*,
        u.full_name AS driver_name,
        u.phone AS driver_phone,
        COALESCE(u.profile_photo_url, dp.selfie_url) AS driver_photo,
        dp.vehicle_make,
        dp.vehicle_model,
        dp.vehicle_color,
        dp.vehicle_year,
        dp.vehicle_plate,
        COALESCE(dt.deliveries_completed, 0) AS driver_deliveries_completed,
        COALESCE(dt.current_rating, 0.0) AS driver_rating,
        dr.departure_time AS trip_departure_time,
        dr.from_city AS trip_from_city,
        dr.to_city AS trip_to_city,
        dr.from_address AS trip_route_from_address,
        dr.to_address AS trip_route_to_address,
        CASE WHEN dr.id IS NOT NULL THEN dr.trip_type ELSE 'local' END AS trip_type,
        dr.driver_id AS route_driver_id
       FROM orders o
       LEFT JOIN users u ON u.id = o.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = o.driver_id
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && order.driver_id !== req.user.id && req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    delete order.route_driver_id;
    // Includes pickup_otp / delivery_otp from `orders` (o.*). Customer app shows OTPs to the order owner for handoff.
    return res.json(order);
  } catch (err) {
    console.error('getOrderById:', err);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
}

/** GET /api/orders/customer/stats — counts & spend for profile */
async function getCustomerStats(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COALESCE(SUM(total_price), 0) AS total_spent
       FROM orders
       WHERE customer_id = $1
         AND status NOT IN ('cancelled')`,
      [req.user.id]
    );

    const wallet = await db.query(`SELECT wallet_balance FROM users WHERE id = $1`, [req.user.id]);

    const r0 = rows[0] || {};
    const wb = wallet.rows[0]?.wallet_balance;

    return res.json({
      total_orders: Number(r0.total_orders) || 0,
      total_spent: Number(r0.total_spent || 0).toFixed(2),
      wallet_balance: Number(wb != null ? wb : 0).toFixed(2),
    });
  } catch (err) {
    console.error('getCustomerStats:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
}

async function getCustomerOrders(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params = [req.user.id];
    let where = 'WHERE o.customer_id = $1';
    if (status) {
      params.push(status);
      where += ` AND o.status = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT o.*, u.full_name as driver_name FROM orders o
       LEFT JOIN users u ON u.id = o.driver_id
       ${where}
       ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countRes = await db.query(
      `SELECT COUNT(*)::int as c FROM orders o ${where}`,
      params
    );
    const total = countRes.rows[0]?.c || 0;
    return res.json({ orders: rows.rows, total, page, limit });
  } catch (err) {
    console.error('getCustomerOrders:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function cancelOrder(req, res) {
  try {
    const { id } = req.params;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const orderRes = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const order = orderRes.rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.customer_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!['pending', 'matching', 'unmatched'].includes(order.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Order cannot be cancelled in current status' });
      }

      await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [id]
      );

      const payRes = await client.query(
        `SELECT payment_method FROM payments WHERE order_id = $1`,
        [id]
      );
      const payment = payRes.rows[0];

      if (payment) {
        await client.query(
          `UPDATE payments SET escrow_status = 'refunded', updated_at = NOW() WHERE order_id = $1`,
          [id]
        );
        if (payment.payment_method === 'wallet') {
          const total = Number(order.total_price);
          if (Number.isFinite(total) && total > 0) {
            await refundWallet(client, order.customer_id, total, `ORDER-CANCEL-${id}`);
          }
        }
      }

      await client.query('COMMIT');
      return res.json({ message: 'Order cancelled', refund: order.total_price });
    } catch (inner) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
      throw inner;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cancelOrder:', err.message, err.stack);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

// Customer presses "Keep Searching" when an order becomes unmatched.
// We flip the order back to `matching` and restart the server-side matching engine.
async function retryMatching(req, res) {
  try {
    const { id } = req.params;

    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    if (order.status !== 'unmatched') {
      return res.status(400).json({ error: 'Order is not currently unmatched' });
    }

    await db.query(`UPDATE job_offers SET status = 'expired' WHERE order_id = $1 AND status = 'pending'`, [id]);
    await db.query(
      `UPDATE orders SET status = 'matching', driver_id = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    runMatching(id);

    return res.json({ message: 'Retry matching started' });
  } catch (err) {
    console.error('retryMatching:', err);
    return res.status(500).json({ error: 'Retry matching failed' });
  }
}

async function getOrderTracking(req, res) {
  try {
    const { id } = req.params;
    const orderRes = await db.query(
      `SELECT o.*, o.driver_current_lat as lat, o.driver_current_lng as lng, o.driver_last_seen_at
       FROM orders o WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && order.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({
      lat: order.lat ? parseFloat(order.lat) : null,
      lng: order.lng ? parseFloat(order.lng) : null,
      last_seen_at: order.driver_last_seen_at,
    });
  } catch (err) {
    console.error('getOrderTracking:', err);
    return res.status(500).json({ error: 'Failed to fetch tracking' });
  }
}

/**
 * GET /api/orders/pending-offer — driver’s current pending job offer (if any).
 */
async function getPendingOffer(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;
    const r = await db.query(
      `SELECT jo.expires_at,
              o.id AS order_id, o.pickup_address, o.dropoff_address, o.pickup_lat, o.pickup_lng,
              o.dropoff_lat, o.dropoff_lng, o.parcel_type, o.parcel_size, o.special_handling,
              o.driver_earnings, o.delivery_tier, o.status
       FROM job_offers jo
       INNER JOIN orders o ON o.id = jo.order_id
       WHERE jo.driver_id = $1 AND jo.status = 'pending' AND o.status = 'matching'
       ORDER BY jo.expires_at ASC
       LIMIT 1`,
      [driverId]
    );
    if (r.rows.length === 0) {
      return res.json({ offer: null });
    }

    const row = r.rows[0];
    const dist = haversineKm(
      parseFloat(row.pickup_lat),
      parseFloat(row.pickup_lng),
      parseFloat(row.dropoff_lat),
      parseFloat(row.dropoff_lng)
    );
    const zone = zoneForDistance(dist);
    const timeEstimateMinutes = Math.max(15, Math.round(15 + dist * 1.2));

    const expiresAt = row.expires_at;
    const offerExpiresIso =
      expiresAt instanceof Date ? expiresAt.toISOString() : new Date(expiresAt).toISOString();

    const offer = {
      orderId: row.order_id,
      pickup_address: row.pickup_address,
      dropoff_address: row.dropoff_address,
      distance_km: Math.round(dist * 10) / 10,
      zone,
      driver_earns: parseFloat(row.driver_earnings) || 0,
      parcel_type: row.parcel_type || '',
      parcel_size: row.parcel_size || '',
      time_estimate: `${timeEstimateMinutes} min`,
      special_handling: row.special_handling || null,
      offer_expires_at: offerExpiresIso,
    };

    return res.json({ offer });
  } catch (err) {
    console.error('getPendingOffer:', err);
    return res.status(500).json({ error: 'Failed to fetch offer' });
  }
}

async function acceptOrder(req, res) {
  try {
    const { id } = req.params;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'matching') return res.status(400).json({ error: 'Order not available' });
    if (order.driver_id) return res.status(400).json({ error: 'Order already assigned' });

    const offerRes = await db.query(
      `SELECT id FROM job_offers WHERE order_id = $1 AND driver_id = $2 AND status = 'pending'`,
      [id, driverId]
    );
    if (offerRes.rows.length === 0) return res.status(400).json({ error: 'No valid offer' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE orders SET driver_id = $1, status = 'accepted', matched_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [driverId, id]
      );
      await client.query(
        `UPDATE job_offers SET status = 'accepted' WHERE order_id = $1 AND driver_id = $2`,
        [id, driverId]
      );
      await client.query(
        `UPDATE job_offers SET status = 'expired' WHERE order_id = $1 AND driver_id != $2`,
        [id, driverId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const driverUserRes = await db.query(`SELECT full_name FROM users WHERE id = $1`, [driverId]);
    const driverName = driverUserRes.rows[0]?.full_name?.trim() || 'Your driver';

    await sendPushNotification(
      order.customer_id,
      'Driver Found!',
      `${driverName} is on the way`,
      { orderId: id, type: 'order_update' }
    );

    await sendPushNotification(
      driverId,
      'Job Confirmed',
      `Navigate to ${order.pickup_address}`,
      { orderId: id, type: 'order_update' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('acceptOrder:', err);
    return res.status(500).json({ error: 'Accept failed' });
  }
}

async function declineOrder(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const { id } = req.params;
    const driverId = req.user.id;
    const result = await db.query(
      `UPDATE job_offers SET status = 'declined' WHERE order_id = $1 AND driver_id = $2 AND status = 'pending' RETURNING id`,
      [id, driverId]
    );
    if (result.rowCount === 0) {
      return res.json({ message: 'No pending offer (already expired or resolved)', alreadyResolved: true });
    }
    return res.json({ message: 'Offer declined' });
  } catch (err) {
    console.error('declineOrder:', err);
    return res.status(500).json({ error: 'Decline failed' });
  }
}

async function pickupArrived(req, res) {
  try {
    const { id } = req.params;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const { rows } = await db.query(
      `SELECT o.*, u.phone AS customer_phone, u.full_name AS customer_name,
              dr.driver_id AS route_driver_id
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });

    const allowedPrior = ['accepted', 'pickup_en_route', 'matching', 'pending'];
    if (!allowedPrior.includes(order.status)) {
      return res.status(400).json({ error: 'Invalid order status for pickup arrival' });
    }

    await db.query(
      `UPDATE orders SET status = 'pickup_arrived', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    let pickupOtp = order.pickup_otp;
    if (!pickupOtp) {
      pickupOtp = String(Math.floor(1000 + Math.random() * 9000));
      await db.query(`UPDATE orders SET pickup_otp = $1 WHERE id = $2`, [pickupOtp, id]);
    }

    if (order.customer_phone) {
      await smsService.sendSMS(
        order.customer_phone,
        'SwiftDrop: Your driver has arrived to collect your parcel.\n\n'
          + `Give this code to the driver:\n*${pickupOtp}*\n\n`
          + 'Do not share this code with anyone else.'
      );
    }

    return res.json({ success: true, message: 'OTP sent to sender' });
  } catch (err) {
    console.error('pickupArrived:', err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

async function deliveryArrived(req, res) {
  try {
    const { id } = req.params;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const { rows } = await db.query(
      `SELECT o.*, u.phone AS customer_phone,
              dr.driver_id AS route_driver_id
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });

    if (order.status !== 'delivery_en_route') {
      return res.status(400).json({ error: 'Invalid order status for delivery arrival' });
    }

    await db.query(
      `UPDATE orders SET status = 'delivery_arrived', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    let deliveryOtp = order.delivery_otp;
    if (!deliveryOtp) {
      deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
      await db.query(`UPDATE orders SET delivery_otp = $1 WHERE id = $2`, [deliveryOtp, id]);
    }

    const recipientPhone = order.recipient_phone || order.customer_phone;

    if (recipientPhone) {
      await smsService.sendSMS(
        recipientPhone,
        'SwiftDrop: Your parcel is being delivered now!\n\n'
          + `Give this code to the driver:\n*${deliveryOtp}*\n\n`
          + 'Do not share with anyone else.'
      );
    }

    return res.json({ success: true, message: 'Delivery OTP sent' });
  } catch (err) {
    console.error('deliveryArrived:', err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const valid = ['pickup_arrived', 'delivery_arrived'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const orderRes = await db.query(
      `SELECT o.*, dr.driver_id AS route_driver_id
       FROM orders o
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });

    const expected = {
      pickup_arrived: ['accepted', 'pickup_en_route'],
      delivery_arrived: ['delivery_en_route'],
    };
    if (!expected[status].includes(order.status)) {
      return res.status(400).json({ error: `Cannot set ${status} from ${order.status}` });
    }

    const newStatus = status === 'pickup_arrived' ? 'pickup_arrived' : 'delivery_arrived';
    await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id]
    );

    if (status === 'pickup_arrived') {
      await sendPushNotification(
        order.customer_id,
        'Driver Has Arrived',
        `Your pickup code is: ${order.pickup_otp}`,
        { orderId: id, type: 'otp_pickup', otp: order.pickup_otp }
      );
    }

    if (status === 'delivery_arrived') {
      const [customerRes, driverRes] = await Promise.all([
        db.query(`SELECT phone FROM users WHERE id = $1`, [order.customer_id]),
        db.query(`SELECT full_name FROM users WHERE id = $1`, [order.driver_id]),
      ]);

      const customerPhone = customerRes.rows[0]?.phone;
      const driverFullName = driverRes.rows[0]?.full_name;

      await sendPushNotification(
        order.customer_id,
        'Driver At Delivery Address',
        `Delivery code: ${order.delivery_otp}`,
        { orderId: id, type: 'otp_delivery', otp: order.delivery_otp }
      );

      if (customerPhone && order.delivery_otp && driverFullName) {
        await smsService.sendDeliveryOTP(customerPhone, order.delivery_otp, driverFullName);
      }
    }

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('updateOrderStatus:', err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

async function confirmPickupOTP(req, res) {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const orderRes = await db.query(
      `SELECT o.*, u.phone AS customer_phone,
              dr.driver_id AS route_driver_id
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'pickup_arrived') return res.status(400).json({ error: 'Invalid order status' });
    if (order.pickup_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    await db.query(
      `UPDATE orders SET status = 'collected', pickup_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await sendPushNotification(
      order.customer_id,
      'Parcel Collected',
      `On the way to ${order.dropoff_address}`,
      { orderId: id, type: 'order_update' }
    );

    if (order.customer_phone) {
      const driverUserRes = await db.query(`SELECT full_name FROM users WHERE id = $1`, [driverId]);
      const driverName = driverUserRes.rows[0]?.full_name?.trim() || 'Your driver';
      const collectedAt = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      await smsService.sendSMS(
        order.customer_phone,
        `SwiftDrop: Your parcel has been collected by ${driverName} at ${collectedAt}.\n`
          + 'Track your delivery in the app.'
      );
    }

    // Driver-side only: offer return load after intercity pickup confirmation.
    await offerReturnLoadAfterIntercityPickup(id, driverId);

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('confirmPickupOTP:', err);
    return res.status(500).json({ error: 'Confirmation failed' });
  }
}

async function confirmDeliveryOTP(req, res) {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const orderRes = await db.query(
      `SELECT o.*, dr.driver_id AS route_driver_id
       FROM orders o
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'delivery_arrived') return res.status(400).json({ error: 'Invalid order status' });
    if (order.delivery_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    await db.query(
      `UPDATE orders SET status = 'delivered', delivery_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await sendPushNotification(
      order.customer_id,
      'Delivered!',
      'Your parcel has been delivered',
      { orderId: id, type: 'delivered' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('confirmDeliveryOTP:', err);
    return res.status(500).json({ error: 'Confirmation failed' });
  }
}

async function uploadPickupPhoto(req, res) {
  try {
    const { id } = req.params;
    const file = req.file;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    if (!file) return res.status(400).json({ error: 'Image file required' });

    const orderRes = await db.query(
      `SELECT o.*, dr.driver_id AS route_driver_id
       FROM orders o
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'collected') return res.status(400).json({ error: 'Confirm pickup OTP first' });

    const result = await uploadImage(file);
    const url = result.secure_url;

    await db.query(
      `UPDATE orders SET pickup_photo_url = $1, status = 'delivery_en_route', updated_at = NOW() WHERE id = $2`,
      [url, id]
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('uploadPickupPhoto:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

async function uploadDeliveryPhoto(req, res) {
  try {
    const { id } = req.params;
    const file = req.file;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    if (!file) return res.status(400).json({ error: 'Image file required' });

    const orderRes = await db.query(
      `SELECT o.*, dr.driver_id AS route_driver_id
       FROM orders o
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!driverMatchesOrderRow(order, driverId)) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Confirm delivery OTP first' });

    const result = await uploadImage(file);
    const url = result.secure_url;

    // Release payment only after delivery photo evidence is successfully uploaded.
    const payout = await releaseEscrow(id);

    await db.query(
      `UPDATE orders SET delivery_photo_url = $1, status = 'completed', updated_at = NOW() WHERE id = $2`,
      [url, id]
    );

    if (order.driver_id) {
      await db.query(
        `INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed)
         VALUES ($1, 'new', 1)
         ON CONFLICT (driver_id) DO UPDATE SET
           deliveries_completed = driver_tiers.deliveries_completed + 1,
           tier_updated_at = NOW()`,
        [order.driver_id]
      );
    }

    const driverAmount = Number(payout?.driverAmount);
    const amtStr = Number.isFinite(driverAmount) ? driverAmount.toFixed(2) : '0.00';
    await sendPushNotification(
      order.driver_id,
      'Payment Received',
      `R${amtStr} added to your earnings`,
      { orderId: id, type: 'payment' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('uploadDeliveryPhoto:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

/** Assigned / historical jobs for the logged-in driver */
async function getDriverOrders(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const rows = await db.query(
      `SELECT o.*, c.full_name AS customer_name, c.phone AS customer_phone
       FROM orders o
       LEFT JOIN users c ON c.id = o.customer_id
       WHERE o.driver_id = $1
       ORDER BY o.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM orders WHERE driver_id = $1`,
      [req.user.id]
    );
    const total = countRes.rows[0]?.c || 0;
    return res.json({ orders: rows.rows, total, page, limit });
  } catch (err) {
    console.error('getDriverOrders:', err);
    return res.status(500).json({ error: 'Failed to fetch driver orders' });
  }
}

/** Summary stats + recent activity for driver home */
async function getDriverDashboard(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;

    const tierRes = await db.query(
      `SELECT tier_name, deliveries_completed, current_rating
       FROM driver_tiers WHERE driver_id = $1`,
      [driverId]
    );
    const tier = tierRes.rows[0] || {
      tier_name: 'new',
      deliveries_completed: 0,
      current_rating: null,
    };

    const todayRes = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status IN ('delivered','completed')
             AND (updated_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
         )::int AS deliveries_today,
         COALESCE(
           SUM(driver_earnings) FILTER (
             WHERE status IN ('delivered','completed')
               AND (updated_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
           ),
           0
         ) AS earnings_today
       FROM orders
       WHERE driver_id = $1`,
      [driverId]
    );
    const today = todayRes.rows[0] || { deliveries_today: 0, earnings_today: 0 };

    const completedRes = await db.query(
      `SELECT COUNT(*)::int AS c
       FROM orders
       WHERE driver_id = $1 AND status IN ('delivered','completed')`,
      [driverId]
    );
    const totalDeliveries = completedRes.rows[0]?.c ?? 0;

    const recentRes = await db.query(
      `SELECT o.id, o.order_number, o.dropoff_address, o.status,
              o.driver_earnings, o.updated_at, o.total_price
       FROM orders o
       WHERE o.driver_id = $1
       ORDER BY o.updated_at DESC
       LIMIT 8`,
      [driverId]
    );

    return res.json({
      user: {
        id: req.user.id,
        full_name: req.user.full_name,
        phone: req.user.phone,
      },
      tier: tier.tier_name,
      deliveries_completed: tier.deliveries_completed,
      current_rating: tier.current_rating != null ? parseFloat(tier.current_rating) : null,
      today: {
        deliveries: today.deliveries_today,
        earnings: parseFloat(today.earnings_today) || 0,
      },
      total_deliveries_completed: totalDeliveries,
      recent_orders: recentRes.rows,
    });
  } catch (err) {
    console.error('getDriverDashboard:', err);
    return res.status(500).json({ error: 'Failed to load driver dashboard' });
  }
}

module.exports = {
  createOrder,
  calculatePrice,
  getOrderById,
  getCustomerStats,
  getCustomerOrders,
  getDriverOrders,
  getDriverDashboard,
  cancelOrder,
  getOrderTracking,
  getPendingOffer,
  acceptOrder,
  declineOrder,
  updateOrderStatus,
  pickupArrived,
  deliveryArrived,
  confirmPickupOTP,
  confirmDeliveryOTP,
  uploadPickupPhoto,
  uploadDeliveryPhoto,
  retryMatching,
};

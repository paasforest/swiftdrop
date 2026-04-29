const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { generateOTP } = require('../utils/otpHelper');
const { runMatching, offerReturnLoadAfterIntercityPickup } = require('../services/matchingService');
const { releaseEscrow } = require('../services/paymentService');
const { sendPushNotification } = require('../services/notificationService');
const smsService = require('../services/smsService');
const { uploadImage } = require('../services/cloudinaryService');
const { hasAvailableSlots } = require('../services/slotService');

// Align with matchingService: drivers below this average rating are excluded (NULL = allowed).
const MIN_DRIVER_RATING_FOR_MATCHING = 3.0;

// Pricing model (April 2026 fuel-cost basis)
const FUEL_COST_PER_KM = 1.88; // given (8L/100km, petrol 95 = R23.50/L)

const URGENCY_MULTIPLIERS = {
  standard: 0.6,
  express: 1.0,
  urgent: 1.4,
};

const VALUE_COMPONENT_BY_PARCEL_VALUE = [
  { max: 199.999, value: 0 },   // Under R200
  { max: 500,     value: 15 },  // R200-R500
  { max: 1000,    value: 25 },  // R501-R1000
  { max: 2000,    value: 40 },  // R1001-R2000
  { max: 5000,    value: 65 },  // R2001-R5000
  { max: Infinity, value: 65 }, // fallback
];

// Minimum PRICE component (excluding `value_component`) by zone+tier
const MIN_TOTAL_BY_ZONE_TIER = {
  'city:standard':          150,
  'city:express':           200,
  'city:urgent':            250,
  'regional:standard':      380,
  'regional:express':       500,
  'regional:urgent':        650,
  'intercity:standard':     500,
  'intercity:express':      700,
  'intercity:urgent':       950,
  'long_distance:standard': 1500,
  'long_distance:express':  2000,
  'long_distance:urgent':   2800,
};

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function zoneForDistance(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return 'city';
  if (d <= 30)  return 'city';
  if (d <= 80)  return 'regional';
  if (d <= 150) return 'intercity';
  return 'long_distance';
}

function floorForZone(distanceKm, zone) {
  const fuel = Number(distanceKm) * FUEL_COST_PER_KM;
  switch (zone) {
    case 'city':          return Math.max(fuel + 100, 150);
    case 'regional':      return Math.max(fuel + 150, 350);
    case 'intercity':     return Math.max(fuel + 80 + 200, 500);
    case 'long_distance': return Math.max(fuel + 200 + 350, 1500);
    default:              return Math.max(fuel + 100, 150);
  }
}

function urgencyMultiplierForTier(tier) {
  const m = URGENCY_MULTIPLIERS[String(tier)];
  return typeof m === 'number' ? m : 1.0;
}

function valueComponentForParcelValue(parcelValue) {
  const v = Number(parcelValue);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const found = VALUE_COMPONENT_BY_PARCEL_VALUE.find((r) => v <= r.max);
  return found ? found.value : 0;
}

function minTotalFor(zone, tier) {
  const k = `${zone}:${tier}`;
  return typeof MIN_TOTAL_BY_ZONE_TIER[k] === 'number' ? MIN_TOTAL_BY_ZONE_TIER[k] : null;
}

function generateOrderNumber() {
  return 'SD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
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
    } = req.body;

    if (!pickup_address || pickup_lat == null || pickup_lng == null ||
        !dropoff_address || dropoff_lat == null || dropoff_lng == null ||
        !delivery_tier) {
      return res.status(400).json({
        error: 'pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, delivery_tier are required',
      });
    }

    if (!['standard', 'express', 'urgent'].includes(delivery_tier)) {
      return res.status(400).json({ error: 'Invalid delivery_tier' });
    }

    // Slot availability check when booking a specific driver trip
    if (assigned_driver_route_id) {
      const { rows: routeRows } = await db.query(
        `SELECT max_parcels FROM driver_routes WHERE id = $1 AND status = 'active'`,
        [assigned_driver_route_id]
      );
      if (!routeRows[0]) {
        return res.status(400).json({
          error: 'This trip is no longer available.',
          code: 'TRIP_NOT_FOUND',
        });
      }
      const available = await hasAvailableSlots(
        assigned_driver_route_id,
        routeRows[0].max_parcels,
        parcel_size
      );
      if (!available) {
        return res.status(400).json({
          error: 'Sorry this trip is now full. Please choose another trip.',
          code: 'TRIP_FULL',
        });
      }
    }

    const dist = haversineKm(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(dropoff_lat), parseFloat(dropoff_lng)
    );

    const zone = zoneForDistance(dist);
    const floor = floorForZone(dist, zone);
    const urgency = urgencyMultiplierForTier(delivery_tier);
    const driverEarningsRaw = floor * urgency;
    const valueComponentRaw = valueComponentForParcelValue(parcel_value);

    const minPriceComponent = minTotalFor(zone, delivery_tier);
    const priceComponentRaw = driverEarningsRaw * 1.2;
    const priceComponentFinal =
      minPriceComponent != null ? Math.max(priceComponentRaw, minPriceComponent) : priceComponentRaw;

    const driverEarningsFinal = priceComponentFinal / 1.2;
    const commissionRaw = priceComponentFinal - driverEarningsFinal;
    const insuranceFeeRaw = valueComponentRaw;
    const basePriceRaw = priceComponentFinal;
    const totalPriceRaw = priceComponentFinal + valueComponentRaw;

    const basePrice      = roundMoney(basePriceRaw);
    const insuranceFee   = roundMoney(insuranceFeeRaw);
    const commission     = roundMoney(commissionRaw);
    const driverEarnings = roundMoney(driverEarningsFinal);
    const totalPrice     = roundMoney(totalPriceRaw);

    const pickupOtp   = generateOTP();
    const deliveryOtp = generateOTP();
    const orderNumber = generateOrderNumber();
    const customerId  = req.user.id;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      if (payment_method === 'wallet') {
        const balRes = await client.query(
          `SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
          [customerId]
        );
        const row = balRes.rows[0];
        if (!row) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'User not found' });
        }
        const balance = parseFloat(row.wallet_balance) || 0;
        if (balance < totalPrice) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
      }

      const orderRes = await client.query(
        `INSERT INTO orders (
          order_number, customer_id, pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng, parcel_type, parcel_size, parcel_value,
          special_handling, delivery_tier, status, base_price, insurance_fee, total_price,
          commission_amount, driver_earnings, pickup_otp, delivery_otp,
          assigned_driver_route_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'matching',$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING *`,
        [
          orderNumber, customerId, pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng, parcel_type || null, parcel_size || null,
          parcel_value || null, special_handling || null, delivery_tier,
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

      if (payment_method === 'wallet') {
        await client.query(
          `UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`,
          [totalPrice, customerId]
        );
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
           VALUES ($1, 'debit', $2, $3, 'Order payment')`,
          [customerId, totalPrice, orderNumber]
        );
      }

      await client.query('COMMIT');

      runMatching(order.id);

      return res.status(201).json({
        ...order,
        price_breakdown: {
          base_price:      basePrice,
          insurance_fee:   insuranceFee,
          commission:      commission,
          driver_earnings: driverEarnings,
          total:           totalPrice,
        },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('createOrder:', err);
    return res.status(500).json({ error: 'Order creation failed' });
  }
}

async function calculatePrice(req, res) {
  try {
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, parcel_value } = req.body;
    if (pickup_lat == null || pickup_lng == null || dropoff_lat == null || dropoff_lng == null) {
      return res.status(400).json({ error: 'pickup and dropoff coordinates required' });
    }

    const dist = haversineKm(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(dropoff_lat), parseFloat(dropoff_lng)
    );

    const zone  = zoneForDistance(dist);
    const floor = floorForZone(dist, zone);
    const value_component = valueComponentForParcelValue(parcel_value);

    const activeOrderStatuses = [
      'matching', 'accepted', 'pickup_en_route', 'pickup_arrived',
      'collected', 'delivery_en_route', 'delivery_arrived',
    ];

    async function checkStandardAvailability() {
      const threeHoursFromNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const ROUTE_RADIUS_KM = 15;
      const routesRes = await db.query(
        `SELECT dr.*, dt.current_rating
         FROM driver_routes dr
         JOIN driver_locations dl ON dl.driver_id = dr.driver_id AND dl.is_online = true
         JOIN driver_profiles dp ON dp.user_id = dr.driver_id AND dp.verification_status = 'approved'
         LEFT JOIN driver_tiers dt ON dt.driver_id = dr.driver_id
         JOIN users u ON u.id = dr.driver_id AND u.is_active = true
         WHERE dr.status = 'active' AND dr.departure_time <= $1
           AND (dt.current_rating IS NULL OR dt.current_rating >= $2)`,
        [threeHoursFromNow, MIN_DRIVER_RATING_FOR_MATCHING]
      );
      const pickupLat  = parseFloat(pickup_lat);
      const pickupLng  = parseFloat(pickup_lng);
      const dropoffLat = parseFloat(dropoff_lat);
      const dropoffLng = parseFloat(dropoff_lng);
      return (routesRes.rows || []).some((r) => {
        const fromDist = haversineKm(pickupLat, pickupLng, parseFloat(r.from_lat), parseFloat(r.from_lng));
        const toDist   = haversineKm(dropoffLat, dropoffLng, parseFloat(r.to_lat), parseFloat(r.to_lng));
        return fromDist <= ROUTE_RADIUS_KM && toDist <= ROUTE_RADIUS_KM;
      });
    }

    async function checkExpressAvailability(radiusKm) {
      const pickupLat = parseFloat(pickup_lat);
      const pickupLng = parseFloat(pickup_lng);
      const driversRes = await db.query(
        `SELECT dl.driver_id, dl.lat, dl.lng, dt.current_rating
         FROM driver_locations dl
         JOIN driver_profiles dp ON dp.user_id = dl.driver_id AND dp.verification_status = 'approved'
         LEFT JOIN driver_tiers dt ON dt.driver_id = dl.driver_id
         JOIN users u ON u.id = dl.driver_id AND u.is_active = true
         WHERE dl.is_online = true AND dl.lat IS NOT NULL AND dl.lng IS NOT NULL
           AND (dt.current_rating IS NULL OR dt.current_rating >= $2)
           AND NOT EXISTS (
             SELECT 1 FROM orders o
               WHERE o.driver_id = dl.driver_id AND o.status = ANY($1)
           )`,
        [activeOrderStatuses, MIN_DRIVER_RATING_FOR_MATCHING]
      );
      return (driversRes.rows || []).some((d) => {
        const distToPickup = haversineKm(pickupLat, pickupLng, parseFloat(d.lat), parseFloat(d.lng));
        return distToPickup <= radiusKm;
      });
    }

    await Promise.all([
      checkStandardAvailability().catch(() => false),
      checkExpressAvailability(25).catch(() => false),
      checkExpressAvailability(60).catch(() => false),
    ]);

    function roundToInt(n) {
      const x = Number(n);
      if (!Number.isFinite(x)) return 0;
      return Math.round(x);
    }

    function buildTierResponse(tier, time) {
      const urgency = urgencyMultiplierForTier(tier);
      const driver_earns_candidate   = floor * urgency;
      const price_component_candidate = driver_earns_candidate * 1.2;
      const minPriceComponent = minTotalFor(zone, tier);
      const price_component_final =
        minPriceComponent != null ? Math.max(price_component_candidate, minPriceComponent) : price_component_candidate;
      const driver_earns_final = price_component_final / 1.2;
      return {
        price:       roundToInt(price_component_final),
        driver_earns: roundToInt(driver_earns_final),
        time,
        available:   true,
      };
    }

    return res.json({
      distance_km:         roundMoney(dist),
      zone,
      standard:            buildTierResponse('standard', '2-5 hours'),
      express:             buildTierResponse('express',  '1-2 hours'),
      urgent:              buildTierResponse('urgent',   'Under 1 hour'),
      value_component:     roundToInt(value_component),
      protection_included: 'R500 basic cover',
      upgrade_options:     Number(parcel_value) > 500 ? { r2000_cover: 25, r5000_cover: 65 } : {},
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
          dp.vehicle_make, dp.vehicle_model, dp.vehicle_color,
          dp.vehicle_year, dp.vehicle_plate,
          COALESCE(dt.deliveries_completed, 0) AS driver_deliveries_completed,
          COALESCE(dt.current_rating, 0.0) AS driver_rating
       FROM orders o
       LEFT JOIN users u ON u.id = o.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = o.driver_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && order.driver_id !== req.user.id && req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json(order);
  } catch (err) {
    console.error('getOrderById:', err);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
}

async function getCustomerOrders(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params = [req.user.id];
    let where = 'WHERE o.customer_id = $1';
    if (status) {
      params.push(status);
      where += ` AND o.status = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT o.*, u.full_name AS driver_name FROM orders o
       LEFT JOIN users u ON u.id = o.driver_id
       ${where}
       ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM orders o ${where}`,
      params
    );
    return res.json({ orders: rows.rows, total: countRes.rows[0]?.c || 0, page, limit });
  } catch (err) {
    console.error('getCustomerOrders:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function cancelOrder(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT o.*, dr.departure_time AS route_departure_time,
              p.amount AS paid_amount, p.payment_gateway_ref, p.escrow_status
       FROM orders o
       LEFT JOIN driver_routes dr ON dr.id = o.assigned_driver_route_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = $1 AND o.customer_id = $2`,
      [id, req.user.id]
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (['collected', 'delivery_en_route', 'delivery_arrived', 'delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot cancel after parcel has been collected.' });
    }

    // Refund allowed unless within 2 hours of a scheduled trip departure
    let refundable = true;
    if (order.route_departure_time) {
      const hoursUntilDeparture = (new Date(order.route_departure_time) - new Date()) / (1000 * 60 * 60);
      if (hoursUntilDeparture < 2) {
        refundable = false;
      }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [id]
      );

      if (refundable && order.escrow_status === 'held') {
        await client.query(
          `UPDATE payments
           SET escrow_status = 'refunded', payout_status = 'refunded', updated_at = NOW()
           WHERE order_id = $1`,
          [id]
        );

        await client.query(
          `UPDATE users
           SET wallet_balance = COALESCE(wallet_balance, 0) + $1, updated_at = NOW()
           WHERE id = $2`,
          [order.total_price, order.customer_id]
        );

        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
           VALUES ($1, 'credit', $2, $3, 'Refund — cancelled order')`,
          [order.customer_id, order.total_price, `REFUND-${order.order_number}`]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (order.driver_id) {
      await sendPushNotification(
        order.driver_id,
        'Booking Cancelled',
        'A parcel booking for your trip has been cancelled.'
      ).catch(() => {});
    }

    return res.json({
      success:  true,
      refunded: refundable,
      message:  refundable
        ? 'Order cancelled and refund processed.'
        : 'Order cancelled. No refund — cancellation within 2 hours of departure.',
      refund:   refundable ? order.total_price : 0,
    });
  } catch (err) {
    console.error('cancelOrder:', err);
    return res.status(500).json({ error: 'Cancel failed' });
  }
}

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
      `SELECT o.*, o.driver_current_lat AS lat, o.driver_current_lng AS lng, o.driver_last_seen_at
       FROM orders o WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && order.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({
      lat:          order.lat ? parseFloat(order.lat) : null,
      lng:          order.lng ? parseFloat(order.lng) : null,
      last_seen_at: order.driver_last_seen_at,
    });
  } catch (err) {
    console.error('getOrderTracking:', err);
    return res.status(500).json({ error: 'Failed to fetch tracking' });
  }
}

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
    if (r.rows.length === 0) return res.json({ offer: null });

    const row = r.rows[0];
    const dist = haversineKm(
      parseFloat(row.pickup_lat), parseFloat(row.pickup_lng),
      parseFloat(row.dropoff_lat), parseFloat(row.dropoff_lng)
    );
    const zone = zoneForDistance(dist);
    const timeEstimateMinutes = Math.max(15, Math.round(15 + dist * 1.2));
    const expiresAt = row.expires_at;
    const offerExpiresIso = expiresAt instanceof Date ? expiresAt.toISOString() : new Date(expiresAt).toISOString();

    return res.json({
      offer: {
        orderId:           row.order_id,
        pickup_address:    row.pickup_address,
        dropoff_address:   row.dropoff_address,
        distance_km:       Math.round(dist * 10) / 10,
        zone,
        driver_earns:      parseFloat(row.driver_earnings) || 0,
        parcel_type:       row.parcel_type || '',
        parcel_size:       row.parcel_size || '',
        time_estimate:     `${timeEstimateMinutes} min`,
        special_handling:  row.special_handling || null,
        offer_expires_at:  offerExpiresIso,
      },
    });
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

    const client = await db.pool.connect();
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

    await sendPushNotification(order.customer_id, 'Driver Found!', `${driverName} is on the way`,
      { orderId: id, type: 'order_update' });
    await sendPushNotification(driverId, 'Job Confirmed', `Navigate to ${order.pickup_address}`,
      { orderId: id, type: 'order_update' });

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
      `UPDATE job_offers SET status = 'declined'
       WHERE order_id = $1 AND driver_id = $2 AND status = 'pending'
       RETURNING id`,
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

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const valid = ['pickup_arrived', 'delivery_arrived'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });

    const expected = {
      pickup_arrived:   ['accepted', 'pickup_en_route'],
      delivery_arrived: ['delivery_en_route'],
    };
    if (!expected[status].includes(order.status)) {
      return res.status(400).json({ error: `Cannot set ${status} from ${order.status}` });
    }

    await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
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
      const customerPhone  = customerRes.rows[0]?.phone;
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

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'pickup_arrived') return res.status(400).json({ error: 'Invalid order status' });
    if (order.pickup_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    await db.query(
      `UPDATE orders SET status = 'collected', pickup_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await sendPushNotification(order.customer_id, 'Parcel Collected', `On the way to ${order.dropoff_address}`,
      { orderId: id, type: 'order_update' });
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

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'delivery_arrived') return res.status(400).json({ error: 'Invalid order status' });
    if (order.delivery_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    await db.query(
      `UPDATE orders SET status = 'delivered', delivery_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await sendPushNotification(order.customer_id, 'Delivered!', 'Your parcel has been delivered',
      { orderId: id, type: 'delivered' });

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

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
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

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Confirm delivery OTP first' });

    const result = await uploadImage(file);
    const url = result.secure_url;
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
    await sendPushNotification(order.driver_id, 'Payment Received', `R${amtStr} added to your earnings`,
      { orderId: id, type: 'payment' });

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('uploadDeliveryPhoto:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

async function getDriverOrders(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
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
    return res.json({ orders: rows.rows, total: countRes.rows[0]?.c || 0, page, limit });
  } catch (err) {
    console.error('getDriverOrders:', err);
    return res.status(500).json({ error: 'Failed to fetch driver orders' });
  }
}

async function getDriverDashboard(req, res) {
  try {
    if (req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }
    const driverId = req.user.id;

    const tierRes = await db.query(
      `SELECT tier_name, deliveries_completed, current_rating FROM driver_tiers WHERE driver_id = $1`,
      [driverId]
    );
    const tier = tierRes.rows[0] || { tier_name: 'new', deliveries_completed: 0, current_rating: null };

    const todayRes = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status IN ('delivered','completed')
             AND (updated_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
         )::int AS deliveries_today,
         COALESCE(SUM(driver_earnings) FILTER (
           WHERE status IN ('delivered','completed')
             AND (updated_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
         ), 0) AS earnings_today
       FROM orders WHERE driver_id = $1`,
      [driverId]
    );
    const today = todayRes.rows[0] || { deliveries_today: 0, earnings_today: 0 };

    const completedRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM orders WHERE driver_id = $1 AND status IN ('delivered','completed')`,
      [driverId]
    );

    const recentRes = await db.query(
      `SELECT o.id, o.order_number, o.dropoff_address, o.status,
              o.driver_earnings, o.updated_at, o.total_price
       FROM orders o
       WHERE o.driver_id = $1
       ORDER BY o.updated_at DESC LIMIT 8`,
      [driverId]
    );

    return res.json({
      user: { id: req.user.id, full_name: req.user.full_name, phone: req.user.phone },
      tier:               tier.tier_name,
      deliveries_completed: tier.deliveries_completed,
      current_rating:     tier.current_rating != null ? parseFloat(tier.current_rating) : null,
      today: {
        deliveries: today.deliveries_today,
        earnings:   parseFloat(today.earnings_today) || 0,
      },
      total_deliveries_completed: completedRes.rows[0]?.c ?? 0,
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
  getCustomerOrders,
  getDriverOrders,
  getDriverDashboard,
  cancelOrder,
  getOrderTracking,
  getPendingOffer,
  acceptOrder,
  declineOrder,
  updateOrderStatus,
  confirmPickupOTP,
  confirmDeliveryOTP,
  uploadPickupPhoto,
  uploadDeliveryPhoto,
  retryMatching,
};

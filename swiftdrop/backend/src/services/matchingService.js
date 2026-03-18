const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { sendPushNotification } = require('./notificationService');

const OFFER_TIMEOUT_MS = 15000;
const ROUTE_RADIUS_KM = 15;
const NEARBY_RADIUS_KM = 10;
const INTERCITY_RADIUS_KM = 30;
const MAX_NEARBY_DRIVERS = 5;

async function getOrder(orderId) {
  const r = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  return r.rows[0];
}

async function findRouteRiders(order) {
  const pickupLat = parseFloat(order.pickup_lat);
  const pickupLng = parseFloat(order.pickup_lng);
  const dropoffLat = parseFloat(order.dropoff_lat);
  const dropoffLng = parseFloat(order.dropoff_lng);
  const threeHoursFromNow = new Date(Date.now() + 3 * 60 * 60 * 1000);

  const routes = await db.query(
    `SELECT dr.*, u.full_name, dt.current_rating
     FROM driver_routes dr
     JOIN driver_locations dl ON dl.driver_id = dr.driver_id AND dl.is_online = true
     JOIN driver_profiles dp ON dp.user_id = dr.driver_id AND dp.verification_status = 'approved'
     LEFT JOIN driver_tiers dt ON dt.driver_id = dr.driver_id
     JOIN users u ON u.id = dr.driver_id AND u.is_active = true
     WHERE dr.status = 'active' AND dr.departure_time <= $1
       AND (dt.current_rating IS NULL OR dt.current_rating >= 4.0)`,
    [threeHoursFromNow]
  );

  const matching = routes.rows.filter((r) => {
    const fromDist = haversineKm(pickupLat, pickupLng, parseFloat(r.from_lat), parseFloat(r.from_lng));
    const toDist = haversineKm(dropoffLat, dropoffLng, parseFloat(r.to_lat), parseFloat(r.to_lng));
    return fromDist <= ROUTE_RADIUS_KM && toDist <= ROUTE_RADIUS_KM;
  });

  return matching.map((r) => r.driver_id);
}

async function findNearbyDrivers(order, radiusKm) {
  const pickupLat = parseFloat(order.pickup_lat);
  const pickupLng = parseFloat(order.pickup_lng);

  const drivers = await db.query(
    `SELECT dl.driver_id, dl.lat, dl.lng, u.full_name, dt.current_rating
     FROM driver_locations dl
     JOIN driver_profiles dp ON dp.user_id = dl.driver_id AND dp.verification_status = 'approved'
     LEFT JOIN driver_tiers dt ON dt.driver_id = dl.driver_id
     JOIN users u ON u.id = dl.driver_id AND u.is_active = true
     WHERE dl.is_online = true AND dl.lat IS NOT NULL AND dl.lng IS NOT NULL
       AND (dt.current_rating IS NULL OR dt.current_rating >= 4.0)
       AND NOT EXISTS (
         SELECT 1 FROM orders o WHERE o.driver_id = dl.driver_id
           AND o.status IN ('matching','accepted','pickup_en_route','pickup_arrived','collected','delivery_en_route','delivery_arrived')
       )`
  );

  const withDist = drivers.rows
    .map((d) => ({
      driver_id: d.driver_id,
      dist: haversineKm(pickupLat, pickupLng, parseFloat(d.lat), parseFloat(d.lng)),
    }))
    .filter((d) => d.dist <= radiusKm)
    .sort((a, b) => a.dist - b.dist);

  return withDist.map((d) => d.driver_id);
}

async function createJobOffers(orderId, driverIds) {
  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS);
  for (const driverId of driverIds) {
    await db.query(
      `INSERT INTO job_offers (order_id, driver_id, status, expires_at) VALUES ($1, $2, 'pending', $3)`,
      [orderId, driverId, expiresAt]
    );
  }
}

async function expireJobOffers(orderId) {
  await db.query(
    `UPDATE job_offers SET status = 'expired' WHERE order_id = $1 AND status = 'pending'`
  );
}

async function notifyDriversNewOffer(driverIds, order) {
  const msg = `New delivery: ${order.pickup_address} to ${order.dropoff_address} — Earn R${order.driver_earnings || order.total_price}. Accept within 15 seconds.`;
  for (const driverId of driverIds) {
    await sendPushNotification(driverId, 'New Job Offer', msg, {
      orderId: order.id,
      orderNumber: order.order_number,
      type: 'job_offer',
    });
  }
}

async function notifyCustomerNoDriver(customerId, order) {
  await sendPushNotification(
    customerId,
    'No driver available',
    'No driver available right now. We will keep trying or you can cancel for a full refund.',
    { orderId: order.id, type: 'no_driver' }
  );
}

async function tryStep1(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  const riderIds = await findRouteRiders(order);
  if (riderIds.length > 0) {
    await createJobOffers(orderId, riderIds);
    await notifyDriversNewOffer(riderIds, order);
    setTimeout(() => checkAndContinue(orderId, 1), OFFER_TIMEOUT_MS);
    return;
  }
  setTimeout(() => tryStep2(orderId), 0);
}

async function tryStep2(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  await expireJobOffers(orderId);
  const driverIds = await findNearbyDrivers(order, NEARBY_RADIUS_KM);
  const toOffer = driverIds.slice(0, MAX_NEARBY_DRIVERS);

  if (toOffer.length === 0) {
    setTimeout(() => tryStep3(orderId), 0);
    return;
  }

  await offerToDriversOneByOne(orderId, toOffer, 0, () => tryStep3(orderId));
}

async function offerToDriversOneByOne(orderId, driverIds, index, onExhausted) {
  if (index >= driverIds.length) {
    onExhausted();
    return;
  }
  const driverId = driverIds[index];
  await createJobOffers(orderId, [driverId]);
  const order = await getOrder(orderId);
  await notifyDriversNewOffer([driverId], order);

  setTimeout(async () => {
    const o = await getOrder(orderId);
    if (o.driver_id || o.status !== 'matching') return;
    await expireJobOffers(orderId);
    offerToDriversOneByOne(orderId, driverIds, index + 1, onExhausted);
  }, OFFER_TIMEOUT_MS);
}

async function tryStep3(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  await expireJobOffers(orderId);
  const driverIds = await findNearbyDrivers(order, INTERCITY_RADIUS_KM);
  const toOffer = driverIds.slice(0, MAX_NEARBY_DRIVERS);

  if (toOffer.length === 0) {
    tryStep4(orderId);
    return;
  }

  if (order.delivery_tier !== 'urgent') {
    const dist = haversineKm(
      parseFloat(order.pickup_lat), parseFloat(order.pickup_lng),
      parseFloat(order.dropoff_lat), parseFloat(order.dropoff_lng)
    );
    const basePrice = 250 + dist * 1.8;
    const commission = basePrice * 0.15;
    const driverEarnings = basePrice - commission;
    const insuranceFee = parseFloat(order.insurance_fee) || 0;
    const totalPrice = basePrice + insuranceFee;
    await db.query(
      `UPDATE orders SET delivery_tier = 'urgent', base_price = $1, commission_amount = $2,
       driver_earnings = $3, total_price = $4, updated_at = NOW() WHERE id = $5`,
      [basePrice, commission, driverEarnings, totalPrice, orderId]
    );
  }

  await offerToDriversOneByOne(orderId, toOffer, 0, () => tryStep4(orderId));
}

async function tryStep4(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  await db.query(
    `UPDATE orders SET status = 'unmatched', updated_at = NOW() WHERE id = $1`,
    [orderId]
  );
  await notifyCustomerNoDriver(order.customer_id, order);
}

async function checkAndContinue(orderId, step) {
  const order = await getOrder(orderId);
  if (order.driver_id) return;
  if (order.status !== 'matching') return;
  await expireJobOffers(orderId);
  if (step === 1) setTimeout(() => tryStep2(orderId), 0);
}

function runMatching(orderId) {
  tryStep1(orderId).catch((err) => console.error('Matching error:', err));
}

module.exports = { runMatching };

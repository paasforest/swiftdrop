const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { sendPushNotification } = require('./notificationService');

/** Driver job-offer window (production). Do not raise for testing — use a branch or env if needed. */
const OFFER_TIMEOUT_MS = 15000; // 15 seconds
const ROUTE_RADIUS_KM = 15;
/** Wider radii — 10/30km was too tight for sparse or misaligned GPS vs pickup. */
const NEARBY_RADIUS_KM = 25;
const INTERCITY_RADIUS_KM = 60;
const MAX_NEARBY_DRIVERS = 5;
/** New / low-volume drivers: allow 3.0+ (still exclude very poor if rated). */
const MIN_DRIVER_RATING = 3.0;
const RETURN_LOAD_OFFER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function zoneForDistance(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return 'city';
  if (d <= 30) return 'city';
  if (d <= 80) return 'regional';
  if (d <= 150) return 'intercity';
  return 'long_distance';
}

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
       AND (dt.current_rating IS NULL OR dt.current_rating >= $2)`,
    [threeHoursFromNow, MIN_DRIVER_RATING]
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
       AND (dt.current_rating IS NULL OR dt.current_rating >= $1)
       AND NOT EXISTS (
         SELECT 1 FROM orders o WHERE o.driver_id = dl.driver_id
           AND o.status IN ('matching','accepted','pickup_en_route','pickup_arrived','collected','delivery_en_route','delivery_arrived')
       )`,
    [MIN_DRIVER_RATING]
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
    console.log('[Matching] Offering job to driver:', driverId);
    await db.query(
      `INSERT INTO job_offers (order_id, driver_id, status, expires_at) VALUES ($1, $2, 'pending', $3)`,
      [orderId, driverId, expiresAt]
    );
  }
}

async function expireJobOffers(orderId) {
  await db.query(
    `UPDATE job_offers SET status = 'expired' WHERE order_id = $1 AND status = 'pending'`,
    [orderId]
  );
}

async function notifyDriversNewOffer(driverIds, order) {
  const earn = Number(order.driver_earnings || order.total_price || 0);
  const amountStr = Number.isFinite(earn) ? earn.toFixed(2) : '0.00';
  const title = 'New Delivery Job!';
  const body = `Earn R${amountStr} — ${order.pickup_address} to ${order.dropoff_address}`;
  for (const driverId of driverIds) {
    await sendPushNotification(driverId, title, body, {
      orderId: order.id,
      orderNumber: order.order_number,
      type: 'job_offer',
    });
  }
}

async function notifyCustomerNoDriver(customerId, order) {
  await sendPushNotification(
    customerId,
    'No Driver Available',
    'Still searching. Cancel for full refund.',
    { orderId: order.id, type: 'unmatched' }
  );
}

async function tryStep1(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  const riderIds = await findRouteRiders(order);
  console.log('[Matching] Route riders found:', riderIds.length);
  if (riderIds.length > 0) {
    await createJobOffers(orderId, riderIds);
    await notifyDriversNewOffer(riderIds, order);
    setTimeout(() => checkAndContinue(orderId, 1), OFFER_TIMEOUT_MS);
    return;
  }
  console.log('[Matching] No drivers available (route match); trying nearby…');
  setTimeout(() => tryStep2(orderId), 0);
}

async function tryStep2(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  await expireJobOffers(orderId);
  const driverIds = await findNearbyDrivers(order, NEARBY_RADIUS_KM);
  console.log('[Matching] Drivers found (nearby 10km):', driverIds.length);
  const toOffer = driverIds.slice(0, MAX_NEARBY_DRIVERS);

  if (toOffer.length === 0) {
    console.log('[Matching] No drivers available (nearby); widening search…');
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
  console.log('[Matching] Drivers found (intercity 30km):', driverIds.length);
  const toOffer = driverIds.slice(0, MAX_NEARBY_DRIVERS);

  if (toOffer.length === 0) {
    console.log('[Matching] No drivers available (intercity); marking unmatched');
    tryStep4(orderId);
    return;
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
  console.log('[Matching] Starting for order:', orderId);
  tryStep1(orderId).catch((err) => console.error('Matching error:', err));
}

async function offerReturnLoadAfterIntercityPickup(orderId, driverId) {
  const order = await getOrder(orderId);
  if (!order) return;
  if (!driverId) return;

  const pickupLat = parseFloat(order.pickup_lat);
  const pickupLng = parseFloat(order.pickup_lng);
  const dropoffLat = parseFloat(order.dropoff_lat);
  const dropoffLng = parseFloat(order.dropoff_lng);
  if (![pickupLat, pickupLng, dropoffLat, dropoffLng].every((x) => Number.isFinite(x))) return;

  const dist = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const zone = zoneForDistance(dist);
  if (zone !== 'intercity') return;

  // Find an unassigned order that is roughly the opposite direction:
  // - candidate pickup is within 20km of the current order dropoff
  // - candidate dropoff is within 20km of the current order pickup
  // This keeps return load driver-side only (customer pricing is unaffected).
  const candidatesRes = await db.query(
    `SELECT id, order_number,
            pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
            status, driver_earnings
     FROM orders
     WHERE id != $1
       AND driver_id IS NULL
       AND status IN ('matching','unmatched','pending')
     ORDER BY created_at DESC
     LIMIT 30`,
    [orderId]
  );

  const candidates = candidatesRes.rows || [];
  const oppositeOrders = candidates
    .map((c) => {
      const cPickupLat = parseFloat(c.pickup_lat);
      const cPickupLng = parseFloat(c.pickup_lng);
      const cDropoffLat = parseFloat(c.dropoff_lat);
      const cDropoffLng = parseFloat(c.dropoff_lng);
      if (![cPickupLat, cPickupLng, cDropoffLat, cDropoffLng].every((x) => Number.isFinite(x))) return null;

      const distPickupToPickup = haversineKm(dropoffLat, dropoffLng, cPickupLat, cPickupLng);
      const distDropoffToPickup = haversineKm(pickupLat, pickupLng, cDropoffLat, cDropoffLng);
      return {
        candidate: c,
        distPickupToPickup,
        distDropoffToPickup,
        score: distPickupToPickup + distDropoffToPickup,
      };
    })
    .filter(Boolean)
    .filter((x) => x.distPickupToPickup <= 20 && x.distDropoffToPickup <= 20)
    .sort((a, b) => a.score - b.score);

  const best = oppositeOrders[0]?.candidate;
  if (!best) return;

  const existing = await db.query(
    `SELECT id FROM job_offers
     WHERE order_id = $1 AND driver_id = $2 AND status = 'pending'`,
    [best.id, driverId]
  );
  if (existing.rows.length > 0) return;

  // Ensure it's in `matching` state so the driver can accept it using the
  // existing accept endpoint.
  if (String(best.status) !== 'matching') {
    await db.query(`UPDATE orders SET status = 'matching', updated_at = NOW() WHERE id = $1`, [best.id]);
  }

  const expiresAt = new Date(Date.now() + RETURN_LOAD_OFFER_TIMEOUT_MS);
  await db.query(
    `INSERT INTO job_offers (order_id, driver_id, status, expires_at)
     VALUES ($1, $2, 'pending', $3)`,
    [best.id, driverId, expiresAt]
  );

  const earnAmount = Number(best.driver_earnings) || Number(order.driver_earnings) || Number(best.total_price) || 0;
  const earnText = Number.isFinite(earnAmount) ? earnAmount.toFixed(2) : '0.00';

  await sendPushNotification(
    driverId,
    'Return Load Available',
    `Earn R${earnText} on your way back`,
    { orderId: best.id, type: 'return_load', returnLoadForOrderId: orderId }
  );
}

module.exports = { runMatching, offerReturnLoadAfterIntercityPickup };

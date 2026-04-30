const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { sendPushNotification } = require('./notificationService');
const { detectProvince } = require('./provinceService');

/** Driver job-offer window (production). */
const OFFER_TIMEOUT_MS = 15000;
const MAX_NEARBY_DRIVERS = 5;
const MIN_DRIVER_RATING = 3.0;
const MAX_MATCH_DISTANCE_KM = 50;
const LOCATION_MAX_AGE_MINUTES = 5;
const RETURN_LOAD_OFFER_TIMEOUT_MS = 15 * 60 * 1000;
const activeMatchingRuns = new Map();

/** Full cascade retries before marking unmatched. */
const MAX_MATCHING_ATTEMPTS = 6;
const MATCHING_RETRY_DELAY_MS = 30000;

function zoneForDistance(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return 'city';
  if (d <= 30) return 'city';
  if (d <= 80) return 'regional';
  if (d <= 150) return 'intercity';
  return 'long_distance';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrder(orderId) {
  const r = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  return r.rows[0];
}

async function pollUntilMatchedOrTimeout(orderId, timeoutMs) {
  const pollInterval = 1000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const o = await getOrder(orderId);
    if (o?.driver_id) return true;
    if (!o || o.status !== 'matching') return false;
    const left = deadline - Date.now();
    if (left <= 0) break;
    await sleep(Math.min(pollInterval, left));
  }
  const o = await getOrder(orderId);
  return !!(o && o.driver_id);
}

/**
 * Nearest online drivers to order pickup (same province, within MAX_MATCH_DISTANCE_KM).
 * @param {object} order — needs pickup_lat, pickup_lng, province, declined_driver_ids (optional)
 */
async function findNearestDrivers(order, extraExcludedDriverIds = []) {
  const pickupLat = parseFloat(order.pickup_lat);
  const pickupLng = parseFloat(order.pickup_lng);
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return [];
  const province = order.province;
  if (!province) return [];

  const excludedIds = [
    ...(Array.isArray(order.declined_driver_ids) ? order.declined_driver_ids : []),
    ...(Array.isArray(extraExcludedDriverIds) ? extraExcludedDriverIds : []),
  ]
    .map((id) => Number(id))
    .filter(Number.isFinite);
  const excluded = excludedIds.length > 0 ? [...new Set(excludedIds)] : null;

  const { rows } = await db.query(
    `SELECT dl.driver_id, dl.lat, dl.lng, u.full_name, u.phone, u.profile_photo_url,
            dt.current_rating
     FROM driver_locations dl
     JOIN users u ON u.id = dl.driver_id AND u.user_type = 'driver' AND u.is_active = true
     JOIN driver_profiles dp ON dp.user_id = dl.driver_id AND dp.verification_status = 'approved'
     LEFT JOIN driver_tiers dt ON dt.driver_id = dl.driver_id
     WHERE dl.is_online = true
       AND dl.lat IS NOT NULL AND dl.lng IS NOT NULL
       AND dl.updated_at > NOW() - ($1::int * INTERVAL '1 minute')
       AND (dt.current_rating IS NULL OR dt.current_rating >= $2)
       AND NOT EXISTS (
         SELECT 1 FROM orders o
         WHERE o.driver_id = dl.driver_id
           AND o.status IN (
             'accepted',
             'pickup_en_route',
             'pickup_arrived',
             'collected',
             'delivery_en_route',
             'delivery_arrived'
           )
       )
       AND NOT EXISTS (
         SELECT 1
         FROM job_offers jo
         INNER JOIN orders offer_order ON offer_order.id = jo.order_id
         WHERE jo.driver_id = dl.driver_id
           AND jo.status = 'pending'
           AND jo.expires_at > NOW()
           AND offer_order.status = 'matching'
       )
       AND ($3::integer[] IS NULL OR dl.driver_id != ALL($3::integer[]))`,
    [LOCATION_MAX_AGE_MINUTES, MIN_DRIVER_RATING, excluded]
  );

  const withDist = [];
  for (const d of rows) {
    const lat = parseFloat(d.lat);
    const lng = parseFloat(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (detectProvince(lat, lng) !== province) continue;
    const distanceKm = haversineKm(pickupLat, pickupLng, lat, lng);
    if (distanceKm > MAX_MATCH_DISTANCE_KM) continue;
    withDist.push({
      driver_id: d.driver_id,
      distanceKm,
      full_name: d.full_name,
      phone: d.phone,
      profile_photo_url: d.profile_photo_url,
      current_rating: d.current_rating,
    });
  }

  withDist.sort((a, b) => a.distanceKm - b.distanceKm);
  return withDist.slice(0, MAX_NEARBY_DRIVERS);
}

async function createJobOffers(orderId, driverIds, { matchedVia = null } = {}) {
  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS);
  for (const driverId of driverIds) {
    console.log('[Matching] Offering job to driver:', driverId);
    await db.query(
      `INSERT INTO job_offers (order_id, driver_id, status, expires_at, matched_via)
       VALUES ($1, $2, 'pending', $3, $4)`,
      [orderId, driverId, expiresAt, matchedVia]
    );
  }
}

async function expireJobOffers(orderId) {
  await db.query(
    `UPDATE job_offers SET status = 'expired' WHERE order_id = $1 AND status = 'pending'`,
    [orderId]
  );
}

async function shouldNotifyDriverForOffer(orderId, driverId, attemptIndex) {
  const ai = Number.isFinite(attemptIndex) ? attemptIndex : 0;
  const r = await db.query(
    `SELECT status FROM job_offers
     WHERE order_id = $1 AND driver_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId, driverId]
  );
  if (r.rows.length === 0) return true;
  const status = r.rows[0].status;
  if (status === 'accepted') return false;
  if (status === 'declined') return true;
  if (status === 'pending') return false;
  if (status === 'expired') return true;
  return false;
}

async function filterDriversToNotify(orderId, driverIds, attemptIndex) {
  const out = [];
  for (const driverId of driverIds) {
    if (await shouldNotifyDriverForOffer(orderId, driverId, attemptIndex)) {
      out.push(driverId);
    }
  }
  return out;
}

async function notifyDriversNewOffer(driverIds, order) {
  if (!driverIds?.length) return;
  const fresh = await getOrder(order.id);
  if (!fresh || fresh.status !== 'matching' || fresh.driver_id) {
    return;
  }
  const earn = Number(fresh.driver_earnings || fresh.total_price || 0);
  const amountStr = Number.isFinite(earn) ? earn.toFixed(2) : '0.00';
  const title = 'New Delivery Job!';
  const body = `Earn R${amountStr} — ${fresh.pickup_address} to ${fresh.dropoff_address}`;
  for (const driverId of driverIds) {
    await sendPushNotification(driverId, title, body, {
      orderId: fresh.id,
      orderNumber: fresh.order_number,
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

async function runMatchingAttempt(orderId, attemptIndex = 0, attemptedDriverIds = new Set()) {
  await expireJobOffers(orderId);

  let order = await getOrder(orderId);
  if (!order || order.status !== 'matching') return !!order?.driver_id;
  if (order.driver_id) return true;

  while (true) {
    order = await getOrder(orderId);
    if (!order || order.status !== 'matching') return !!order?.driver_id;
    if (order.driver_id) return true;

    const drivers = await findNearestDrivers(order, Array.from(attemptedDriverIds));
    console.log('[Matching] Nearest drivers (candidates):', drivers.length);
    if (drivers.length === 0) return false;

    const candidate = drivers[0];
    const toNotify = await filterDriversToNotify(orderId, [candidate.driver_id], attemptIndex);
    if (toNotify.length === 0) {
      attemptedDriverIds.add(Number(candidate.driver_id));
      console.log('[Matching] Candidate already has an active offer:', candidate.driver_id);
      continue;
    }

    await createJobOffers(orderId, [candidate.driver_id], { matchedVia: 'nearest' });
    await notifyDriversNewOffer(toNotify, order);

    const matched = await pollUntilMatchedOrTimeout(orderId, OFFER_TIMEOUT_MS);
    if (matched) return true;

    attemptedDriverIds.add(Number(candidate.driver_id));
    await expireJobOffers(orderId);
    console.log('[Matching] Offer timed out, cascading to next nearest driver');
  }
}

async function tryStep4(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.driver_id || order.status !== 'matching') return;

  await db.query(
    `UPDATE orders SET status = 'unmatched', match_attempted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [orderId]
  );
  await notifyCustomerNoDriver(order.customer_id, order);
}

async function runMatchingWithRetry(orderId) {
  const attemptedDriverIds = new Set();
  for (let attempt = 1; attempt <= MAX_MATCHING_ATTEMPTS; attempt++) {
    let order = await getOrder(orderId);
    if (!order || order.status !== 'matching') return;
    if (order.driver_id) return;

    console.log(`[Matching] Attempt ${attempt} of ${MAX_MATCHING_ATTEMPTS} for order ${orderId}`);

    const matched = await runMatchingAttempt(orderId, attempt - 1, attemptedDriverIds);
    if (matched) return;

    order = await getOrder(orderId);
    if (!order || order.status !== 'matching' || order.driver_id) return;

    if (attempt < MAX_MATCHING_ATTEMPTS) {
      console.log('[Matching] No driver found, retrying in 30s...');
      await sleep(MATCHING_RETRY_DELAY_MS);
    }
  }

  await tryStep4(orderId);
}

function runMatching(orderId) {
  console.log('[Matching] Starting for order:', orderId);
  const key = Number(orderId);
  if (activeMatchingRuns.has(key)) {
    return activeMatchingRuns.get(key);
  }

  const runPromise = runMatchingWithRetry(orderId)
    .catch((err) => {
      console.error('[Matching] runMatchingWithRetry:', err);
      throw err;
    })
    .finally(() => {
      activeMatchingRuns.delete(key);
    });

  activeMatchingRuns.set(key, runPromise);
  return runPromise;
}

async function getDriverDeliveryRadius(driverId, fallbackKm = 20) {
  try {
    const r = await db.query(
      `SELECT delivery_radius_km FROM driver_routes
       WHERE driver_id = $1 AND status = 'active' AND trip_type = 'intercity'
       ORDER BY departure_time DESC LIMIT 1`,
      [driverId]
    );
    const val = r.rows[0]?.delivery_radius_km;
    return Number.isFinite(Number(val)) ? Number(val) : fallbackKm;
  } catch {
    return fallbackKm;
  }
}

/**
 * Score a regular (non-trip) order against a dedicated driver route.
 * Returns distance km if within radius, null otherwise.
 */
function dedicatedScore(order, route, defaultRadiusKm = 10) {
  const radiusKm = Number(route.delivery_radius_km) || defaultRadiusKm;
  const d = haversineKm(
    parseFloat(route.current_lat || route.from_lat),
    parseFloat(route.current_lng || route.from_lng),
    parseFloat(order.pickup_lat),
    parseFloat(order.pickup_lng)
  );
  if (!Number.isFinite(d) || d > radiusKm) return null;
  return d;
}

/**
 * For intercity corridor matching: check if the order's dropoff is within
 * the driver's chosen delivery radius of the route's destination.
 */
function isDropoffWithinDeliveryRadius(order, route, defaultRadiusKm = 10) {
  const radiusKm = Number(route.delivery_radius_km) || defaultRadiusKm;
  const d = haversineKm(
    parseFloat(order.dropoff_lat),
    parseFloat(order.dropoff_lng),
    parseFloat(route.to_lat),
    parseFloat(route.to_lng)
  );
  return Number.isFinite(d) && d <= radiusKm;
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

  const deliveryRadius = await getDriverDeliveryRadius(driverId, 20);

  const candidatesRes = await db.query(
    `SELECT id, order_number,
            pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
            status, driver_earnings, total_price
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
    .filter((x) => x.distPickupToPickup <= deliveryRadius && x.distDropoffToPickup <= deliveryRadius)
    .sort((a, b) => a.score - b.score);

  const best = oppositeOrders[0]?.candidate;
  if (!best) return;

  const existing = await db.query(
    `SELECT id FROM job_offers
     WHERE order_id = $1 AND driver_id = $2 AND status = 'pending'`,
    [best.id, driverId]
  );
  if (existing.rows.length > 0) return;

  if (String(best.status) !== 'matching') {
    await db.query(`UPDATE orders SET status = 'matching', updated_at = NOW() WHERE id = $1`, [best.id]);
  }

  const expiresAt = new Date(Date.now() + RETURN_LOAD_OFFER_TIMEOUT_MS);
  await db.query(
    `INSERT INTO job_offers (order_id, driver_id, status, expires_at, matched_via)
     VALUES ($1, $2, 'pending', $3, NULL)`,
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

async function sendJobOfferToDriver(order, driver) {
  const driverId = driver.driver_id || driver.driver_user_id;
  if (!driverId) {
    throw new Error('Driver ID not found in matched driver object');
  }

  const toNotify = await filterDriversToNotify(order.id, [driverId], 0);
  if (toNotify.length === 0) {
    return false;
  }
  await createJobOffers(order.id, [driverId], { matchedVia: 'nearest' });
  await notifyDriversNewOffer(toNotify, order);
  return true;
}

module.exports = {
  findNearestDrivers,
  runMatching,
  runMatchingAttempt,
  runMatchingWithRetry,
  offerReturnLoadAfterIntercityPickup,
  sendJobOfferToDriver,
  dedicatedScore,
  isDropoffWithinDeliveryRadius,
};

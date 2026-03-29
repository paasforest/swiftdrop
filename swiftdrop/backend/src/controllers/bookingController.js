const db = require('../database/connection');
const { getRealtimeDb } = require('../services/firebaseAdmin');
const { sendPushNotification } = require('../services/notificationService');
const { haversineKm } = require('../utils/haversine');
const { tripFareBreakdown } = require('../utils/pricing');
const { detectProvince } = require('../services/provinceService');

// Default Cape Town centre — used as geocode fallback
const FALLBACK_LAT = -33.9249;
const FALLBACK_LNG = 18.4241;

// Estimated minutes: assume 40 km/h average city speed
function calcMins(distanceKm) {
  return Math.max(5, Math.round((distanceKm / 40) * 60));
}

/**
 * Trip km from pickup→dropoff when coords exist; else fallbackKm (e.g. driver→pickup).
 * Returns customer fare (rounded R5) + driver 80% payout + platform fee.
 */
function tripKmThenFare(pickupLat, pickupLng, dropoffLat, dropoffLng, fallbackKm, parcelSize) {
  const pl = pickupLat != null ? Number(pickupLat) : NaN;
  const pg = pickupLng != null ? Number(pickupLng) : NaN;
  const dl = dropoffLat != null ? Number(dropoffLat) : NaN;
  const dg = dropoffLng != null ? Number(dropoffLng) : NaN;
  let tripKm;
  if ([pl, pg, dl, dg].every(Number.isFinite)) {
    const km = haversineKm(pl, pg, dl, dg);
    tripKm = Math.round(km * 10) / 10;
  } else {
    const fb = Number(fallbackKm);
    const km = Number.isFinite(fb) ? fb : 0;
    tripKm = Math.round(km * 10) / 10;
  }
  const { customerFare, driverPayout, platformFee } = tripFareBreakdown(tripKm, parcelSize);
  return { tripKm, customerFare, driverPayout, platformFee };
}

async function geocodeAddress(address) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { lat: FALLBACK_LAT, lng: FALLBACK_LNG };

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}&region=za`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === 'OK' && json.results[0]) {
      const { lat, lng } = json.results[0].geometry.location;
      return { lat, lng };
    }
  } catch {
    // fall through
  }
  return { lat: FALLBACK_LAT, lng: FALLBACK_LNG };
}

// TESTING MODE: radius is 2000km (whole of SA) so you can test from any location.
// PRODUCTION: change this to 15 once real drivers are on the ground in the right cities.
const DRIVER_SEARCH_RADIUS_KM = parseInt(process.env.DRIVER_SEARCH_RADIUS_KM || '2000', 10);

async function getNearbyOnlineDrivers(pickupLat, pickupLng, radiusKm = DRIVER_SEARCH_RADIUS_KM) {
  const rtdb = getRealtimeDb();
  if (!rtdb) return [];

  const snap = await rtdb.ref('drivers').once('value');
  const val = snap.val();
  if (!val) return [];

  console.log('[matching] RTDB drivers snapshot:', JSON.stringify(val));
  console.log('[matching] Pickup coords:', pickupLat, pickupLng, '| Radius:', radiusKm, 'km');

  const nearby = [];
  for (const [uid, entry] of Object.entries(val)) {
    if (entry?.status !== 'online') {
      console.log(`[matching] Skip ${uid} — status: ${entry?.status}`);
      continue;
    }
    const { lat, lng } = entry;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.log(`[matching] Skip ${uid} — missing lat/lng`);
      continue;
    }
    const distKm = haversineKm(pickupLat, pickupLng, lat, lng);
    console.log(`[matching] Driver ${uid} — dist: ${distKm.toFixed(1)}km, within radius: ${distKm <= radiusKm}`);
    if (distKm <= radiusKm) {
      nearby.push({ uid, lat, lng, distKm, ...entry });
    }
  }
  nearby.sort((a, b) => a.distKm - b.distKm);
  return nearby;
}

// ── POST /api/bookings/request ──────────────────────────────────────────────
async function requestBooking(req, res) {
  const senderId = req.user.id;
  const {
    pickupAddress,
    dropoffAddress,
    parcelSize,
    pickupLat: clientLat,
    pickupLng: clientLng,
    dropoffLat: clientDropLat,
    dropoffLng: clientDropLng,
  } = req.body;

  if (!pickupAddress || !dropoffAddress || !parcelSize) {
    return res.status(400).json({ error: 'pickupAddress, dropoffAddress and parcelSize are required' });
  }

  // Use client-provided coords if available, otherwise geocode (saves ~300ms)
  let pickupLat, pickupLng;
  if (clientLat && clientLng) {
    pickupLat = parseFloat(clientLat);
    pickupLng = parseFloat(clientLng);
  } else {
    ({ lat: pickupLat, lng: pickupLng } = await geocodeAddress(pickupAddress));
  }

  const dropoffLatRaw =
    clientDropLat !== undefined && clientDropLat !== null ? parseFloat(clientDropLat) : null;
  const dropoffLngRaw =
    clientDropLng !== undefined && clientDropLng !== null ? parseFloat(clientDropLng) : null;
  const dropoffLatDb = Number.isFinite(dropoffLatRaw) ? dropoffLatRaw : null;
  const dropoffLngDb = Number.isFinite(dropoffLngRaw) ? dropoffLngRaw : null;

  const OUT_OF_AREA_MSG =
    'This location is outside SwiftDrop service areas (Western Cape and Gauteng only).';

  if (!detectProvince(pickupLat, pickupLng)) {
    return res.status(400).json({
      error: OUT_OF_AREA_MSG,
      code: 'OUT_OF_SERVICE_AREA',
      field: 'pickup',
    });
  }

  let dropoffLatForProvince = dropoffLatDb;
  let dropoffLngForProvince = dropoffLngDb;
  if (dropoffLatForProvince == null || dropoffLngForProvince == null) {
    const geo = await geocodeAddress(dropoffAddress);
    dropoffLatForProvince = geo.lat;
    dropoffLngForProvince = geo.lng;
  }
  if (!detectProvince(dropoffLatForProvince, dropoffLngForProvince)) {
    return res.status(400).json({
      error: OUT_OF_AREA_MSG,
      code: 'OUT_OF_SERVICE_AREA',
      field: 'dropoff',
    });
  }

  // Find nearest online drivers
  const drivers = await getNearbyOnlineDrivers(pickupLat, pickupLng);
  if (drivers.length === 0) {
    return res.status(404).json({ error: 'NO_DRIVERS_AVAILABLE', message: 'No drivers available nearby right now.' });
  }

  const nearestDriver = drivers[0];
  const driverToPickupKm = Math.round(nearestDriver.distKm * 10) / 10;
  const {
    tripKm,
    customerFare,
    driverPayout,
  } = tripKmThenFare(
    pickupLat,
    pickupLng,
    dropoffLatDb,
    dropoffLngDb,
    driverToPickupKm,
    parcelSize
  );
  const estimatedMins = calcMins(tripKm);
  const distanceKm = tripKm;

  // Create booking row (customer_fare = sender total; driver_payout = 80%)
  let bookingId;
  try {
    const result = await db.query(
      `INSERT INTO bookings
         (sender_id, pickup_address, dropoff_address, parcel_size, status,
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, driver_payout, customer_fare)
       VALUES ($1, $2, $3, $4, 'searching', $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        senderId,
        pickupAddress,
        dropoffAddress,
        parcelSize,
        pickupLat,
        pickupLng,
        dropoffLatDb,
        dropoffLngDb,
        driverPayout,
        customerFare,
      ]
    );
    bookingId = result.rows[0].id;
  } catch (err) {
    console.error('[booking] DB insert error:', err.message);
    return res.status(500).json({ error: 'Failed to create booking' });
  }

  // Write job offer to Firebase RTDB
  const rtdb = getRealtimeDb();
  if (rtdb) {
    try {
      await rtdb.ref(`jobOffers/${nearestDriver.uid}`).set({
        bookingId,
        pickupAddress,
        dropoffAddress,
        parcelSize,
        driverPayout,
        distanceKm,
        driverToPickupKm,
        estimatedMins,
        status: 'pending',
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error('[booking] RTDB jobOffer write error:', err.message);
    }
  }

  // Look up Postgres user for the driver to send FCM
  try {
    const driverRow = await db.query(
      `SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [nearestDriver.uid]
    );
    if (driverRow.rows[0]) {
      await sendPushNotification(
        driverRow.rows[0].id,
        'New delivery request',
        `Pickup at ${pickupAddress} — R${driverPayout} payout`,
        { type: 'job_offer', bookingId: String(bookingId) }
      );
    }
  } catch (err) {
    console.error('[booking] FCM notify error:', err.message);
  }

  return res.status(201).json({
    bookingId,
    status: 'searching',
    pickupAddress,
    dropoffAddress,
    parcelSize,
    pickupLat,
    pickupLng,
    ...(dropoffLatDb != null && dropoffLngDb != null
      ? { dropoffLat: dropoffLatDb, dropoffLng: dropoffLngDb }
      : {}),
    distanceKm,
    estimatedMins,
    customerFare,
    driverPayout,
  });
}

// ── POST /api/bookings/:bookingId/accept ────────────────────────────────────
async function acceptBooking(req, res) {
  const driverFirebaseUid = req.firebaseUser?.uid;
  const { bookingId } = req.params;

  // Fetch booking
  let booking;
  try {
    const result = await db.query(
      `SELECT b.*, u.id AS sender_postgres_id
       FROM bookings b
       JOIN users u ON u.id = b.sender_id
       WHERE b.id = $1`,
      [bookingId]
    );
    booking = result.rows[0];
  } catch (err) {
    return res.status(500).json({ error: 'DB error fetching booking' });
  }

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'searching') {
    return res.status(409).json({ error: 'Booking is no longer available' });
  }

  // Find driver's Postgres id
  let driverRow;
  try {
    const r = await db.query(`SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`, [driverFirebaseUid]);
    driverRow = r.rows[0];
  } catch { /* ignore */ }

  // Update booking status; backfill fare columns on legacy rows
  try {
    const { driverPayout: fillDriver, customerFare: fillCustomer } = tripKmThenFare(
      booking.pickup_lat,
      booking.pickup_lng,
      booking.dropoff_lat,
      booking.dropoff_lng,
      5,
      booking.parcel_size
    );
    await db.query(
      `UPDATE bookings
       SET status = 'active',
           driver_firebase_uid = $1,
           accepted_at = NOW(),
           driver_payout = COALESCE(driver_payout, $3),
           customer_fare = COALESCE(customer_fare, $4)
       WHERE id = $2`,
      [driverFirebaseUid, bookingId, fillDriver, fillCustomer]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Failed to accept booking' });
  }

  // Update RTDB
  const rtdb = getRealtimeDb();
  if (rtdb) {
    try {
      await Promise.all([
        // Remove the job offer
        rtdb.ref(`jobOffers/${driverFirebaseUid}`).remove(),
        // Mark driver as busy
        rtdb.ref(`drivers/${driverFirebaseUid}/status`).set('busy'),
        // Write active job for driver
        rtdb.ref(`driverActiveJob/${driverFirebaseUid}`).set({
          bookingId,
          orderId: bookingId,
          pickupAddress: booking.pickup_address,
          dropoffAddress: booking.dropoff_address,
          status: 'active',
        }),
        // Update booking status node for sender
        rtdb.ref(`bookings/${bookingId}/status`).set('active'),
      ]);
    } catch (err) {
      console.error('[booking] RTDB accept update error:', err.message);
    }
  }

  // Notify sender
  try {
    await sendPushNotification(
      booking.sender_id,
      'Driver accepted!',
      'Your driver is on the way to pick up your parcel.',
      { type: 'booking_accepted', bookingId: String(bookingId) }
    );
  } catch { /* non-fatal */ }

  return res.json({ success: true, bookingId, status: 'active' });
}

// ── POST /api/bookings/:bookingId/decline ───────────────────────────────────
async function declineBooking(req, res) {
  const driverFirebaseUid = req.firebaseUser?.uid;
  const { bookingId } = req.params;

  // Remove this driver's job offer
  const rtdb = getRealtimeDb();
  if (rtdb) {
    try {
      await rtdb.ref(`jobOffers/${driverFirebaseUid}`).remove();
    } catch { /* ignore */ }
  }

  // Fetch booking to get pickup coords
  let booking;
  try {
    const r = await db.query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
    booking = r.rows[0];
  } catch {
    return res.status(500).json({ error: 'DB error' });
  }
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Find next available driver (exclude declined driver)
  const declined = [driverFirebaseUid];
  const drivers = await getNearbyOnlineDrivers(booking.pickup_lat, booking.pickup_lng);
  const next = drivers.find((d) => !declined.includes(d.uid));

  if (!next) {
    // No more drivers — mark booking as failed
    try {
      await db.query(`UPDATE bookings SET status = 'no_drivers' WHERE id = $1`, [bookingId]);
    } catch { /* ignore */ }

    if (rtdb) {
      try {
        await rtdb.ref(`bookings/${bookingId}/status`).set('no_drivers');
      } catch { /* ignore */ }
    }

    try {
      await sendPushNotification(
        booking.sender_id,
        'No drivers available',
        'No nearby drivers accepted your request. Please try again.',
        { type: 'no_drivers', bookingId: String(bookingId) }
      );
    } catch { /* ignore */ }

    return res.json({ success: true, status: 'no_drivers' });
  }

  const driverToPickupKm = Math.round(next.distKm * 10) / 10;
  const { tripKm, customerFare, driverPayout } = tripKmThenFare(
    booking.pickup_lat,
    booking.pickup_lng,
    booking.dropoff_lat,
    booking.dropoff_lng,
    driverToPickupKm,
    booking.parcel_size
  );
  const distanceKm = tripKm;
  const estimatedMins = calcMins(tripKm);

  try {
    await db.query(
      `UPDATE bookings SET driver_payout = $1, customer_fare = $2, updated_at = NOW() WHERE id = $3`,
      [driverPayout, customerFare, bookingId]
    );
  } catch (e) {
    console.warn('[booking] decline fare update:', e.message);
  }

  if (rtdb) {
    try {
      await rtdb.ref(`jobOffers/${next.uid}`).set({
        bookingId,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        parcelSize: booking.parcel_size,
        driverPayout,
        distanceKm,
        driverToPickupKm,
        estimatedMins,
        status: 'pending',
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error('[booking] RTDB next-offer error:', err.message);
    }
  }

  try {
    const driverRow = await db.query(
      `SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [next.uid]
    );
    if (driverRow.rows[0]) {
      await sendPushNotification(
        driverRow.rows[0].id,
        'New delivery request',
        `Pickup at ${booking.pickup_address} — R${driverPayout} payout`,
        { type: 'job_offer', bookingId: String(bookingId) }
      );
    }
  } catch { /* non-fatal */ }

  return res.json({ success: true, status: 'offered_to_next' });
}

// ── GET /api/bookings/my-bookings ───────────────────────────────────────────
async function myBookings(req, res) {
  try {
    const result = await db.query(
      `SELECT id, pickup_address, dropoff_address, parcel_size, status, created_at,
              pickup_lat, pickup_lng
       FROM bookings
       WHERE sender_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    return res.json({ bookings: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load bookings' });
  }
}

// ── GET /api/bookings/:bookingId/pickup-otp ─────────────────────────────────
async function getPickupOtp(req, res) {
  const { bookingId } = req.params;
  try {
    const result = await db.query(
      `SELECT pickup_otp FROM bookings WHERE id = $1 AND sender_id = $2`,
      [bookingId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });

    let otp = result.rows[0].pickup_otp;
    if (!otp) {
      otp = String(Math.floor(1000 + Math.random() * 9000));
      await db.query(`UPDATE bookings SET pickup_otp = $1 WHERE id = $2`, [otp, bookingId]);
    }
    return res.json({ otp });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get OTP' });
  }
}

// ── POST /api/bookings/:bookingId/verify-pickup-otp ─────────────────────────
async function verifyPickupOtp(req, res) {
  const driverFirebaseUid = req.firebaseUser?.uid;
  const { bookingId } = req.params;
  const { otp } = req.body;

  if (!otp) return res.status(400).json({ error: 'otp is required' });

  try {
    const result = await db.query(
      `SELECT pickup_otp, sender_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    const booking = result.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.pickup_otp !== String(otp)) {
      return res.status(400).json({ error: 'Incorrect OTP', code: 'WRONG_OTP' });
    }

    await db.query(
      `UPDATE bookings SET status = 'in_transit', pickup_confirmed_at = NOW() WHERE id = $1`,
      [bookingId]
    );

    const rtdb = getRealtimeDb();
    if (rtdb) {
      await rtdb.ref(`bookings/${bookingId}/status`).set('in_transit').catch(() => {});
    }

    await sendPushNotification(
      booking.sender_id,
      'Parcel collected',
      'Your driver has picked up the parcel and is heading to the drop-off.',
      { type: 'parcel_collected', bookingId: String(bookingId) }
    ).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

// ── POST /api/bookings/:bookingId/upload-photo ───────────────────────────────
async function uploadPhoto(req, res) {
  const { bookingId } = req.params;
  const { stage } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No photo uploaded' });
  if (!['pickup', 'dropoff'].includes(stage)) {
    return res.status(400).json({ error: 'stage must be pickup or dropoff' });
  }

  try {
    const col = stage === 'pickup' ? 'pickup_photo_url' : 'dropoff_photo_url';

    // Try Cloudinary upload — if not configured, skip silently and still succeed.
    // This allows the delivery flow to work even before Cloudinary is set up.
    let photoUrl = null;
    try {
      const { uploadImage } = require('../services/cloudinaryService');
      const result = await uploadImage(file);
      photoUrl = result.secure_url;
    } catch (cloudErr) {
      // Cloudinary not configured or upload failed — log but don't block the flow
      console.warn('[uploadPhoto] Cloudinary skipped:', cloudErr.message);
    }

    if (photoUrl) {
      await db.query(`UPDATE bookings SET ${col} = $1 WHERE id = $2`, [photoUrl, bookingId]);
    }

    return res.json({ success: true, url: photoUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Photo upload failed', detail: err.message });
  }
}

// ── POST /api/bookings/:bookingId/complete ───────────────────────────────────
async function completeBooking(req, res) {
  const driverFirebaseUid = req.firebaseUser?.uid;
  const { bookingId } = req.params;

  try {
    const result = await db.query(
      `UPDATE bookings SET status = 'delivered', delivered_at = NOW()
       WHERE id = $1 AND driver_firebase_uid = $2
       RETURNING sender_id, driver_payout, customer_fare`,
      [bookingId, driverFirebaseUid]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });

    const rtdb = getRealtimeDb();
    if (rtdb) {
      await Promise.all([
        rtdb.ref(`bookings/${bookingId}/status`).set('delivered').catch(() => {}),
        rtdb.ref(`drivers/${driverFirebaseUid}/status`).set('online').catch(() => {}),
        rtdb.ref(`driverActiveJob/${driverFirebaseUid}`).remove().catch(() => {}),
      ]);
    }

    await sendPushNotification(
      result.rows[0].sender_id,
      'Parcel delivered!',
      'Your parcel has been delivered successfully.',
      { type: 'delivered', bookingId: String(bookingId) }
    ).catch(() => {});

    const row = result.rows[0];
    const driverPayout = row.driver_payout;
    const customerFare = row.customer_fare;
    return res.json({
      success: true,
      driver_payout: driverPayout != null ? Number(driverPayout) : null,
      customer_fare: customerFare != null ? Number(customerFare) : null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to complete booking' });
  }
}

// ── POST /api/bookings/:bookingId/arrived-pickup ─────────────────────────────
async function arrivedPickup(req, res) {
  const { bookingId } = req.params;
  const driverFirebaseUid = req.firebaseUser?.uid;
  try {
    const rtdb = getRealtimeDb();
    if (rtdb) {
      await rtdb.ref(`bookings/${bookingId}/status`).set('otp_pickup').catch(() => {});
    }
    const row = await db.query(`SELECT sender_id FROM bookings WHERE id = $1`, [bookingId]);
    if (row.rows[0]) {
      await sendPushNotification(
        row.rows[0].sender_id,
        'Driver has arrived!',
        'Your driver is at the pickup location. Share your 4-digit code.',
        { type: 'driver_arrived_pickup', bookingId: String(bookingId) }
      ).catch(() => {});
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update arrival status' });
  }
}

// ── POST /api/bookings/:bookingId/arrived-dropoff ────────────────────────────
async function arrivedDropoff(req, res) {
  const { bookingId } = req.params;
  try {
    const rtdb = getRealtimeDb();
    if (rtdb) {
      await rtdb.ref(`bookings/${bookingId}/status`).set('otp_dropoff').catch(() => {});
    }
    const row = await db.query(`SELECT sender_id FROM bookings WHERE id = $1`, [bookingId]);
    if (row.rows[0]) {
      await sendPushNotification(
        row.rows[0].sender_id,
        'Parcel arriving now',
        'Your driver is at the drop-off. Share the delivery code.',
        { type: 'driver_arrived_dropoff', bookingId: String(bookingId) }
      ).catch(() => {});
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update dropoff arrival' });
  }
}

// ── GET /api/bookings/:bookingId/dropoff-otp ─────────────────────────────────
async function getDropoffOtp(req, res) {
  const { bookingId } = req.params;
  try {
    const result = await db.query(
      `SELECT dropoff_otp FROM bookings WHERE id = $1 AND sender_id = $2`,
      [bookingId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });
    let otp = result.rows[0].dropoff_otp;
    if (!otp) {
      otp = String(Math.floor(1000 + Math.random() * 9000));
      await db.query(`UPDATE bookings SET dropoff_otp = $1 WHERE id = $2`, [otp, bookingId]);
    }
    return res.json({ otp });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get OTP' });
  }
}

// ── POST /api/bookings/:bookingId/verify-dropoff-otp ─────────────────────────
async function verifyDropoffOtp(req, res) {
  const { bookingId } = req.params;
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ error: 'otp is required' });
  try {
    const result = await db.query(
      `SELECT dropoff_otp, sender_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    const booking = result.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.dropoff_otp !== String(otp)) {
      return res.status(400).json({ error: 'Incorrect OTP', code: 'WRONG_OTP' });
    }
    await db.query(
      `UPDATE bookings SET status = 'delivering', dropoff_confirmed_at = NOW() WHERE id = $1`,
      [bookingId]
    );
    const rtdb = getRealtimeDb();
    if (rtdb) {
      await rtdb.ref(`bookings/${bookingId}/status`).set('delivering').catch(() => {});
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify dropoff OTP' });
  }
}

// ── POST /api/bookings/:bookingId/rate ────────────────────────────────────────
async function rateBooking(req, res) {
  const { bookingId } = req.params;
  const rating = Number(req.body?.rating);
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }
  try {
    await db.query(
      `UPDATE bookings SET sender_rating = $1 WHERE id = $2 AND sender_id = $3`,
      [rating, bookingId, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save rating' });
  }
}

// ── DELETE /api/bookings/:bookingId ──────────────────────────────────────────
async function cancelBooking(req, res) {
  const { bookingId } = req.params;
  try {
    await db.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND sender_id = $2`,
      [bookingId, req.user.id]
    );
    const rtdb = getRealtimeDb();
    if (rtdb) {
      await rtdb.ref(`bookings/${bookingId}/status`).set('cancelled').catch(() => {});
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }
}

module.exports = {
  requestBooking,
  acceptBooking,
  declineBooking,
  myBookings,
  getPickupOtp,
  verifyPickupOtp,
  arrivedPickup,
  arrivedDropoff,
  getDropoffOtp,
  verifyDropoffOtp,
  rateBooking,
  uploadPhoto,
  completeBooking,
  cancelBooking,
};

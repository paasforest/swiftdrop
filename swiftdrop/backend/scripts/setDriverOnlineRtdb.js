#!/usr/bin/env node
/**
 * Sets RTDB drivers/{DRIVER_FIREBASE_UID} to online near Cape Town so
 * POST /api/bookings/request can find a driver.
 *
 * Requires the same env as the backend (FIREBASE_SERVICE_ACCOUNT_JSON + FIREBASE_DATABASE_URL).
 *
 * Usage:
 *   cd swiftdrop/backend
 *   export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   export DRIVER_FIREBASE_UID='the-driver-firebase-uid'
 *   node scripts/setDriverOnlineRtdb.js
 *
 * Get DRIVER_FIREBASE_UID from Postgres:
 *   SELECT firebase_uid, email FROM users WHERE user_type = 'driver' LIMIT 5;
 */

require('dotenv').config();

const admin = require('firebase-admin');

const uid = process.env.DRIVER_FIREBASE_UID;
const lat = Number.parseFloat(String(process.env.DRIVER_TEST_LAT ?? '-33.9249'));
const lng = Number.parseFloat(String(process.env.DRIVER_TEST_LNG ?? '18.4241'));

const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://swiftdrop-c0110-default-rtdb.europe-west1.firebasedatabase.app';

if (!uid) {
  console.error('Set DRIVER_FIREBASE_UID to a driver\'s Firebase UID (users.firebase_uid).');
  process.exit(1);
}

if (!sa) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON (same as Railway backend).');
  process.exit(1);
}

try {
  const cred = typeof sa === 'string' ? JSON.parse(sa) : sa;
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred), databaseURL });
  }
} catch (e) {
  console.error('Firebase init failed:', e.message);
  process.exit(1);
}

(async () => {
  const ref = admin.database().ref(`drivers/${uid}`);
  await ref.set({
    status: 'online',
    lat,
    lng,
    updatedAt: Date.now(),
  });
  console.log(`OK: drivers/${uid} → online at`, lat, lng);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

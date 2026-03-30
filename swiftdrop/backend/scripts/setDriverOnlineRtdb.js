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
 *   export DRIVER_FIREBASE_UID='the-driver-firebase-uid'   # optional if DATABASE_URL is set
 *   node scripts/setDriverOnlineRtdb.js
 *
 * If DRIVER_FIREBASE_UID is omitted but DATABASE_URL is set, the first driver row in Postgres is used.
 *
 * Get DRIVER_FIREBASE_UID manually from Postgres:
 *   SELECT firebase_uid, email FROM users WHERE user_type = 'driver' LIMIT 5;
 */

require('dotenv').config();

const admin = require('firebase-admin');
const { Client } = require('pg');

let uid = process.env.DRIVER_FIREBASE_UID;
const lat = Number.parseFloat(String(process.env.DRIVER_TEST_LAT ?? '-33.9249'));
const lng = Number.parseFloat(String(process.env.DRIVER_TEST_LNG ?? '18.4241'));

const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://swiftdrop-c0110-default-rtdb.europe-west1.firebasedatabase.app';

async function resolveDriverUid() {
  if (uid) return uid.trim();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      'Set DRIVER_FIREBASE_UID, or set DATABASE_URL so we can pick the first driver from Postgres.'
    );
    process.exit(1);
  }
  const c = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const r = await c.query(
      `SELECT firebase_uid FROM users
       WHERE user_type = 'driver' AND firebase_uid IS NOT NULL AND firebase_uid <> ''
       ORDER BY id ASC
       LIMIT 1`
    );
    if (!r.rows.length) {
      console.error(
        'No driver in Postgres with firebase_uid. Run seed or create a driver user first.'
      );
      process.exit(1);
    }
    const found = String(r.rows[0].firebase_uid).trim();
    console.error('Using driver from DB (first match):', found);
    return found;
  } finally {
    await c.end();
  }
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
  uid = await resolveDriverUid();
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

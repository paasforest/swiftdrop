/**
 * Firebase Admin for server-side RTDB writes (e.g. driver location).
 * Set FIREBASE_SERVICE_ACCOUNT_JSON to a JSON string of the service account key,
 * and FIREBASE_DATABASE_URL to your Realtime Database URL.
 */
const admin = require('firebase-admin');

let initialized = false;

function init() {
  if (initialized) return;
  // Accept either env var name
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    'https://swiftdrop-c0110-default-rtdb.europe-west1.firebasedatabase.app';

  if (sa) {
    try {
      const cred = typeof sa === 'string' ? JSON.parse(sa) : sa;
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(cred), databaseURL });
        console.log('[firebaseAdmin] Initialized — project:', cred.project_id, '| RTDB:', databaseURL);
      }
      initialized = true;
    } catch (e) {
      console.error('[firebaseAdmin] Init failed:', e.message);
    }
  } else {
    console.warn('[firebaseAdmin] No service account env var found (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT) — RTDB and FCM disabled.');
  }
}

function getRealtimeDb() {
  init();
  if (!admin.apps.length) return null;
  return admin.database();
}

/** Firebase Cloud Messaging (same Admin app as RTDB). */
function getMessaging() {
  init();
  if (!admin.apps.length) return null;
  try {
    return admin.messaging();
  } catch (e) {
    console.error('[firebaseAdmin] messaging:', e.message);
    return null;
  }
}

function getAdminAuth() {
  init();
  if (!admin.apps.length) return null;
  try {
    return admin.auth();
  } catch (e) {
    console.error('[firebaseAdmin] auth:', e.message);
    return null;
  }
}

module.exports = { getRealtimeDb, getMessaging, getAdminAuth };

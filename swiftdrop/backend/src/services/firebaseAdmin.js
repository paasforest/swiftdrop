/**
 * Firebase Admin for server-side RTDB writes (e.g. driver location).
 * Set FIREBASE_SERVICE_ACCOUNT_JSON to a JSON string of the service account key,
 * and FIREBASE_DATABASE_URL to your Realtime Database URL.
 */
const admin = require('firebase-admin');

let initialized = false;

function init() {
  if (initialized) return;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    'https://swiftdrop-c0110-default-rtdb.europe-west1.firebasedatabase.app';

  if (sa) {
    try {
      const cred = typeof sa === 'string' ? JSON.parse(sa) : sa;
      admin.initializeApp({
        credential: admin.credential.cert(cred),
        databaseURL,
      });
      initialized = true;
    } catch (e) {
      console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  } else {
    console.warn('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON not set; RTDB writes from API are skipped');
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

module.exports = { getRealtimeDb, getMessaging };

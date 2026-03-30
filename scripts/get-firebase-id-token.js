#!/usr/bin/env node
/**
 * Print a Firebase *ID token* (use as: Authorization: Bearer <token>)
 * for the SwiftDrop API. This is NOT the same as an Admin "custom token".
 *
 * Prerequisites: a Firebase user that can sign in with email/password and
 * exists in Postgres as a sender (same as app login).
 *
 * Usage:
 *   export FIREBASE_WEB_API_KEY="AIzaSy..."   # Web API key (same as EXPO_PUBLIC_FIREBASE_API_KEY)
 *   export SENDER_EMAIL="sender@swiftdroptest.com"
 *   export SENDER_PASSWORD="Test1234"
 *   node scripts/get-firebase-id-token.js
 *
 * Then:
 *   export SENDER_BEARER_TOKEN="$(node scripts/get-firebase-id-token.js)"
 *   ./scripts/request-test-booking.sh
 */

const API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  'AIzaSyBRlGO-9LJpmfOrooKQK3tLspAFlucreJ0';

const email = process.env.SENDER_EMAIL;
const password = process.env.SENDER_PASSWORD;

async function main() {
  if (!email || !password) {
    console.error(
      'Set SENDER_EMAIL and SENDER_PASSWORD (same account you use in the app).\n' +
        'Example seed sender: sender@swiftdroptest.com / Test1234 (if that user exists in Firebase Auth).'
    );
    process.exit(1);
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email).trim(),
      password: String(password),
      returnSecureToken: true,
    }),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    console.error(
      'Sign-in failed:',
      json.error?.message || json.error || JSON.stringify(json)
    );
    process.exit(1);
  }

  if (!json.idToken) {
    console.error('No idToken in response:', json);
    process.exit(1);
  }

  process.stdout.write(json.idToken);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

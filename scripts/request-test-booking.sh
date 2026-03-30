#!/usr/bin/env bash
# Create a test booking against production (or set API_BASE_URL).
# Requires: a Firebase ID token for a sender account (see below).
#
# Get a token (Expo app): log in as sender, then in dev tools / temporary script:
#   auth.currentUser.getIdToken().then(console.log)
#
# Usage:
#   export SENDER_BEARER_TOKEN='eyJ...'
#   ./scripts/request-test-booking.sh

set -euo pipefail
API_BASE_URL="${API_BASE_URL:-https://swiftdrop-production.up.railway.app}"

if [[ -z "${SENDER_BEARER_TOKEN:-}" ]]; then
  echo "Set SENDER_BEARER_TOKEN to a Firebase ID token (sender user)." >&2
  exit 1
fi

curl -sS -X POST "${API_BASE_URL}/api/bookings/request" \
  -H "Authorization: Bearer ${SENDER_BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "12 Bree Street, Cape Town, 8001",
    "dropoffAddress": "V&A Waterfront, Cape Town, 8002",
    "parcelSize": "Small",
    "pickupLat": -33.9249,
    "pickupLng": 18.4241,
    "dropoffLat": -33.9022,
    "dropoffLng": 18.4199,
    "senderDeclarationAccepted": true
  }' | jq .

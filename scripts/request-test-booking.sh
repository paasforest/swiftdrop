#!/usr/bin/env bash
# Create a test booking (default: production API).
#
# Option A: export SENDER_BEARER_TOKEN='eyJ...'
# Option B: export SENDER_EMAIL + SENDER_PASSWORD (same login as app)
#
# Put a driver online first: swiftdrop/backend/scripts/setDriverOnlineRtdb.js

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE_URL="${API_BASE_URL:-https://swiftdrop-production.up.railway.app}"

if [[ -z "${SENDER_BEARER_TOKEN:-}" ]]; then
  if [[ -n "${SENDER_EMAIL:-}" && -n "${SENDER_PASSWORD:-}" ]]; then
    SENDER_BEARER_TOKEN="$(node "${ROOT}/scripts/get-firebase-id-token.js")"
  else
    echo "Set SENDER_BEARER_TOKEN, or SENDER_EMAIL + SENDER_PASSWORD." >&2
    exit 1
  fi
fi

OUT="$(mktemp)"
CODE="$(curl -sS -o "$OUT" -w "%{http_code}" -X POST "${API_BASE_URL}/api/bookings/request" \
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
  }')"

cat "$OUT"
echo ""
echo "HTTP $CODE" >&2
rm -f "$OUT"
if [[ "$CODE" != "201" ]]; then
  exit 1
fi

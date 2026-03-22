#!/bin/bash

EMAIL="charles@swiftdrop.com"
PASSWORD="Driver123"
API="https://swiftdrop-production.up.railway.app"

echo "Logging in as Charles..."
TOKEN=$(curl -sS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token: $TOKEN"

echo "Setting location..."
curl -sS -X PATCH "$API/api/drivers/location" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat":-33.6462,"lng":19.4485}'

echo "Going online..."
curl -sS -X PATCH "$API/api/drivers/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"is_online":true}'

echo "Charles is online! Token expires in 1 hour."
echo "TOKEN=$TOKEN"
echo ""
echo "To accept a job run:"
echo "curl -sS -X POST $API/api/orders/ORDER_ID/accept -H \"Authorization: Bearer $TOKEN\""

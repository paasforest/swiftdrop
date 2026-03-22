#!/bin/bash
TOKEN=$1
API="https://swiftdrop-production.up.railway.app"
if [ -z "$TOKEN" ]; then
  echo "Usage: ./auto_accept.sh YOUR_TOKEN"
  exit 1
fi
echo "Watching for job offers..."
while true; do
  OFFER=$(curl -sS -X GET "$API/api/orders/pending-offer" -H "Authorization: Bearer $TOKEN")
  ORDER_ID=$(echo $OFFER | grep -o '"orderId":[0-9]*' | grep -o '[0-9]*')
  if [ ! -z "$ORDER_ID" ]; then
    echo "Job offer found! Order ID: $ORDER_ID Accepting..."
    curl -sS -X POST "$API/api/orders/$ORDER_ID/accept" -H "Authorization: Bearer $TOKEN"
    echo "Accepted!"
    break
  else
    echo "No offer yet... waiting 2 seconds"
    sleep 2
  fi
done

# Firebase Real-Time Tracking Setup Guide

## 🎯 What This Does

Real-time tracking allows:
- **Customers** to see drivers moving on a live map
- **Drivers** to share their location automatically during deliveries
- **Instant updates** - no page refresh needed
- **ETA calculations** based on real distance

---

## 📋 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `SwiftDrop`
4. Disable Google Analytics (optional for now)
5. Click **"Create project"**

---

## 📋 Step 2: Enable Realtime Database

1. In Firebase Console, click **"Realtime Database"** in left menu
2. Click **"Create Database"**
3. Choose location: **United States** (or closest to South Africa)
4. Start in **"Test mode"** (we'll secure it later)
5. Click **"Enable"**

---

## 📋 Step 3: Get Firebase Configuration

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Scroll down to **"Your apps"**
3. Click the **Web icon** `</>`
4. Register app name: `SwiftDrop Mobile`
5. **Copy the firebaseConfig object** - you'll need these values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "swiftdrop-xxxxx.firebaseapp.com",
  databaseURL: "https://swiftdrop-xxxxx-default-rtdb.firebaseio.com",
  projectId: "swiftdrop-xxxxx",
  storageBucket: "swiftdrop-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

---

## 📋 Step 4: Add Firebase Config to Your App

Create a `.env` file in the root of your project:

```bash
cd /home/immigrant/dropoff
nano .env
```

Add these lines (replace with YOUR actual Firebase values):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyC...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=swiftdrop-xxxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://swiftdrop-xxxxx-default-rtdb.firebaseio.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=swiftdrop-xxxxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=swiftdrop-xxxxx.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

**Save and close** (Ctrl+X, then Y, then Enter)

---

## 📋 Step 5: Set Firebase Security Rules

In Firebase Console → Realtime Database → **Rules** tab:

```json
{
  "rules": {
    "active_deliveries": {
      "$orderId": {
        ".read": true,
        ".write": "auth != null",
        "driver_location": {
          ".validate": "newData.hasChildren(['latitude', 'longitude', 'timestamp', 'driverId'])"
        },
        "status": {
          ".validate": "newData.hasChildren(['status', 'timestamp'])"
        }
      }
    }
  }
}
```

Click **"Publish"**

---

## 📋 Step 6: Test the Setup

### **On Driver's Phone:**

1. Accept a delivery job
2. Start driving
3. Location should update every 5 seconds in Firebase

**Check Firebase Console:**
- Go to Realtime Database → Data tab
- You should see: `active_deliveries/{orderId}/driver_location`
- Values update in real-time

### **On Customer's Phone:**

1. Open a delivery in "Tracking" screen
2. You should see:
   - Live map with driver's car moving
   - ETA updating automatically
   - "Live tracking active" indicator

---

## 🔧 How It Works

### **Driver Side:**

```javascript
// When driver starts delivery
import { startDriverLocationTracking } from './services/locationTracking';

startDriverLocationTracking(driverId, orderId);
// → Updates Firebase every 5 seconds with GPS coordinates
```

### **Customer Side:**

```javascript
// When customer opens tracking screen
import { subscribeToDriverLocation } from './services/locationTracking';

subscribeToDriverLocation(orderId, (location) => {
  // This callback fires every time driver moves
  console.log('Driver at:', location.latitude, location.longitude);
  // → Map updates automatically
});
```

### **Firebase Data Structure:**

```
active_deliveries/
  └── ORDER_123/
      ├── driver_location/
      │   ├── latitude: -33.9249
      │   ├── longitude: 18.4241
      │   ├── heading: 45
      │   ├── speed: 12.5
      │   ├── timestamp: 1710864000000
      │   └── driverId: "driver_456"
      └── status/
          ├── status: "en_route_delivery"
          └── timestamp: 1710864000000
```

---

## 🚀 Next Steps

### **1. Integrate with Backend**

Update your backend to create Firebase entries when orders are matched:

```javascript
// Backend: When driver accepts job
POST /api/jobs/:jobId/accept
→ Create Firebase entry: active_deliveries/{orderId}
```

### **2. Add to Driver Screens**

In `EnRoutePickup.jsx` and `EnRouteDelivery.jsx`:

```javascript
import DriverLocationService from './DriverLocationService';

// Inside component
<DriverLocationService orderId={currentOrderId} />
```

### **3. Clean Up After Delivery**

When delivery is completed, remove from Firebase:

```javascript
// Backend: When delivery confirmed
POST /api/jobs/:jobId/delivery-confirm
→ Delete Firebase entry: active_deliveries/{orderId}
```

---

## 🔒 Production Security Rules

Before going live, update Firebase rules:

```json
{
  "rules": {
    "active_deliveries": {
      "$orderId": {
        ".read": "auth != null",
        "driver_location": {
          ".write": "auth != null && auth.uid == newData.child('driverId').val()",
          ".validate": "newData.hasChildren(['latitude', 'longitude', 'timestamp', 'driverId'])"
        },
        "status": {
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['status', 'timestamp'])"
        }
      }
    }
  }
}
```

This ensures:
- Only authenticated users can read/write
- Drivers can only update their own location
- Data structure is validated

---

## 📊 Monitoring

### **Firebase Console:**
- **Realtime Database → Data** - See live updates
- **Realtime Database → Usage** - Monitor bandwidth
- **Authentication** - Track active users (if using Firebase Auth)

### **App Logs:**
```
[Location] Tracking started for driver: driver_456
[Location] Driver position updated: { latitude: -33.9249, longitude: 18.4241 }
[Tracking] Driver location updated: { latitude: -33.9249, longitude: 18.4241 }
```

---

## 🐛 Troubleshooting

### **"Location permission not granted"**
- On Android: Settings → Apps → SwiftDrop → Permissions → Location → Allow
- On iOS: Settings → SwiftDrop → Location → While Using the App

### **"Firebase update failed"**
- Check Firebase rules allow writes
- Verify Firebase config in `.env` is correct
- Check internet connection

### **"Map not showing"**
- Expo Go has built-in maps support
- For production builds, you'll need Google Maps API key

### **Driver location not updating**
- Check driver has active internet
- Verify `startDriverLocationTracking()` was called
- Check Firebase Console → Data for updates

---

## 💰 Firebase Pricing

**Free Tier (Spark Plan):**
- 1 GB stored data
- 10 GB/month downloaded
- 100 simultaneous connections

**This is enough for:**
- ~1000 active deliveries per month
- ~100 concurrent deliveries at once

**Paid Tier (Blaze Plan):**
- Pay as you go
- ~$5/GB downloaded
- ~$1/GB stored

**Estimated cost for SwiftDrop:**
- 1000 deliveries/month = ~$5-10/month
- Very affordable for real-time tracking

---

## ✅ Checklist

- [ ] Firebase project created
- [ ] Realtime Database enabled
- [ ] Firebase config added to `.env`
- [ ] Security rules published
- [ ] Tested on driver's phone (location updates)
- [ ] Tested on customer's phone (map shows driver)
- [ ] Backend integration planned
- [ ] Production security rules ready

---

**Last Updated:** March 19, 2026  
**Status:** Ready for testing

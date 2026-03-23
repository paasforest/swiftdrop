# ActiveDelivery - Uber-Style Persistent Delivery Screen

## 🎯 Overview

The `ActiveDelivery` screen replaces 5 separate driver delivery screens with a single persistent screen featuring:
- **Full-screen map** showing driver location, pickup/dropoff markers, and route
- **Bottom sheet** that slides up with phase-specific content
- **No navigation** during delivery - only the bottom sheet content changes
- **Real-time GPS tracking** with route visualization
- **Smooth transitions** between delivery phases

---

## ✅ What's Been Implemented

### **1. Dependencies Installed**
```bash
✓ react-native-maps
✓ @gorhom/bottom-sheet
✓ @gorhom/portal
✓ @mapbox/polyline
✓ react-native-reanimated (already installed)
✓ react-native-gesture-handler (already installed)
```

### **2. Files Created/Modified**

#### **Created:**
- `src/screens/driver/ActiveDelivery.jsx` - Main persistent delivery screen

#### **Modified:**
- `src/services/locationTracking.js` - Added `onLocationUpdate` callback support
- `src/screens/driver/DriverLocationService.jsx` - Passes location updates to parent
- `src/screens/driver/JobOffer.jsx` - Navigates to `ActiveDelivery` with coordinates
- `App.js` - Registered `ActiveDelivery` in navigation stack

### **3. Backend Verification**
✓ Orders table has `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng` columns
✓ `/api/orders/:id/accept` endpoint returns full order with coordinates
✓ All required endpoints exist and are working

---

## 📱 How It Works

### **Phase State Machine**

The screen automatically transitions through 7 phases based on order status:

1. **EN_ROUTE_PICKUP** - Driver heading to pickup location
2. **PICKUP_ARRIVED** - Driver at pickup, entering OTP
3. **PICKUP_PHOTO** - Taking photo of parcel
4. **EN_ROUTE_DELIVERY** - Driver heading to dropoff location
5. **DELIVERY_ARRIVED** - Driver at dropoff, entering OTP
6. **DELIVERY_PHOTO** - Taking photo of delivery
7. **COMPLETE** - Delivery finished, showing earnings

### **Map Features**

- **Driver marker** (green car) - Updates every 5 seconds via GPS
- **Pickup marker** (blue pin) - Shown during pickup phase
- **Dropoff marker** (red pin) - Shown during delivery phase
- **Route polyline** (blue line) - Fetched from Google Directions API
- **Auto-centering** - Camera follows driver position

### **Bottom Sheet Snappoints**
- **25%** - Minimized (shows header only)
- **50%** - Default (shows main content)
- **85%** - Expanded (completion screen)

---

## 🔧 Configuration Required

### **1. Google Maps API Key**

The screen uses Google Directions API for route visualization and ETA calculation.

**Add to `.env`:**
```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Get API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable **Directions API** and **Maps SDK for Android/iOS**
4. Create credentials → API Key
5. Restrict the key to your app (optional but recommended)

**Without API key:**
- Map will still work
- Route polyline won't show
- ETA won't be calculated
- Driver can still complete deliveries

### **2. Firebase Setup**

Location tracking requires Firebase (already configured in previous session).

Ensure `.env` has:
```env
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

---

## 🎨 UI/UX Features

### **Uber-Style Design**
- White bottom sheet with rounded top corners
- Black bold headers (18px)
- Gray secondary text (14px)
- Black primary buttons (56px height, 14px radius)
- Full-width buttons with white text

### **OTP Input**
- 4 boxes side-by-side
- 56x64px each
- 1.5px gray border
- 28px font size
- Auto-focus and auto-advance

### **Photo Capture**
- Camera preview
- Retake option
- Upload progress indicator
- Error handling

### **Completion Screen**
- Green checkmark icon (80px circle)
- Earnings card with green border
- Auto-redirect to DriverHome after 4 seconds

---

## 🔄 Flow Example

**Driver accepts job in JobOffer.jsx:**
```javascript
navigation.navigate('ActiveDelivery', {
  orderId: 123,
  pickup_address: "123 Main St",
  dropoff_address: "456 Oak Ave",
  pickup_lat: -33.9249,
  pickup_lng: 18.4241,
  dropoff_lat: -33.9350,
  dropoff_lng: 18.4350,
});
```

**Screen opens:**
1. Map loads centered on pickup location
2. GPS tracking starts automatically
3. Route fetched from Google Directions API
4. Bottom sheet shows "Head to pickup" with ETA
5. Driver taps "I've arrived at pickup"
6. Bottom sheet changes to OTP input (no navigation!)
7. Driver enters 4-digit code
8. Bottom sheet changes to photo capture
9. Driver takes photo and uploads
10. Map updates to show dropoff marker
11. Route recalculates to dropoff
12. Process repeats for delivery
13. Completion screen shows earnings
14. Auto-navigates to DriverHome

**No screen transitions** - just bottom sheet content changes!

---

## 🐛 Troubleshooting

### **Map not showing**
- Ensure `react-native-maps` is installed
- Expo Go has built-in map support
- For production builds, configure Google Maps API key in `app.json`

### **Route not drawing**
- Check `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env`
- Verify Directions API is enabled in Google Cloud Console
- Check console for API errors

### **GPS not updating**
- Grant location permissions when prompted
- Ensure Firebase is configured
- Check DriverLocationService is rendered

### **Bottom sheet not responding**
- Ensure `react-native-reanimated` is installed
- Check `react-native-gesture-handler` is installed
- Restart Expo dev server

### **OTP not working**
- Verify backend `/api/orders/:id/pickup-otp` endpoint
- Check order has `pickup_otp` field
- Ensure customer received SMS

### **Photo upload failing**
- Grant camera permissions
- Check backend `/api/orders/:id/pickup-photo` endpoint
- Verify Cloudinary is configured on backend

---

## 📊 API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders/:id` | GET | Poll order status (every 5s) |
| `/api/orders/:id/status` | PATCH | Update to pickup_arrived/delivery_arrived |
| `/api/orders/:id/pickup-otp` | POST | Verify pickup OTP |
| `/api/orders/:id/pickup-photo` | POST | Upload pickup photo |
| `/api/orders/:id/delivery-otp` | POST | Verify delivery OTP |
| `/api/orders/:id/delivery-photo` | POST | Upload delivery photo |
| Google Directions API | GET | Fetch route polyline and ETA |

---

## 🔐 Permissions Required

- **Location (foreground)** - For GPS tracking
- **Camera** - For photo capture
- **Internet** - For API calls and map tiles

---

## 🚀 Testing Checklist

- [ ] Accept job offer navigates to ActiveDelivery
- [ ] Map shows driver location marker
- [ ] Map shows pickup marker during pickup phase
- [ ] Route polyline draws from driver to pickup
- [ ] ETA displays correctly
- [ ] "I've arrived" button updates status
- [ ] OTP input accepts 4 digits
- [ ] OTP verification works
- [ ] Camera opens for photo capture
- [ ] Photo preview shows captured image
- [ ] Photo upload shows progress
- [ ] Map switches to dropoff marker after pickup
- [ ] Route recalculates to dropoff
- [ ] Delivery OTP and photo work
- [ ] Completion screen shows earnings
- [ ] Auto-redirects to DriverHome after 4s

---

## 📝 Old Screens (Kept for Rollback)

The following screens are still registered but no longer used:
- `EnRoutePickup.jsx`
- `PickupConfirm.jsx`
- `EnRouteDelivery.jsx`
- `DeliveryConfirm.jsx`

**To rollback:** Change `JobOffer.jsx` line 258 back to:
```javascript
navigation.navigate('EnRoutePickup', { ... });
```

**To remove old screens:** Once ActiveDelivery is tested and stable:
1. Delete the 4 old screen files
2. Remove imports from `App.js`
3. Remove Stack.Screen registrations

---

## 🎯 Benefits Over Old Flow

| Old Flow | New Flow |
|----------|----------|
| 5 separate screens | 1 persistent screen |
| Full-screen navigation | Bottom sheet transitions |
| Map hidden during OTP/photo | Map always visible |
| No route visualization | Live route polyline |
| No ETA calculation | Real-time ETA |
| Jarring transitions | Smooth animations |
| Complex state management | Single state machine |

---

## 📦 Package Versions

```json
{
  "react-native-maps": "^1.20.1",
  "@gorhom/bottom-sheet": "^5.2.8",
  "@gorhom/portal": "^1.0.14",
  "@mapbox/polyline": "^1.2.1",
  "react-native-reanimated": "~2.28.0",
  "react-native-gesture-handler": "~2.28.0"
}
```

---

**Status:** ✅ Ready for testing
**Last Updated:** March 23, 2026

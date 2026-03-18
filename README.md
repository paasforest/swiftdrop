# SwiftDrop - Crowd-Based Delivery Platform

A complete delivery platform built with V0 by Vercel UI components and React Native.

## Project Structure

```
src/
├── screens/
│   ├── customer/
│   │   ├── Onboarding.jsx (C1)
│   │   ├── Login.jsx (C2)
│   │   ├── Home.jsx (C3)
│   │   ├── AddressEntry.jsx (C4)
│   │   ├── ParcelDescription.jsx (C5)
│   │   ├── DeliveryTiers.jsx (C6)
│   │   ├── Payment.jsx (C7)
│   │   ├── DriverMatching.jsx (C8)
│   │   ├── Tracking.jsx (C9)
│   │   ├── OTPScreen.jsx (C10)
│   │   └── DeliveryConfirmed.jsx (C11)
│   ├── driver/
│   │   ├── DriverRegister.jsx (D1)
│   │   ├── DriverHome.jsx (D2)
│   │   ├── PostRoute.jsx (D3)
│   │   ├── JobOffer.jsx (D4)
│   │   ├── EnRoutePickup.jsx (D5)
│   │   ├── PickupConfirm.jsx (D6)
│   │   ├── EnRouteDelivery.jsx (D7)
│   │   ├── DeliveryConfirm.jsx (D8)
│   │   └── Earnings.jsx (D9)
│   └── admin/
│       ├── AdminOverview.jsx (A1)
│       ├── Deliveries.jsx (A2)
│       ├── DriverReview.jsx (A3)
│       ├── DisputeResolution.jsx (A4)
│       └── Finance.jsx (A5)
├── components/
│   ├── Button.jsx
│   ├── OTPInput.jsx
│   ├── MapView.jsx
│   ├── DriverCard.jsx
│   └── DeliveryCard.jsx
└── navigation/
    ├── CustomerNav.jsx
    ├── DriverNav.jsx
    └── AdminNav.jsx
```

## Design System

- Primary color: #1A73E8 (blue)
- Accent color: #FF6B35 (orange)
- Background: #F8FAFC
- Card background: white with subtle shadow
- Font: clean sans-serif, mobile-first
- Border radius: 12px on all cards and buttons

## Getting Started

1. Generate UI components using V0 by Vercel (v0.dev)
2. Copy code into corresponding files
3. Connect to backend API endpoints
4. Test and refine

**Backend deployment:** To deploy the SwiftDrop backend (Node.js + PostgreSQL) to Railway with GitHub auto-deploy, see [swiftdrop/backend/DEPLOYMENT.md](swiftdrop/backend/DEPLOYMENT.md). After deployment, use the Railway URL (e.g. `https://swiftdrop-backend.railway.app`) as the API base URL in the mobile app and admin dashboard.


## V0 Prompts

All screen prompts are available in the project documentation. Start with C1 (Splash Screen) and work through each screen sequentially.

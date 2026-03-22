# SwiftDrop Auth API — cURL Examples

Run these from a terminal. Ensure the backend is running: `npm run dev`

Base URL: `http://localhost:4000`

---

## 1. Register Customer (returns 201)

```bash
curl -X POST http://localhost:4000/api/auth/register-customer \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+27821234567",
    "password": "SecurePass123"
  }'
```

---

## 2. Verify Phone (after registration — use OTP from SMS or console log)

```bash
curl -X POST http://localhost:4000/api/auth/verify-phone \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27821234567",
    "otp": "1234"
  }'
```

---

## 3. Login (returns JWT token)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@swiftdrop.local",
    "password": "Password123!"
  }'
```

Or with phone:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27000000002",
    "password": "Password123!"
  }'
```

---

## 4. Login with Wrong Password (returns 401)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@swiftdrop.local",
    "password": "WrongPassword"
  }'
```

---

## 5. Forgot Password

```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@swiftdrop.local"}'
```

---

## 6. Reset Password (use OTP from SMS)

```bash
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27000000002",
    "otp": "1234",
    "newPassword": "NewSecurePass123"
  }'
```

---

## 7. Refresh Token

```bash
# Replace YOUR_REFRESH_TOKEN with the refreshToken from login response
curl -X POST http://localhost:4000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

---

## 8. Register Driver

```bash
curl -X POST http://localhost:4000/api/auth/register-driver \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Driver Mike",
    "email": "driver@example.com",
    "phone": "+27829876543",
    "password": "SecurePass123"
  }'
```

---

## 9. Admin — set user wallet (admin JWT only)

Replaces `wallet_balance` for the user with matching phone (SA E.164 normalized).

```bash
curl -X POST "https://swiftdrop-production.up.railway.app/api/admin/wallet/set" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27784956500",
    "wallet_balance": 2000
  }'
```

Local:

```bash
curl -X POST "http://localhost:4000/api/admin/wallet/set" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+27821234567", "wallet_balance": 500}'
```

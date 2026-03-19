# Deploy SwiftDrop Backend to Railway.app

This guide walks you through deploying the SwiftDrop backend to Railway with PostgreSQL and GitHub auto-deploy.

## What you get

- **Backend URL**: e.g. `https://swiftdrop-backend.railway.app` (Railway assigns this)
- **PostgreSQL**: Hosted on Railway; `DATABASE_URL` is set automatically when you link the database
- **Auto-deploy**: Every push to your connected GitHub branch deploys a new version

Use the backend URL as the **API base URL** in:
- The React Native / Expo mobile app
- The admin dashboard

---

## 1. Create a Railway project and add PostgreSQL

1. Go to [railway.app](https://railway.app) and sign in (GitHub is easiest).
2. Click **New Project**.
3. Click **Add service** → **Database** → **PostgreSQL**.
4. Wait for PostgreSQL to provision. Railway will show a service with a **Variables** tab containing `DATABASE_URL` (and others). You’ll link this to the backend in the next steps.

---

## 2. Add the backend as a service from GitHub

1. In the same project, click **Add service** → **GitHub Repo**.
2. Select your repository (e.g. the repo that contains the SwiftDrop monorepo).
3. After the service is added, open its **Settings**:
   - Set **Root Directory** to: `swiftdrop/backend`  
     (so Railway builds and runs from the backend folder only).
4. Optionally set **Branch** to the branch you want to deploy (e.g. `main`).

---

## 3. Connect the backend to PostgreSQL

1. Open your **backend service** (the one from GitHub).
2. Go to **Variables**.
3. Click **Add variable** → **Add a reference** (or “Reference”).
4. Select the **PostgreSQL** service and the variable **`DATABASE_URL`**.  
   This adds a reference so the backend gets the database URL automatically.
5. Add the rest of the required variables (see below). You can paste from the list.

---

## 4. Set environment variables

In the backend service → **Variables**, ensure these are set:

| Variable        | Required | Notes |
|----------------|----------|--------|
| `DATABASE_URL` | Yes      | Add as a **reference** from the PostgreSQL service (step 3). |
| `JWT_SECRET`   | Yes      | Use a long random string (e.g. 32+ chars). Generate with: `openssl rand -hex 32` |
| `PORT`         | No       | Railway sets this automatically. |
| `NODE_ENV`     | No       | Set to `production` for production. |
| `REQUIRE_PHONE_VERIFICATION` | No | Default `true`: login/refresh require `is_verified`; register flow sends OTP. Set to `false` for **testing only** (skip OTP after register, no SMS on signup, login/refresh without verify). |

Optional (for full features):

| Variable | Purpose |
|----------|---------|
| `SMSPORTAL_CLIENT_ID`, `SMSPORTAL_CLIENT_SECRET` | SMS / OTP (SMSPortal REST API) |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` | Payments |
| `FIREBASE_SERVICE_ACCOUNT` (JSON string) | Push notifications |
| `CLOUDINARY_URL` or `CLOUDINARY_*` | Image uploads |

---

## 5. Deploy and get the URL

1. Trigger a deploy: either push a commit to the connected branch or click **Deploy** in Railway.
2. After the build finishes, Railway runs `npm run db:migrate` (from `railway.toml`) then starts the app.
3. Open the backend service → **Settings** → **Networking** (or **Deployments** → your deployment).
4. Click **Generate domain** (or use an existing one). You’ll get a URL like:
   - `https://swiftdrop-backend-production.up.railway.app`  
   or after adding a custom domain:
   - `https://swiftdrop-backend.railway.app`

This URL is your **API base URL**.

---

## 6. Use the API URL in the app and admin

- **Mobile app**: Set the API base URL to the Railway URL (e.g. in a config file or env such as `EXPO_PUBLIC_API_URL=https://swiftdrop-backend.railway.app`).
- **Admin dashboard**: Set the same base URL where it calls the backend (e.g. env or config).

Example health check:

```bash
curl https://swiftdrop-backend.railway.app/
# Expect: {"name":"SwiftDrop API","version":"1.0.0"}
```

---

## 7. Auto-deploy on every push

- Railway is already connected to your GitHub repo and branch (step 2).
- Every push to that branch triggers a new build and deploy.
- Migrations run automatically before each deploy (`preDeployCommand` in `railway.toml`).

No extra setup needed for auto-deploy.

---

## Troubleshooting

- **Build fails**: Ensure **Root Directory** is `swiftdrop/backend` so `package.json` and `server.js` are found.
- **“DATABASE_URL is not set”**: Add `DATABASE_URL` as a **reference** from the PostgreSQL service (Variables → Add reference).
- **Migrations fail**: Check the deploy logs. Ensure the PostgreSQL service is running and the referenced `DATABASE_URL` is correct. You can run migrations once manually with Railway CLI: `railway run npm run db:migrate`.
- **502 / not responding**: Confirm the app listens on `0.0.0.0` (already set in `server.js`) and that `healthcheckPath` is `/` (set in `railway.toml`).

---

## Summary checklist

- [ ] New Railway project with PostgreSQL service
- [ ] Backend service added from GitHub with Root Directory = `swiftdrop/backend`
- [ ] `DATABASE_URL` added as reference from PostgreSQL
- [ ] `JWT_SECRET` set (long random string)
- [ ] Domain generated for the backend service
- [ ] API base URL set in mobile app and admin dashboard

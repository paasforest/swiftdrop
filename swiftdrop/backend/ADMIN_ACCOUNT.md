# Admin account

Admin API routes (`/api/admin/*`) require a JWT for a user with **`user_type = 'admin'`**.

## Create an admin if you have none

With `DATABASE_URL` set (e.g. in `swiftdrop/backend/.env`):

**From repo root** (`dropoff/`):

```bash
npm run db:ensure-admin
```

**Or from** `swiftdrop/backend/`:

```bash
npm run db:ensure-admin
```

- If **any** active admin already exists, the script prints their **email / phone** and does nothing.
- If **no** admin exists, it creates one (or promotes the user with the admin email) and prints login details.

**Railway:** `db:ensure-admin` runs automatically after `db:migrate` on each deploy (see `railway.toml`).

## Default credentials (development)

If the script creates the first admin and you did **not** set env overrides:

| Field    | Value                    |
|----------|--------------------------|
| Email    | `admin@swiftdrop.local`  |
| Phone    | `+27000000001`           |
| Password | `Password123!`           |

Log in via the app (or `POST /api/auth/login` with email + password) to get a token, then open admin screens.

## Production

Set strong, unique values in your host’s environment (e.g. Railway **Variables**):

| Variable         | Purpose                                      |
|------------------|----------------------------------------------|
| `ADMIN_EMAIL`    | Admin login email                            |
| `ADMIN_PHONE`    | E.164 SA mobile (e.g. `+27821234567`)        |
| `ADMIN_PASSWORD` | At least 8 characters                        |
| `ADMIN_NAME`     | Display name (optional)                      |

If no admin exists on deploy, `ensure-admin` uses these to create the first admin. **Change `ADMIN_PASSWORD` from the default before going live.**

## Alternative: full seed (dev)

`npm run db:seed` also inserts a test admin with the same default email/phone/password as above, plus customer and driver test users. Use only when you want the full fixture set.

---

## Troubleshooting: `{"error":"Invalid credentials"}` on login

The API does not tell you *why* (wrong email, wrong password, or user missing). Check these in order:

### 1. User missing in production

Deploy runs `db:ensure-admin` only if migrations succeed. If the DB was empty and something failed, or you never deployed after adding it, create the admin manually.

**Railway:** open your backend service → **Deployments** → **⋮** on a deployment → **Run command** (or use [Railway CLI](https://docs.railway.app/develop/cli)):

```bash
npm run db:ensure-admin
```

Set variables first if you want non-default credentials: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE`, `ADMIN_NAME`.

### 2. Password is not the default

If an admin **already existed** when `ensure-admin` ran, it **does not** change passwords. The first successful run may have used **`ADMIN_PASSWORD` from Railway** (not `Password123!`).

**Fix:** reset the password for that email:

```bash
ADMIN_EMAIL=admin@swiftdrop.local ADMIN_PASSWORD='YourNewSecurePass' npm run db:reset-admin-password
```

(Run with the same `DATABASE_URL` as production, e.g. `railway run` from the backend folder.)

### 3. Phone verification required

If `REQUIRE_PHONE_VERIFICATION` is `true` (default), login only finds users with **`is_verified = true`**. `db:reset-admin-password` and `db:ensure-admin` both set `is_verified = true` for the admin.

### 4. Confirm login request

Use **email + password** (not only phone unless you use phone in the body):

```bash
curl -s -X POST "https://YOUR-API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@swiftdrop.local","password":"Password123!"}'
```

Expect `token` and `user` in the JSON response.

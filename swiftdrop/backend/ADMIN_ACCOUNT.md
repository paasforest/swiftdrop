# Admin account

Admin API routes (`/api/admin/*`) require a JWT for a user with **`user_type = 'admin'`**.

## Create an admin if you have none

From `swiftdrop/backend` with `DATABASE_URL` set:

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

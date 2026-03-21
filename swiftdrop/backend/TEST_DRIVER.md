# Pre-approved test driver

Creates (or updates) a **driver** user with `driver_profiles.verification_status = 'approved'` so they can log in immediately.

## Default credentials

| Field | Default |
|-------|---------|
| Phone | `0762458485` → stored as `+27762458485` |
| Password | `Admin123!` |
| Email | `driver.27762458485@swiftdrop.test` (derived from canonical phone) |
| Name | `Test Driver (Approved)` |

Override with env: `TEST_DRIVER_PHONE`, `TEST_DRIVER_PASSWORD`, `TEST_DRIVER_EMAIL`, `TEST_DRIVER_NAME`.

## Run

From repo root (needs `DATABASE_URL` in `swiftdrop/backend/.env` or environment):

```bash
npm run db:ensure-test-driver
```

Log in as driver using **phone** or **email** + password (same as other users).

**Note:** If a user with that phone already exists, their password and role are updated to match; **email is unchanged** unless you set `TEST_DRIVER_EMAIL`.

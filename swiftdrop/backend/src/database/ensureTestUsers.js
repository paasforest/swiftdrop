/**
 * Upsert test driver + test customer accounts for staging/testing.
 * Idempotent: safe to re-run — uses ON CONFLICT (email) to upsert.
 *
 * Test credentials (change via env vars if needed):
 *   driver@swiftdrop.local  / Password123!
 *   customer@swiftdrop.local / Password123!
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');

const DRIVER_EMAIL    = process.env.TEST_DRIVER_EMAIL    || 'driver@swiftdrop.local';
const DRIVER_PHONE    = process.env.TEST_DRIVER_PHONE    || '+27000000003';
const DRIVER_NAME     = process.env.TEST_DRIVER_NAME     || 'Test Driver';
const DRIVER_PASSWORD = process.env.TEST_DRIVER_PASSWORD || 'Password123!';

const CUSTOMER_EMAIL    = process.env.TEST_CUSTOMER_EMAIL    || 'customer@swiftdrop.local';
const CUSTOMER_PHONE    = process.env.TEST_CUSTOMER_PHONE    || '+27000000002';
const CUSTOMER_NAME     = process.env.TEST_CUSTOMER_NAME     || 'Test Customer';
const CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'Password123!';

async function ensureTestUsers() {
  try {
    const driverHash   = await bcrypt.hash(DRIVER_PASSWORD, 10);
    const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);

    // ── Test driver ────────────────────────────────────────────
    const driverRes = await db.query(
      `INSERT INTO users
         (full_name, email, phone, password_hash, user_type, is_verified, is_active)
       VALUES ($1, $2, $3, $4, 'driver', true, true)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name     = EXCLUDED.full_name,
         user_type     = 'driver',
         is_verified   = true,
         is_active     = true
       RETURNING id`,
      [DRIVER_NAME, DRIVER_EMAIL, DRIVER_PHONE, driverHash]
    );
    const driverId = driverRes.rows[0].id;

    // Ensure driver_profiles row (approved)
    await db.query(
      `INSERT INTO driver_profiles (user_id, verification_status, approved_at)
       VALUES ($1, 'approved', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         verification_status = 'approved',
         approved_at = COALESCE(driver_profiles.approved_at, NOW())`,
      [driverId]
    );

    // Ensure driver_tiers row
    await db.query(
      `INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed, current_rating)
       VALUES ($1, 'new', 0, 5.0)
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );

    // Ensure driver_locations row (offline seed)
    await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
       VALUES ($1, NULL, NULL, false, NOW())
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );

    console.log(`[ensure-test-users] Driver  upserted — id=${driverId}  email=${DRIVER_EMAIL}`);

    // ── Test customer ──────────────────────────────────────────
    const customerRes = await db.query(
      `INSERT INTO users
         (full_name, email, phone, password_hash, user_type, is_verified, is_active)
       VALUES ($1, $2, $3, $4, 'customer', true, true)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name     = EXCLUDED.full_name,
         user_type     = 'customer',
         is_verified   = true,
         is_active     = true
       RETURNING id`,
      [CUSTOMER_NAME, CUSTOMER_EMAIL, CUSTOMER_PHONE, customerHash]
    );
    const customerId = customerRes.rows[0].id;
    console.log(`[ensure-test-users] Customer upserted — id=${customerId}  email=${CUSTOMER_EMAIL}`);

    console.log('');
    console.log('========== Test accounts ==========');
    console.log(`  Driver:   ${DRIVER_EMAIL}   / ${DRIVER_PASSWORD}`);
    console.log(`  Customer: ${CUSTOMER_EMAIL} / ${CUSTOMER_PASSWORD}`);
    console.log('===================================');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('[ensure-test-users] Error:', err.message);
    process.exit(1);
  }
}

ensureTestUsers();

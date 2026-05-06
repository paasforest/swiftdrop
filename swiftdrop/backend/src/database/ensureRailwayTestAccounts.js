/**
 * Upsert production-style test accounts (swiftdrop.co.za).
 * Requires DATABASE_URL (e.g. Railway Postgres connection string).
 *
 *   cd swiftdrop/backend && DATABASE_URL="postgresql://..." node src/database/ensureRailwayTestAccounts.js
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');

const PASSWORD = 'SwiftDrop2025!';

async function upsertDriverExtras(driverId) {
  const prof = await db.query(`SELECT id FROM driver_profiles WHERE user_id = $1`, [driverId]);
  if (prof.rows.length > 0) {
    await db.query(
      `UPDATE driver_profiles SET verification_status = 'approved', approved_at = NOW() WHERE user_id = $1`,
      [driverId]
    );
  } else {
    await db.query(
      `INSERT INTO driver_profiles (user_id, verification_status, approved_at) VALUES ($1, 'approved', NOW())`,
      [driverId]
    );
  }

  await db.query(
    `INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed, current_rating)
     VALUES ($1, 'new', 0, 5.0)
     ON CONFLICT (driver_id) DO NOTHING`,
    [driverId]
  );

  await db.query(
    `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
     VALUES ($1, NULL, NULL, false, NOW())
     ON CONFLICT (driver_id) DO NOTHING`,
    [driverId]
  );
}

async function createAccounts() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  await db.query(
    `INSERT INTO users (full_name, email, phone, password_hash, user_type, is_verified, is_active)
     VALUES ($1, $2, $3, $4, 'customer', true, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       phone = EXCLUDED.phone,
       user_type = 'customer',
       is_verified = true,
       is_active = true`,
    ['Test Customer', 'testcustomer@swiftdrop.co.za', '+27800000001', hash]
  );

  const driverResult = await db.query(
    `INSERT INTO users (full_name, email, phone, password_hash, user_type, is_verified, is_active)
     VALUES ($1, $2, $3, $4, 'driver', true, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       phone = EXCLUDED.phone,
       user_type = 'driver',
       is_verified = true,
       is_active = true
     RETURNING id`,
    ['Test Driver', 'testdriver@swiftdrop.co.za', '+27800000002', hash]
  );

  let driverId = driverResult.rows[0]?.id;
  if (!driverId) {
    const r = await db.query(`SELECT id FROM users WHERE email = $1`, ['testdriver@swiftdrop.co.za']);
    driverId = r.rows[0]?.id;
  }

  if (driverId) {
    await upsertDriverExtras(driverId);
  }

  console.log('Test accounts created:');
  console.log('Customer: testcustomer@swiftdrop.co.za');
  console.log('Driver: testdriver@swiftdrop.co.za');
  console.log('Password: SwiftDrop2025!');
  process.exit(0);
}

createAccounts().catch((err) => {
  console.error(err);
  process.exit(1);
});

const bcrypt = require('bcryptjs');
const db = require('./connection');

async function seed() {
  try {
    console.log('Seeding database with initial data...');

    const passwordHash = await bcrypt.hash('Password123!', 10);

    const adminRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, full_name, user_type, is_verified)
       VALUES ($1, $2, $3, $4, 'admin', true)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      ['admin@swiftdrop.local', '+27000000001', passwordHash, 'Test Admin']
    );

    const customerRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, full_name, user_type, is_verified)
       VALUES ($1, $2, $3, $4, 'customer', true)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      ['customer@swiftdrop.local', '+27000000002', passwordHash, 'Test Customer']
    );

    const driverRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, full_name, user_type, is_verified)
       VALUES ($1, $2, $3, $4, 'driver', true)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      ['driver@swiftdrop.local', '+27000000003', passwordHash, 'Test Driver']
    );

    const driverId = driverRes.rows[0].id;

    await db.query(
      `INSERT INTO driver_profiles (user_id, verification_status)
       VALUES ($1, 'approved')`,
      [driverId]
    );

    await db.query(
      `INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed, current_rating)
       VALUES ($1, 'new', 0, 5.0)`,
      [driverId]
    );

    console.log('Seed data inserted successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

seed();

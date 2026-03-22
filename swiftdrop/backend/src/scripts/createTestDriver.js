/**
 * One-time script: create/update Charles test driver (DB only).
 *
 * Usage: npm run create:driver
 * Requires DATABASE_URL (or same env as backend).
 */
const db = require('../database/connection');
const bcrypt = require('bcryptjs');

async function createTestDriver() {
  try {
    const hash = await bcrypt.hash('Driver123', 10);

    const userResult = await db.query(
      `
      INSERT INTO users (
        email, phone, password_hash, full_name,
        user_type, is_verified, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          phone = EXCLUDED.phone,
          full_name = EXCLUDED.full_name,
          user_type = EXCLUDED.user_type,
          is_verified = EXCLUDED.is_verified,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      RETURNING id, email, user_type
    `,
      [
        'charles@swiftdrop.com',
        '+27679518124',
        hash,
        'Charles Matia',
        'driver',
        true,
        true,
      ]
    );

    const user = userResult.rows[0];
    console.log('User created/updated:', user);

    const prof = await db.query(`SELECT id FROM driver_profiles WHERE user_id = $1`, [user.id]);
    if (prof.rows.length > 0) {
      await db.query(
        `
        UPDATE driver_profiles SET
          verification_status = $2,
          vehicle_make = $3,
          vehicle_model = $4,
          vehicle_year = $5,
          vehicle_color = $6,
          vehicle_plate = $7,
          approved_at = COALESCE(approved_at, NOW())
        WHERE user_id = $1
      `,
        [
          user.id,
          'approved',
          'Toyota',
          'Corolla',
          2020,
          'White',
          'CA 123-456',
        ]
      );
    } else {
      await db.query(
        `
        INSERT INTO driver_profiles (
          user_id, verification_status,
          vehicle_make, vehicle_model,
          vehicle_year, vehicle_color, vehicle_plate,
          approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
        [
          user.id,
          'approved',
          'Toyota',
          'Corolla',
          2020,
          'White',
          'CA 123-456',
        ]
      );
    }

    console.log('Driver profile created/updated');

    const tier = await db.query(`SELECT id FROM driver_tiers WHERE driver_id = $1`, [user.id]);
    if (tier.rows.length === 0) {
      await db.query(
        `
        INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed, current_rating)
        VALUES ($1, 'new', 0, 5.0)
      `,
        [user.id]
      );
      console.log('Driver tier created');
    }

    await db.query(
      `
      INSERT INTO driver_locations (
        driver_id, lat, lng, is_online, updated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (driver_id) DO UPDATE
      SET lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          is_online = EXCLUDED.is_online,
          updated_at = NOW()
    `,
      [user.id, -33.6462, 19.4485, true]
    );

    console.log('Driver location created/updated');
    console.log('SUCCESS - Login with:');
    console.log('Email: charles@swiftdrop.com');
    console.log('Password: Driver123');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.code === '23505') {
      console.error(
        '(Unique violation: email or phone already in use by another row. Fix DB or change values.)'
      );
    }
    process.exit(1);
  }
}

createTestDriver();

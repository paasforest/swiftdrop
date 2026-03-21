/**
 * Create or update a pre-approved driver for local/staging testing.
 *
 * Env (defaults match common test request):
 *   TEST_DRIVER_PHONE     default: 0762458485
 *   TEST_DRIVER_PASSWORD  default: Admin123!
 *   TEST_DRIVER_EMAIL     default: derived (driver.{digits}@swiftdrop.test)
 *   TEST_DRIVER_NAME      default: Test Driver (Approved)
 *
 * Requires DATABASE_URL. Idempotent: safe to re-run (updates password + approval).
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');
const { normalizeSouthAfricaToE164 } = require('../utils/phoneNormalize');

const RAW_PHONE = process.env.TEST_DRIVER_PHONE || '0762458485';
const PASSWORD = process.env.TEST_DRIVER_PASSWORD || 'Admin123!';
const FULL_NAME = process.env.TEST_DRIVER_NAME || 'Test Driver (Approved)';

function defaultEmailFromE164(e164) {
  const digits = String(e164 || '').replace(/\D/g, '');
  return `driver.${digits}@swiftdrop.test`;
}

async function ensureTestDriver() {
  try {
    const phone = normalizeSouthAfricaToE164(RAW_PHONE);
    if (!phone) {
      console.error('[ensure-test-driver] Invalid TEST_DRIVER_PHONE:', RAW_PHONE);
      process.exit(1);
      return;
    }

    if (!PASSWORD || String(PASSWORD).length < 8) {
      console.error('[ensure-test-driver] TEST_DRIVER_PASSWORD must be at least 8 characters.');
      process.exit(1);
      return;
    }

    const email = (process.env.TEST_DRIVER_EMAIL || '').trim() || defaultEmailFromE164(phone);
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const existingByPhone = await db.query(`SELECT id, email, user_type FROM users WHERE phone = $1`, [phone]);

    let userId;

    if (existingByPhone.rows.length > 0) {
      userId = existingByPhone.rows[0].id;
      const envEmail = (process.env.TEST_DRIVER_EMAIL || '').trim();
      if (envEmail) {
        await db.query(
          `UPDATE users SET
             email = $1,
             password_hash = $2,
             full_name = $3,
             user_type = 'driver',
             is_verified = true,
             is_active = true
           WHERE id = $4`,
          [envEmail, passwordHash, FULL_NAME, userId]
        );
      } else {
        await db.query(
          `UPDATE users SET
             password_hash = $1,
             full_name = $2,
             user_type = 'driver',
             is_verified = true,
             is_active = true
           WHERE id = $3`,
          [passwordHash, FULL_NAME, userId]
        );
      }
      console.log(`[ensure-test-driver] Updated existing user id=${userId} (phone ${phone}).`);
    } else {
      const ins = await db.query(
        `INSERT INTO users (email, phone, password_hash, full_name, user_type, is_verified, is_active)
         VALUES ($1, $2, $3, $4, 'driver', true, true)
         RETURNING id`,
        [email, phone, passwordHash, FULL_NAME]
      );
      userId = ins.rows[0].id;
      console.log(`[ensure-test-driver] Created driver user id=${userId} (phone ${phone}).`);
    }

    const prof = await db.query(`SELECT id FROM driver_profiles WHERE user_id = $1`, [userId]);
    if (prof.rows.length > 0) {
      await db.query(
        `UPDATE driver_profiles SET
           verification_status = 'approved',
           approved_at = COALESCE(approved_at, NOW())
         WHERE user_id = $1`,
        [userId]
      );
      console.log('[ensure-test-driver] driver_profiles: set approved.');
    } else {
      await db.query(
        `INSERT INTO driver_profiles (user_id, verification_status, approved_at)
         VALUES ($1, 'approved', NOW())`,
        [userId]
      );
      console.log('[ensure-test-driver] driver_profiles: inserted approved.');
    }

    const tier = await db.query(`SELECT id FROM driver_tiers WHERE driver_id = $1`, [userId]);
    if (tier.rows.length === 0) {
      await db.query(
        `INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed, current_rating)
         VALUES ($1, 'new', 0, 5.0)`,
        [userId]
      );
      console.log('[ensure-test-driver] driver_tiers: inserted.');
    } else {
      console.log('[ensure-test-driver] driver_tiers: already present.');
    }

    await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, is_online, updated_at)
       VALUES ($1, NULL, NULL, false, NOW())
       ON CONFLICT (driver_id) DO NOTHING`,
      [userId]
    );

    const uRow = await db.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const outEmail = uRow.rows[0]?.email || email;

    console.log('');
    console.log('========== Test driver login ==========');
    console.log(`  Phone:    ${phone}   (or dial ${RAW_PHONE})`);
    console.log(`  Email:    ${outEmail}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  Status:   approved (can log in as driver)`);
    console.log('========================================');
    console.log('');
    process.exit(0);
  } catch (err) {
    if (err.code === '23505') {
      console.error(
        '[ensure-test-driver] Unique conflict (email or phone). Set TEST_DRIVER_EMAIL to a free address or fix DB.'
      );
    }
    console.error('[ensure-test-driver] Error:', err.message);
    process.exit(1);
  }
}

ensureTestDriver();

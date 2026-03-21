/**
 * One-off: set password (and admin role) for an existing user by email.
 * Use when login fails but the user row exists, or you need to recover access.
 *
 *   ADMIN_EMAIL=admin@swiftdrop.local ADMIN_PASSWORD='YourNewPass' npm run db:reset-admin-password
 *
 * Requires DATABASE_URL. Sets: password_hash, user_type=admin, is_verified=true, is_active=true.
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');

const email = process.env.ADMIN_EMAIL || 'admin@swiftdrop.local';
const password = process.env.ADMIN_PASSWORD;

async function run() {
  try {
    if (!password || String(password).length < 8) {
      console.error('[reset-admin-password] Set ADMIN_PASSWORD in the environment (min 8 characters).');
      process.exit(1);
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      `UPDATE users SET
         password_hash = $1,
         user_type = 'admin',
         is_verified = true,
         is_active = true
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($2))
       RETURNING id, email, phone`,
      [hash, email]
    );

    if (r.rowCount === 0) {
      console.error(
        `[reset-admin-password] No user with email "${email}". Run npm run db:ensure-admin first (empty DB).`
      );
      process.exit(1);
      return;
    }

    const u = r.rows[0];
    console.log('[reset-admin-password] Updated admin login:');
    console.log(`  id:    ${u.id}`);
    console.log(`  email: ${u.email}`);
    console.log(`  phone: ${u.phone}`);
    console.log(`  Password is whatever you set in ADMIN_PASSWORD.`);
    process.exit(0);
  } catch (err) {
    console.error('[reset-admin-password] Error:', err.message);
    process.exit(1);
  }
}

run();

/**
 * Ensures at least one admin user exists.
 * Run after migrations: npm run db:ensure-admin
 *
 * Env (optional overrides):
 *   ADMIN_EMAIL    default: admin@swiftdrop.local
 *   ADMIN_PHONE    default: +27000000001
 *   ADMIN_PASSWORD default: Password123!  (CHANGE IN PRODUCTION via env)
 *   ADMIN_NAME     default: SwiftDrop Admin
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');

const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || 'admin@swiftdrop.local';
const DEFAULT_PHONE = process.env.ADMIN_PHONE || '+27000000001';
const DEFAULT_NAME = process.env.ADMIN_NAME || 'SwiftDrop Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password123!';

async function ensureAdmin() {
  try {
    const existing = await db.query(
      `SELECT id, email, phone, full_name FROM users WHERE user_type = 'admin' AND is_active = true ORDER BY id ASC LIMIT 5`
    );

    if (existing.rows.length > 0) {
      // Admin exists — ensure they have a valid bcrypt password (not firebase-auth placeholder)
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      for (const r of existing.rows) {
        const cur = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [r.id]);
        const currentHash = cur.rows[0]?.password_hash ?? '';
        const needsUpdate = !currentHash || currentHash === 'firebase-auth' || !currentHash.startsWith('$2');
        if (needsUpdate) {
          await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, r.id]);
          console.log(`[ensure-admin] Updated password_hash for admin id=${r.id} (${r.email}).`);
        } else {
          console.log(`[ensure-admin] Admin id=${r.id} (${r.email}) already has a valid password hash.`);
        }
      }
      process.exit(0);
      return;
    }

    if (ADMIN_PASSWORD.length < 8) {
      console.error('[ensure-admin] ADMIN_PASSWORD must be at least 8 characters.');
      process.exit(1);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const byEmail = await db.query(`SELECT id, user_type FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`, [
      DEFAULT_EMAIL,
    ]);

    if (byEmail.rows.length > 0) {
      const row = byEmail.rows[0];
      const phoneBusy = await db.query(
        `SELECT id FROM users WHERE phone = $1 AND id <> $2`,
        [DEFAULT_PHONE, row.id]
      );
      if (phoneBusy.rows.length > 0) {
        await db.query(
          `UPDATE users SET
             password_hash = $1,
             user_type = 'admin',
             is_verified = true,
             is_active = true,
             full_name = $2
           WHERE id = $3`,
          [passwordHash, DEFAULT_NAME, row.id]
        );
        console.log(
          `[ensure-admin] Promoted user id=${row.id} to admin; phone left unchanged (default phone in use elsewhere).`
        );
      } else {
        await db.query(
          `UPDATE users SET
             password_hash = $1,
             user_type = 'admin',
             is_verified = true,
             is_active = true,
             full_name = $2,
             phone = $3
           WHERE id = $4`,
          [passwordHash, DEFAULT_NAME, DEFAULT_PHONE, row.id]
        );
        console.log(`[ensure-admin] Promoted existing user id=${row.id} to admin (${DEFAULT_EMAIL}).`);
      }
    } else {
      try {
        await db.query(
          `INSERT INTO users (email, phone, password_hash, full_name, user_type, is_verified, is_active)
           VALUES ($1, $2, $3, $4, 'admin', true, true)`,
          [DEFAULT_EMAIL, DEFAULT_PHONE, passwordHash, DEFAULT_NAME]
        );
        console.log(`[ensure-admin] Created new admin user (${DEFAULT_EMAIL}).`);
      } catch (e) {
        if (e.code === '23505') {
          console.error(
            '[ensure-admin] Duplicate email or phone. Set ADMIN_EMAIL / ADMIN_PHONE to unused values and retry.'
          );
        }
        throw e;
      }
    }

    console.log('');
    console.log('========== Admin login (save securely) ==========');
    console.log(`  Email:    ${DEFAULT_EMAIL}`);
    console.log(`  Phone:    ${DEFAULT_PHONE}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('==================================================');
    console.log('');
    console.log('[ensure-admin] Set ADMIN_PASSWORD in production; do not use defaults.');
    process.exit(0);
  } catch (err) {
    console.error('[ensure-admin] Error:', err.message);
    process.exit(1);
  }
}

ensureAdmin();

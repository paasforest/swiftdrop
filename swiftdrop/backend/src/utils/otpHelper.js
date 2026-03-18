const db = require('../database/connection');

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 4;

function generateOTP() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function storeOTP(userId, phone, code, purpose) {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await db.query(
    `INSERT INTO otps (user_id, phone, code, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, phone, code, purpose, expiresAt]
  );
  return { code, expiresAt };
}

async function validateOTP(phone, code, purpose) {
  const result = await db.query(
    `SELECT id, user_id FROM otps
     WHERE phone = $1 AND code = $2 AND purpose = $3
       AND expires_at > NOW() AND consumed_at IS NULL
     ORDER BY expires_at DESC LIMIT 1`,
    [phone, code, purpose]
  );

  if (result.rows.length === 0) return null;

  const otp = result.rows[0];
  await db.query(
    `UPDATE otps SET consumed_at = NOW() WHERE id = $1`,
    [otp.id]
  );
  return otp.user_id;
}

module.exports = {
  generateOTP,
  storeOTP,
  validateOTP,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
};

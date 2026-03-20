const db = require('../database/connection');
const { sendSMS } = require('../services/smsService');

function requireAdmin(user) {
  if (!user || user.user_type !== 'admin') {
    const err = new Error('Admins only');
    err.statusCode = 403;
    throw err;
  }
}

async function listDriverApplications(req, res) {
  try {
    requireAdmin(req.user);
    const status = req.query.status;
    const params = [];

    let where = '';
    if (status) {
      where = 'WHERE dp.verification_status = $1';
      params.push(status);
    }

    const rows = await db.query(
      `SELECT
         u.id as user_id,
         u.full_name,
         u.email,
         u.phone,
         dp.verification_status,
         dp.approved_at,
         dp.selfie_url,
         dp.id_document_url,
         dp.license_url,
         dp.vehicle_registration_url,
         dp.license_disc_url,
         dp.saps_clearance_url,
         dp.vehicle_photo_url,
         dp.vehicle_make,
         dp.vehicle_model,
         dp.vehicle_year,
         dp.vehicle_color,
         dp.vehicle_plate,
         dp.verification_notes,
         dt.tier_name
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = dp.user_id
       ${where}
       ORDER BY dp.created_at DESC
      `,
      params
    );

    return res.json({ drivers: rows.rows });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || 'Failed to list drivers' });
  }
}

async function approveDriver(req, res) {
  try {
    requireAdmin(req.user);
    const { id } = req.params;

    const driverRes = await db.query(
      `SELECT u.id, u.phone, u.full_name, dp.verification_status
       FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1 AND u.user_type = 'driver'`,
      [id]
    );
    const driver = driverRes.rows[0];
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    await db.query(
      `UPDATE driver_profiles
       SET verification_status = 'approved', approved_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [driver.id]
    );

    // Ensure driver can log in.
    await db.query(`UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`, [driver.id]);

    // Exact SMS message requested
    await sendSMS(
      driver.phone,
      'SwiftDrop: Congratulations! Your driver account has been approved. You can now start accepting deliveries.'
    );

    return res.json({ message: 'Driver approved' });
  } catch (err) {
    console.error('approveDriver:', err);
    return res.status(500).json({ error: err.message || 'Approval failed' });
  }
}

module.exports = { listDriverApplications, approveDriver };


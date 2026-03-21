const db = require('../database/connection');
const { sendSMS } = require('../services/smsService');
const { sendPushNotification } = require('../services/notificationService');

function requireAdmin(user) {
  if (!user || user.user_type !== 'admin') {
    const err = new Error('Admins only');
    err.statusCode = 403;
    throw err;
  }
}

function parseNotes(raw) {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const j = JSON.parse(raw);
    return typeof j === 'object' && j !== null ? j : {};
  } catch {
    return {};
  }
}

function registrationTypeFromRow(row) {
  if (row.registration_type) return row.registration_type;
  return row.id_document_url ? 'new_driver' : 'uber_bolt';
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
         u.id AS user_id,
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
         dp.created_at AS applied_at,
         dt.tier_name,
         CASE WHEN dp.id_document_url IS NOT NULL THEN 'new_driver' ELSE 'uber_bolt' END AS registration_type
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = dp.user_id
       ${where}
       ORDER BY dp.created_at DESC`,
      params
    );

    return res.json({ drivers: rows.rows });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || 'Failed to list drivers' });
  }
}

/** GET /api/admin/drivers/:id — full application detail (user_id) */
async function getDriverApplicationDetail(req, res) {
  try {
    requireAdmin(req.user);
    const { id } = req.params;

    const rowRes = await db.query(
      `SELECT
         u.id AS user_id,
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
         dp.created_at AS applied_at,
         dt.tier_name,
         CASE WHEN dp.id_document_url IS NOT NULL THEN 'new_driver' ELSE 'uber_bolt' END AS registration_type
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = dp.user_id
       WHERE u.id = $1 AND u.user_type = 'driver'`,
      [id]
    );
    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const row = rowRes.rows[0];
    const notes = parseNotes(row.verification_notes);
    const uberScreenshot = notes.uberProfileScreenshotUrl || null;
    const vehiclePhotoBack = notes.vehiclePhotoBackUrl || null;
    const vehiclePhotoSide = notes.vehiclePhotoSideUrl || null;

    return res.json({
      driver: {
        ...row,
        uber_profile_screenshot_url: uberScreenshot,
        vehicle_photo_back_url: vehiclePhotoBack,
        vehicle_photo_side_url: vehiclePhotoSide,
      },
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || 'Failed to load driver' });
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
       SET verification_status = 'approved', approved_at = NOW()
       WHERE user_id = $1`,
      [driver.id]
    );

    await db.query(`UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`, [driver.id]);

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

async function rejectDriver(req, res) {
  try {
    requireAdmin(req.user);
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const driverRes = await db.query(
      `SELECT u.id, u.phone, u.full_name, dp.verification_notes
       FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1 AND u.user_type = 'driver'`,
      [id]
    );
    const driver = driverRes.rows[0];
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const prev = parseNotes(driver.verification_notes);
    const merged = JSON.stringify({
      ...prev,
      rejection_reason: String(reason).trim(),
      rejected_at: new Date().toISOString(),
    });

    await db.query(
      `UPDATE driver_profiles
       SET verification_status = 'rejected', verification_notes = $1
       WHERE user_id = $2`,
      [merged, driver.id]
    );

    const sms = `SwiftDrop: Your driver application was not approved. Reason: ${String(reason).trim()}. You may reapply after 30 days.`;
    await sendSMS(driver.phone, sms);

    await sendPushNotification(
      driver.id,
      'Application update',
      'Your driver application was not approved. Check SMS for details.',
      { type: 'driver_application_rejected', userId: String(driver.id) }
    );

    return res.json({ message: 'Application rejected' });
  } catch (err) {
    console.error('rejectDriver:', err);
    return res.status(500).json({ error: err.message || 'Reject failed' });
  }
}

module.exports = {
  listDriverApplications,
  getDriverApplicationDetail,
  approveDriver,
  rejectDriver,
};

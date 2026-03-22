const db = require('../database/connection');
const { uploadImage } = require('../services/cloudinaryService');

async function maybeUpload(files, fieldName) {
  const arr = files?.[fieldName];
  const file = arr?.[0];
  if (!file) return null;
  const uploaded = await uploadImage(file);
  return uploaded?.secure_url || null;
}

function parseBodyJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

async function submitDriverApplication(req, res) {
  try {
    if (!req.user || req.user.user_type !== 'driver') {
      return res.status(403).json({ error: 'Drivers only' });
    }

    const userId = req.user.id;
    const body = req.body || {};

    const applicationPath = String(body.application_path || '').toLowerCase();
    if (!['uber_bolt', 'new_driver'].includes(applicationPath)) {
      return res.status(400).json({
        error: 'application_path must be "uber_bolt" or "new_driver"',
      });
    }

    // Required files
    const selfieUrl = await maybeUpload(req.files, 'selfie');
    if (!selfieUrl) {
      return res.status(400).json({ error: 'Profile photo (selfie) is required' });
    }

    // Uber/Bolt existing driver path
    const uberProfileScreenshotUrl =
      applicationPath === 'uber_bolt'
        ? await maybeUpload(req.files, 'uber_profile_screenshot')
        : null;
    const vehiclePhotoUrl =
      applicationPath === 'uber_bolt'
        ? await maybeUpload(req.files, 'vehicle_photo')
        : null;

    const vehicleMake = body.vehicle_make || null;
    const vehicleModel = body.vehicle_model || null;
    const vehicleYearRaw = body.vehicle_year || null;
    const vehicleYear = vehicleYearRaw ? Number(vehicleYearRaw) : null;
    const vehicleColor = body.vehicle_color || null;
    const vehiclePlate = body.vehicle_plate || null;

    if (applicationPath === 'uber_bolt') {
      if (!uberProfileScreenshotUrl) {
        return res.status(400).json({ error: 'Uber/Bolt profile screenshot is required' });
      }
      if (!vehiclePhotoUrl) {
        return res.status(400).json({ error: 'Vehicle photo is required' });
      }
    }

    // New driver path
    const nationalIdUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'national_id')
        : null;
    const driversLicenseUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'drivers_license')
        : null;
    const vehicleRegistrationUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'vehicle_registration')
        : null;
    const licenseDiscUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'license_disc')
        : null;
    const sapsClearanceUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'saps_clearance')
        : null;

    const vehicleFrontUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'vehicle_photo_front')
        : null;
    const vehicleBackUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'vehicle_photo_back')
        : null;
    const vehicleSideUrl =
      applicationPath === 'new_driver'
        ? await maybeUpload(req.files, 'vehicle_photo_side')
        : null;

    if (applicationPath === 'new_driver') {
      if (!nationalIdUrl) return res.status(400).json({ error: 'National ID is required' });
      if (!driversLicenseUrl) return res.status(400).json({ error: 'Driver license is required' });
      if (!vehicleRegistrationUrl)
        return res.status(400).json({ error: 'Vehicle registration is required' });
      if (!licenseDiscUrl) return res.status(400).json({ error: 'License disc is required' });
      if (!vehicleFrontUrl) return res.status(400).json({ error: 'Vehicle front photo is required' });
      if (!vehicleBackUrl) return res.status(400).json({ error: 'Vehicle back photo is required' });
      if (!vehicleSideUrl) return res.status(400).json({ error: 'Vehicle side photo is required' });
    }

    const extraNotes = parseBodyJson(body.extra_notes) || {};
    if (applicationPath === 'uber_bolt') {
      extraNotes.uberProfileScreenshotUrl = uberProfileScreenshotUrl;
    } else {
      extraNotes.vehiclePhotoBackUrl = vehicleBackUrl;
      extraNotes.vehiclePhotoSideUrl = vehicleSideUrl;
    }

    await db.query(
      `UPDATE driver_profiles
       SET
         selfie_url = $1,
         id_document_url = $2,
         license_url = $3,
         vehicle_registration_url = $4,
         license_disc_url = $5,
         saps_clearance_url = $6,
         vehicle_photo_url = $7,
         vehicle_make = $8,
         vehicle_model = $9,
         vehicle_year = $10,
         vehicle_color = $11,
         vehicle_plate = $12,
         verification_status = 'pending',
         verification_notes = $13
       WHERE user_id = $14`,
      [
        selfieUrl,
        applicationPath === 'new_driver' ? nationalIdUrl : null,
        applicationPath === 'new_driver' ? driversLicenseUrl : null,
        applicationPath === 'new_driver' ? vehicleRegistrationUrl : null,
        applicationPath === 'new_driver' ? licenseDiscUrl : null,
        applicationPath === 'new_driver' ? sapsClearanceUrl : null,
        applicationPath === 'new_driver' ? vehicleFrontUrl : vehiclePhotoUrl,
        applicationPath === 'uber_bolt' ? vehicleMake : null,
        applicationPath === 'uber_bolt' ? vehicleModel : null,
        applicationPath === 'uber_bolt' ? vehicleYear : null,
        applicationPath === 'uber_bolt' ? vehicleColor : null,
        applicationPath === 'uber_bolt' ? vehiclePlate : null,
        JSON.stringify(extraNotes || {}),
        userId,
      ]
    );

    // Customer app / auth expose `users.profile_photo_url` as the public driver face.
    // Selfie was only on driver_profiles.selfie_url before — keep both in sync.
    await db.query(
      `UPDATE users SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2`,
      [selfieUrl, userId]
    );

    return res.json({ message: 'Application submitted', verification_status: 'pending' });
  } catch (err) {
    console.error('submitDriverApplication:', err);
    return res.status(500).json({ error: err.message || 'Submit failed' });
  }
}

module.exports = { submitDriverApplication };


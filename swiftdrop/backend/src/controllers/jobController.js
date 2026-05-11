const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { generateOrderOtp } = require('../utils/otpHelper');
const { queueSMS } = require('../services/smsQueue');
const {
  deductWallet,
  refundWallet,
  InsufficientWalletBalanceError,
} = require('../utils/wallet');

/** Same pattern as orderController.generateOrderNumber — unique order_number for job-board → orders bridge */
function generateJobBoardOrderNumber() {
  return `SD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const LOCAL_PRICING = {
  small: [
    { maxKm: 10, price: 150 },
    { maxKm: 30, price: 200 },
    { maxKm: 80, price: 260 },
    { maxKm: Infinity, price: 320 },
  ],
  medium: [
    { maxKm: 10, price: 200 },
    { maxKm: 30, price: 270 },
    { maxKm: 80, price: 350 },
    { maxKm: Infinity, price: 420 },
  ],
  large: [
    { maxKm: 10, price: 270 },
    { maxKm: 30, price: 360 },
    { maxKm: 80, price: 460 },
    { maxKm: Infinity, price: 560 },
  ],
};

const INTERCITY_PRICING = {
  small: [
    { maxKm: 150, price: 80 },
    { maxKm: 400, price: 130 },
    { maxKm: 700, price: 180 },
    { maxKm: Infinity, price: 250 },
  ],
  medium: [
    { maxKm: 150, price: 120 },
    { maxKm: 400, price: 200 },
    { maxKm: 700, price: 270 },
    { maxKm: Infinity, price: 370 },
  ],
  large: [
    { maxKm: 150, price: 170 },
    { maxKm: 400, price: 280 },
    { maxKm: 700, price: 380 },
    { maxKm: Infinity, price: 500 },
  ],
};

function getPrice(size, distKm, type) {
  const table = type === 'intercity' ? INTERCITY_PRICING : LOCAL_PRICING;
  const tiers = table[size?.toLowerCase()] || table.small;
  const tier = tiers.find((t) => distKm <= t.maxKm);
  return tier?.price || tiers[0].price;
}

function insuranceFee(value) {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  if (v <= 200) return 0;
  if (v <= 500) return 15;
  if (v <= 1000) return 25;
  if (v <= 2000) return 40;
  return 40;
}

function estimatedMinutes(distKm, type) {
  const t = type === 'intercity' ? 'intercity' : 'local';
  if (t === 'intercity') {
    return Math.round((distKm / 100) * 60 + 30);
  }
  return Math.round((distKm / 30) * 60 + 15);
}

function finiteCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln);
}

async function notifyMatchingDrivers(job) {
  try {
    const plat = Number(job.pickup_lat);
    const plng = Number(job.pickup_lng);
    const dlat = Number(job.dropoff_lat);
    const dlng = Number(job.dropoff_lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)
      || !Number.isFinite(dlat) || !Number.isFinite(dlng)) {
      return;
    }

    const { rows: drivers } = await db.query(
      `
          SELECT DISTINCT
            u.id,
            u.phone,
            u.full_name,
            dr.id AS route_id
          FROM driver_routes dr
          JOIN users u ON u.id = dr.driver_id
          WHERE dr.status = 'active'
            AND dr.trip_type = 'intercity'
            AND dr.departure_time > NOW()
            AND dr.from_lat IS NOT NULL
            AND dr.from_lng IS NOT NULL
            AND dr.to_lat IS NOT NULL
            AND dr.to_lng IS NOT NULL
            AND (
              6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
                cos(radians($1::double precision))
                * cos(radians(dr.from_lat::double precision))
                * cos(radians(dr.from_lng::double precision) - radians($2::double precision))
                + sin(radians($1::double precision))
                * sin(radians(dr.from_lat::double precision))
              )))
            ) <= 50
            AND (
              6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
                cos(radians($3::double precision))
                * cos(radians(dr.to_lat::double precision))
                * cos(radians(dr.to_lng::double precision) - radians($4::double precision))
                + sin(radians($3::double precision))
                * sin(radians(dr.to_lat::double precision))
              )))
            ) <= 50
        `,
      [plat, plng, dlat, dlng]
    );

    for (const driver of drivers) {
      if (driver.phone) {
        queueSMS(
          driver.phone,
          `SwiftDrop: A parcel job matches your route!\n${String(job.pickup_address).split(',')[0]} → ${String(job.dropoff_address).split(',')[0]}\nOpen the app to apply.`,
          `JOB-NOTIFY-IC-${job.id}-${driver.id}-${Date.now()}`
        ).catch((err) => console.error('SMS queue error:', err));
      }
    }
  } catch (err) {
    console.error('notifyMatchingDrivers:', err);
  }
}

async function notifyNearbyDrivers(job) {
  try {
    const plat = Number(job.pickup_lat);
    const plng = Number(job.pickup_lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;

    const { rows: drivers } = await db.query(
      `
          SELECT u.id, u.phone
          FROM driver_locations dl
          JOIN users u ON u.id = dl.driver_id
          JOIN driver_profiles dp ON dp.user_id = dl.driver_id
          WHERE dp.verification_status = 'approved'
            AND dl.updated_at > NOW() - INTERVAL '30 minutes'
            AND dl.lat IS NOT NULL
            AND dl.lng IS NOT NULL
            AND (
              6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
                cos(radians($1::double precision))
                * cos(radians(dl.lat::double precision))
                * cos(radians(dl.lng::double precision) - radians($2::double precision))
                + sin(radians($1::double precision))
                * sin(radians(dl.lat::double precision))
              )))
            ) <= 25
        `,
      [plat, plng]
    );

    for (const driver of drivers) {
      if (driver.phone) {
        queueSMS(
          driver.phone,
          `SwiftDrop: New delivery job near you!\n${String(job.pickup_address).split(',')[0]} → ${String(job.dropoff_address).split(',')[0]}\nOpen SwiftDrop to apply.`,
          `JOB-NOTIFY-LOCAL-${job.id}-${driver.id}-${Date.now()}`
        ).catch((err) => console.error('SMS queue error:', err));
      }
    }
  } catch (err) {
    console.error('notifyNearbyDrivers:', err);
  }
}

async function estimateJob(req, res) {
  try {
    const {
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      parcel_size,
      parcel_value,
      delivery_type,
    } = req.body;

    if (!finiteCoords(pickup_lat, pickup_lng) || !finiteCoords(dropoff_lat, dropoff_lng)) {
      return res.status(400).json({ error: 'Valid pickup and dropoff coordinates required' });
    }

    const distKm = haversineKm(
      Number(pickup_lat),
      Number(pickup_lng),
      Number(dropoff_lat),
      Number(dropoff_lng)
    );

    const type = delivery_type === 'intercity' ? 'intercity' : 'local';
    const basePrice = getPrice(parcel_size, distKm, type);
    const insurance = insuranceFee(parcel_value);
    const totalPrice = basePrice + insurance;
    const driverEarnings = Math.round(basePrice * 0.8);
    const commission = Math.round(basePrice * 0.2);
    const estMinutes = estimatedMinutes(distKm, type);

    res.json({
      distance_km: Math.round(distKm),
      base_price: basePrice,
      insurance_fee: insurance,
      total_price: totalPrice,
      driver_earnings: driverEarnings,
      estimated_minutes: estMinutes,
    });
  } catch (err) {
    console.error('estimateJob:', err);
    res.status(500).json({ error: 'Could not estimate' });
  }
}

async function createJob(req, res) {
  const customerId = req.user.id;
  const {
    pickup_address,
    pickup_lat,
    pickup_lng,
    dropoff_address,
    dropoff_lat,
    dropoff_lng,
    parcel_size,
    parcel_type,
    parcel_value,
    delivery_type,
    payment_method,
  } = req.body;

  if (!pickup_address?.trim() || !dropoff_address?.trim()) {
    return res.status(400).json({ error: 'pickup_address and dropoff_address are required' });
  }
  if (!finiteCoords(pickup_lat, pickup_lng) || !finiteCoords(dropoff_lat, dropoff_lng)) {
    return res.status(400).json({ error: 'Valid pickup and dropoff coordinates required' });
  }

  const client = await db.getClient();
  try {
    const distKm = haversineKm(
      Number(pickup_lat),
      Number(pickup_lng),
      Number(dropoff_lat),
      Number(dropoff_lng)
    );

    const type = delivery_type === 'intercity' ? 'intercity' : 'local';
    const basePrice = getPrice(parcel_size, distKm, type);
    const insurance = insuranceFee(parcel_value);
    const totalPrice = basePrice + insurance;
    const driverEarnings = Math.round(basePrice * 0.8);
    const commission = Math.round(basePrice * 0.2);
    const estMinutes = estimatedMinutes(distKm, type);

    const pm = payment_method === 'wallet' ? 'wallet' : String(payment_method || 'wallet');
    const paymentStatus = pm === 'wallet' ? 'paid' : 'pending';

    await client.query('BEGIN');

    if (pm === 'wallet') {
      await deductWallet(
        client,
        customerId,
        totalPrice,
        `JOB-${Date.now()}`
      );
    }

    const pickupOtp = generateOrderOtp();
    const deliveryOtp = generateOrderOtp();

    const { rows } = await client.query(
      `
        INSERT INTO delivery_jobs (
          customer_id,
          pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng,
          parcel_size, parcel_type, parcel_value,
          delivery_type,
          base_price, insurance_fee, total_price, driver_earnings,
          commission, distance_km, estimated_minutes,
          payment_method, payment_status,
          pickup_otp, delivery_otp,
          expires_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,
          NOW() + INTERVAL '4 hours'
        )
        RETURNING *
      `,
      [
        customerId,
        pickup_address.trim(),
        Number(pickup_lat),
        Number(pickup_lng),
        dropoff_address.trim(),
        Number(dropoff_lat),
        Number(dropoff_lng),
        parcel_size || 'small',
        parcel_type || 'General',
        Number(parcel_value) || 0,
        type,
        basePrice,
        insurance,
        totalPrice,
        driverEarnings,
        commission,
        Math.round(distKm),
        estMinutes,
        pm,
        paymentStatus,
        pickupOtp,
        deliveryOtp,
      ]
    );

    await client.query('COMMIT');

    const job = rows[0];

    if (type === 'intercity') {
      notifyMatchingDrivers(job).catch((err) => console.error('notifyMatchingDrivers:', err));
    } else {
      notifyNearbyDrivers(job).catch((err) => console.error('notifyNearbyDrivers:', err));
    }

    res.status(201).json({ job });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    if (err instanceof InsufficientWalletBalanceError) {
      return res.status(400).json({
        error: err.message,
        required: err.required,
        available: err.available,
      });
    }
    console.error('createJob:', err);
    res.status(500).json({
      error: 'Something went wrong. Please try again.',
    });
  } finally {
    client.release();
  }
}

async function getMyJobs(req, res) {
  try {
    const customerId = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { rows } = await db.query(
      `
        SELECT
          j.*,
          (
            SELECT COUNT(*)::integer
            FROM job_applications a
            WHERE a.job_id = j.id AND a.status = 'pending'
          ) AS applications_count,
          u.full_name AS driver_name,
          u.phone AS driver_phone,
          dp.vehicle_make,
          dp.vehicle_model,
          dp.vehicle_color,
          dp.vehicle_year,
          dp.vehicle_plate,
          COALESCE(dt.current_rating, 0) AS driver_rating,
          COALESCE(dt.deliveries_completed, 0) AS driver_deliveries
        FROM delivery_jobs j
        LEFT JOIN users u ON u.id = j.selected_driver_id
        LEFT JOIN driver_profiles dp ON dp.user_id = j.selected_driver_id
        LEFT JOIN driver_tiers dt ON dt.driver_id = j.selected_driver_id
        WHERE j.customer_id = $1
          AND j.status NOT IN ('completed', 'cancelled', 'expired')
        ORDER BY j.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [customerId, limit, offset]
    );

    const countRes = await db.query(
      `
        SELECT COUNT(*)::int AS c
        FROM delivery_jobs j
        WHERE j.customer_id = $1
          AND j.status NOT IN ('completed', 'cancelled', 'expired')
      `,
      [customerId]
    );
    const total = countRes.rows[0]?.c || 0;

    res.json({
      jobs: rows,
      pagination: {
        page,
        limit,
        total,
        has_more: rows.length === limit,
      },
    });
  } catch (err) {
    console.error('getMyJobs:', err);
    res.status(500).json({ error: 'Could not load jobs' });
  }
}

async function getAvailableJobs(req, res) {
  try {
    const driverId = req.user.id;
    const radiusKm = Number(req.query.radius_km) || 25;

    const { rows: locRows } = await db.query(
      `SELECT lat, lng FROM driver_locations WHERE driver_id = $1`,
      [driverId]
    );

    const dLat = req.query.lat != null ? Number(req.query.lat) : Number(locRows[0]?.lat);
    const dLng = req.query.lng != null ? Number(req.query.lng) : Number(locRows[0]?.lng);

    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      return res.json({
        jobs: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          has_more: false,
        },
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const countRes = await db.query(
      `
        SELECT COUNT(*)::int AS c
        FROM delivery_jobs j
        WHERE j.status = 'open'
          AND j.expires_at > NOW()
          AND j.payment_status = 'paid'
          AND j.delivery_type = 'local'
          AND j.pickup_lat IS NOT NULL
          AND j.pickup_lng IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM job_applications a
            WHERE a.job_id = j.id AND a.driver_id = $3
          )
          AND (
            6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
              cos(radians($1::double precision))
              * cos(radians(j.pickup_lat::double precision))
              * cos(radians(j.pickup_lng::double precision) - radians($2::double precision))
              + sin(radians($1::double precision))
              * sin(radians(j.pickup_lat::double precision))
            )))
          ) <= $4
      `,
      [dLat, dLng, driverId, radiusKm]
    );
    const total = countRes.rows[0]?.c || 0;

    const { rows } = await db.query(
      `
        SELECT
          j.id,
          j.pickup_address,
          j.pickup_lat,
          j.pickup_lng,
          j.dropoff_address,
          j.dropoff_lat,
          j.dropoff_lng,
          j.parcel_size,
          j.parcel_type,
          j.delivery_type,
          j.distance_km,
          j.estimated_minutes,
          j.driver_earnings,
          j.created_at,
          j.expires_at,
          (
            6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
              cos(radians($1::double precision))
              * cos(radians(j.pickup_lat::double precision))
              * cos(radians(j.pickup_lng::double precision) - radians($2::double precision))
              + sin(radians($1::double precision))
              * sin(radians(j.pickup_lat::double precision))
            )))
          ) AS distance_from_driver_km
        FROM delivery_jobs j
        WHERE j.status = 'open'
          AND j.expires_at > NOW()
          AND j.payment_status = 'paid'
          AND j.delivery_type = 'local'
          AND j.pickup_lat IS NOT NULL
          AND j.pickup_lng IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM job_applications a
            WHERE a.job_id = j.id AND a.driver_id = $3
          )
          AND (
            6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
              cos(radians($1::double precision))
              * cos(radians(j.pickup_lat::double precision))
              * cos(radians(j.pickup_lng::double precision) - radians($2::double precision))
              + sin(radians($1::double precision))
              * sin(radians(j.pickup_lat::double precision))
            )))
          ) <= $4
        ORDER BY distance_from_driver_km ASC
        LIMIT $5 OFFSET $6
      `,
      [dLat, dLng, driverId, radiusKm, limit, offset]
    );

    res.json({
      jobs: rows,
      pagination: {
        page,
        limit,
        total,
        has_more: rows.length === limit,
      },
    });
  } catch (err) {
    console.error('getAvailableJobs:', err);
    res.status(500).json({ error: 'Could not load jobs' });
  }
}

async function getMatchingIntercityJobs(req, res) {
  try {
    const driverId = req.user.id;

    const { rows: routes } = await db.query(
      `
        SELECT id, from_lat, from_lng, to_lat, to_lng, from_city, to_city
        FROM driver_routes
        WHERE driver_id = $1
          AND status = 'active'
          AND trip_type = 'intercity'
          AND departure_time > NOW()
          AND from_lat IS NOT NULL AND from_lng IS NOT NULL
          AND to_lat IS NOT NULL AND to_lng IS NOT NULL
      `,
      [driverId]
    );

    if (routes.length === 0) {
      return res.json({ jobs: [] });
    }

    const allJobs = [];

    for (const route of routes) {
      const { rows: jobs } = await db.query(
        `
            SELECT
              j.id,
              j.pickup_address,
              j.pickup_lat,
              j.pickup_lng,
              j.dropoff_address,
              j.dropoff_lat,
              j.dropoff_lng,
              j.parcel_size,
              j.parcel_type,
              j.delivery_type,
              j.distance_km,
              j.estimated_minutes,
              j.driver_earnings,
              j.created_at,
              j.expires_at,
              $2::integer AS matched_route_id,
              $3 AS route_from_city,
              $4 AS route_to_city
            FROM delivery_jobs j
            WHERE j.status = 'open'
              AND j.expires_at > NOW()
              AND j.payment_status = 'paid'
              AND j.delivery_type = 'intercity'
              AND j.pickup_lat IS NOT NULL AND j.pickup_lng IS NOT NULL
              AND j.dropoff_lat IS NOT NULL AND j.dropoff_lng IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM job_applications a
                WHERE a.job_id = j.id AND a.driver_id = $1
              )
              AND (
                6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
                  cos(radians($5::double precision))
                  * cos(radians(j.pickup_lat::double precision))
                  * cos(radians(j.pickup_lng::double precision) - radians($6::double precision))
                  + sin(radians($5::double precision))
                  * sin(radians(j.pickup_lat::double precision))
                )))
              ) <= 50
              AND (
                6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
                  cos(radians($7::double precision))
                  * cos(radians(j.dropoff_lat::double precision))
                  * cos(radians(j.dropoff_lng::double precision) - radians($8::double precision))
                  + sin(radians($7::double precision))
                  * sin(radians(j.dropoff_lat::double precision))
                )))
              ) <= 50
        `,
        [
          driverId,
          route.id,
          route.from_city,
          route.to_city,
          Number(route.from_lat),
          Number(route.from_lng),
          Number(route.to_lat),
          Number(route.to_lng),
        ]
      );

      allJobs.push(...jobs);
    }

    const unique = allJobs.filter(
      (job, index, self) => index === self.findIndex((j) => j.id === job.id)
    );

    res.json({ jobs: unique });
  } catch (err) {
    console.error('getMatchingIntercityJobs:', err);
    res.status(500).json({ error: 'Could not load jobs' });
  }
}

async function applyForJob(req, res) {
  try {
    const driverId = req.user.id;
    const jobId = Number(req.params.id);
    const { driver_route_id } = req.body;

    const { rows: profileRows } = await db.query(
      `
        SELECT
          dp.verification_status,
          dp.licence_expiry,
          u.is_active
        FROM driver_profiles dp
        JOIN users u ON u.id = dp.user_id
        WHERE dp.user_id = $1
      `,
      [driverId]
    );

    if (!profileRows[0]) {
      return res.status(403).json({
        error: 'Driver profile not found. Please complete your profile.',
      });
    }

    const prof = profileRows[0];

    if (!prof.is_active) {
      return res.status(403).json({
        error: 'Your account has been deactivated.',
      });
    }

    if (prof.verification_status !== 'approved') {
      return res.status(403).json({
        error:
          'Your account is pending verification. An admin will review your documents shortly.',
      });
    }

    if (prof.licence_expiry) {
      const expDate = new Date(prof.licence_expiry);
      const today = new Date();
      expDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        return res.status(403).json({
          error: 'Your driver licence on file has expired. Please update your documents.',
        });
      }
    }

    const { rows: jobRows } = await db.query(
      `
        SELECT j.*, u.phone AS customer_phone
        FROM delivery_jobs j
        JOIN users u ON u.id = j.customer_id
        WHERE j.id = $1
          AND j.status = 'open'
          AND j.expires_at > NOW()
      `,
      [jobId]
    );

    if (!jobRows[0]) {
      return res.status(404).json({ error: 'Job not available' });
    }

    await db.query(
      `
        INSERT INTO job_applications (job_id, driver_id, driver_route_id, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (job_id, driver_id) DO NOTHING
      `,
      [jobId, driverId, driver_route_id || null]
    );

    const job = jobRows[0];
    if (job.customer_phone) {
      queueSMS(
        job.customer_phone,
        'SwiftDrop: A driver applied for your delivery!\nOpen the app to view their profile and confirm your driver.',
        `JOB-APPLY-${jobId}-${driverId}-${Date.now()}`
      ).catch((err) => console.error('SMS queue error:', err));
    }

    res.json({
      success: true,
      message: 'Application submitted successfully',
    });
  } catch (err) {
    console.error('applyForJob:', err);
    res.status(500).json({ error: 'Could not apply' });
  }
}

async function getJobApplications(req, res) {
  try {
    const customerId = req.user.id;
    const jobId = Number(req.params.id);

    const { rows: jobRows } = await db.query(
      `SELECT id FROM delivery_jobs WHERE id = $1 AND customer_id = $2`,
      [jobId, customerId]
    );

    if (!jobRows[0]) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const { rows } = await db.query(
      `
        SELECT
          a.id AS application_id,
          a.driver_id,
          a.driver_route_id,
          a.applied_at,
          a.status,
          u.full_name AS driver_name,
          COALESCE(u.profile_photo_url, dp.selfie_url) AS driver_photo,
          dp.vehicle_make,
          dp.vehicle_model,
          dp.vehicle_color,
          dp.vehicle_year,
          dp.vehicle_plate,
          dp.vehicle_photo_url,
          dp.verification_status,
          COALESCE(dt.current_rating, 0) AS driver_rating,
          COALESCE(dt.deliveries_completed, 0) AS driver_deliveries,
          dr.from_city AS route_from,
          dr.to_city AS route_to,
          dr.departure_time
        FROM job_applications a
        JOIN users u ON u.id = a.driver_id
        LEFT JOIN driver_profiles dp ON dp.user_id = a.driver_id
        LEFT JOIN driver_tiers dt ON dt.driver_id = a.driver_id
        LEFT JOIN driver_routes dr ON dr.id = a.driver_route_id
        WHERE a.job_id = $1 AND a.status = 'pending'
        ORDER BY a.applied_at ASC
      `,
      [jobId]
    );

    res.json({ applications: rows });
  } catch (err) {
    console.error('getJobApplications:', err);
    res.status(500).json({ error: 'Could not load applications' });
  }
}

async function selectDriver(req, res) {
  try {
    const customerId = req.user.id;
    const jobId = Number(req.params.id);
    const { driver_id } = req.body;
    const driverIdSel = Number(driver_id);

    if (!Number.isFinite(driverIdSel)) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const { rows: driverRows } = await db.query(
      `
        SELECT u.id, u.full_name, u.phone,
          dp.vehicle_make, dp.vehicle_model, dp.vehicle_color, dp.vehicle_plate
        FROM users u
        JOIN driver_profiles dp ON dp.user_id = u.id
        WHERE u.id = $1
      `,
      [driverIdSel]
    );

    if (!driverRows[0]) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverRows[0];

    const client = await db.getClient();
    let order;
    let job;
    try {
      await client.query('BEGIN');

      const { rows: jobRows } = await client.query(
        `
          SELECT j.*,
            uc.phone AS customer_phone
          FROM delivery_jobs j
          JOIN users uc
            ON uc.id = j.customer_id
          WHERE j.id = $1
            AND j.customer_id = $2
            AND j.status = 'open'
          FOR UPDATE
        `,
        [jobId, customerId]
      );

      if (!jobRows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error:
            'This job has already been confirmed or is no longer available',
        });
      }

      job = jobRows[0];

      await client.query(
        `
          UPDATE delivery_jobs
          SET status = 'driver_selected', selected_driver_id = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [driverIdSel, jobId]
      );

      await client.query(
        `
          UPDATE job_applications SET status = 'rejected'
          WHERE job_id = $1 AND driver_id <> $2
        `,
        [jobId, driverIdSel]
      );

      await client.query(
        `
          UPDATE job_applications SET status = 'selected'
          WHERE job_id = $1 AND driver_id = $2
        `,
        [jobId, driverIdSel]
      );

      const orderNumber = generateJobBoardOrderNumber();
      const tripType = String(job.delivery_type || 'local') === 'intercity' ? 'intercity' : 'local';

      const orderRes = await client.query(
        `
          INSERT INTO orders (
            order_number,
            customer_id,
            driver_id,
            pickup_address,
            pickup_lat,
            pickup_lng,
            dropoff_address,
            dropoff_lat,
            dropoff_lng,
            province,
            parcel_type,
            parcel_size,
            parcel_value,
            special_handling,
            delivery_tier,
            status,
            base_price,
            insurance_fee,
            total_price,
            commission_amount,
            driver_earnings,
            pickup_otp,
            delivery_otp,
            assigned_driver_route_id,
            matched_at,
            delivery_job_id,
            trip_type,
            distance_km,
            updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,NULL,NOW(),$24,$25,$26,NOW()
          )
          RETURNING *
        `,
        [
          orderNumber,
          job.customer_id,
          driverIdSel,
          job.pickup_address,
          Number(job.pickup_lat),
          Number(job.pickup_lng),
          job.dropoff_address,
          Number(job.dropoff_lat),
          Number(job.dropoff_lng),
          null,
          job.parcel_type || 'General',
          job.parcel_size || 'small',
          job.parcel_value != null ? Number(job.parcel_value) : 0,
          null,
          'standard',
          'accepted',
          Number(job.base_price),
          Number(job.insurance_fee ?? 0),
          Number(job.total_price),
          Number(job.commission ?? 0),
          Number(job.driver_earnings),
          job.pickup_otp,
          job.delivery_otp,
          job.id,
          tripType,
          job.distance_km != null ? Number(job.distance_km) : null,
        ]
      );

      order = orderRes.rows[0];

      await client.query(
        `
          INSERT INTO payments (order_id, amount, payment_method, escrow_status)
          VALUES ($1, $2, $3, 'held')
        `,
        [order.id, Number(job.total_price), job.payment_method || 'wallet']
      );

      await client.query(
        `
          UPDATE delivery_jobs
          SET order_id = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [order.id, jobId]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw txErr;
    } finally {
      client.release();
    }

    const { rows: rejectedPhones } = await db.query(
      `
        SELECT u.phone
        FROM job_applications a
        JOIN users u ON u.id = a.driver_id
        WHERE a.job_id = $1 AND a.status = 'rejected'
      `,
      [jobId]
    );

    if (driver.phone) {
      queueSMS(
        driver.phone,
        `SwiftDrop: You got the job!\n\nCollect from:\n${job.pickup_address}\n\nDeliver to:\n${job.dropoff_address}\n\nYour earnings: R${job.driver_earnings}\n\nCustomer: ${job.customer_phone}`,
        `JOB-SELECT-${jobId}-WIN-${driverIdSel}-${Date.now()}`
      ).catch((err) => console.error('SMS queue error:', err));
    }

    rejectedPhones.forEach((row, idx) => {
      if (row.phone) {
        queueSMS(
          row.phone,
          'SwiftDrop: Thank you for applying. Another driver was selected for this job.',
          `JOB-SELECT-${jobId}-REJ-${idx}-${Date.now()}`
        ).catch((err) => console.error('SMS queue error:', err));
      }
    });

    if (job.customer_phone) {
      queueSMS(
        job.customer_phone,
        `SwiftDrop: Driver confirmed!\n\n${driver.full_name}\n${driver.vehicle_color} ${driver.vehicle_make} ${driver.vehicle_model}\nPlate: ${driver.vehicle_plate}\nPhone: ${driver.phone}`,
        `JOB-SELECT-${jobId}-CUSTOMER-${Date.now()}`
      ).catch((err) => console.error('SMS queue error:', err));
    }

    res.json({
      success: true,
      order_id: order.id,
      driver: {
        id: driver.id,
        name: driver.full_name,
        phone: driver.phone,
        vehicle: `${driver.vehicle_color} ${driver.vehicle_make} ${driver.vehicle_model}`,
        plate: driver.vehicle_plate,
      },
    });
  } catch (err) {
    console.error('selectDriver:', err);
    res.status(500).json({
      error:
        'Could not confirm driver. Please try again.',
    });
  }
}

async function cancelJob(req, res) {
  try {
    const customerId = req.user.id;
    const jobId = Number(req.params.id);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { rows: jobRows } = await client.query(
        `
        SELECT * FROM delivery_jobs
        WHERE id = $1
          AND customer_id = $2
          AND status IN ('open', 'driver_selected')
        FOR UPDATE
      `,
        [jobId, customerId]
      );

      if (!jobRows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Job cannot be cancelled' });
      }

      const job = jobRows[0];

      let walletRefundAmt = null;
      if (job.payment_status === 'paid' && job.payment_method === 'wallet') {
        const total = Number(job.total_price);
        if (Number.isFinite(total) && total > 0) {
          await refundWallet(client, customerId, total, `JOB-CANCEL-${jobId}`);
          walletRefundAmt = total;
        }
      }

      await client.query(
        `
        UPDATE delivery_jobs SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `,
        [jobId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        refunded: walletRefundAmt != null ? walletRefundAmt : 0,
      });
    } catch (inner) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw inner;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cancelJob:', err);
    res.status(500).json({
      error: 'Something went wrong. Please try again.',
    });
  }
}

module.exports = {
  estimateJob,
  createJob,
  getMyJobs,
  getAvailableJobs,
  getMatchingIntercityJobs,
  applyForJob,
  getJobApplications,
  selectDriver,
  cancelJob,
};

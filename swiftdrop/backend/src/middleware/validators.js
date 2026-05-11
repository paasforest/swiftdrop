const { body } = require('express-validator');
const { haversineKm } = require('../utils/distanceHelper');

function normalizeSAPhone(phone) {
  if (phone == null || phone === '') return phone;
  let cleaned = String(phone).replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = `+27${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('27') && !cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

function isValidSAPhone(phone) {
  const normalized = normalizeSAPhone(phone);
  return /^\+27[678]\d{8}$/.test(normalized);
}

const SA_LAT_MIN = -35;
const SA_LAT_MAX = -22;
const SA_LNG_MIN = 16;
const SA_LNG_MAX = 33;

function isValidSACoordinate(lat, lng) {
  return (
    lat >= SA_LAT_MIN
    && lat <= SA_LAT_MAX
    && lng >= SA_LNG_MIN
    && lng <= SA_LNG_MAX
  );
}

const createOrderValidators = [
  body('pickup_lat')
    .isFloat()
    .custom((val, { req }) => {
      const lat = Number(val);
      const lng = Number(req.body.pickup_lng);
      if (!Number.isFinite(lng)) {
        throw new Error('pickup_lng must be provided with pickup_lat');
      }
      if (!isValidSACoordinate(lat, lng)) {
        throw new Error(
          'Pickup must be within South Africa'
        );
      }
      return true;
    }),
  body('pickup_lng').isFloat().withMessage('pickup_lng must be a number'),
  body('dropoff_lat')
    .isFloat()
    .custom((val, { req }) => {
      const lat = Number(val);
      const lng = Number(req.body.dropoff_lng);
      if (!Number.isFinite(lng)) {
        throw new Error('dropoff_lng must be provided with dropoff_lat');
      }
      if (!isValidSACoordinate(lat, lng)) {
        throw new Error(
          'Dropoff must be within South Africa'
        );
      }
      const pickupLat = Number(req.body.pickup_lat);
      const pickupLng = Number(req.body.pickup_lng);
      if (
        Number.isFinite(pickupLat)
        && Number.isFinite(pickupLng)
        && Number.isFinite(lat)
        && Number.isFinite(lng)
      ) {
        const dist = haversineKm(pickupLat, pickupLng, lat, lng);
        if (dist < 0.1) {
          throw new Error(
            'Pickup and dropoff addresses cannot be the same location'
          );
        }
      }
      return true;
    }),
  body('dropoff_lng').isFloat().withMessage('dropoff_lng must be a number'),
  body('parcel_value')
    .optional()
    .isFloat({ min: 0, max: 2000 })
    .withMessage(
      'Parcel value must be between R0 and R2,000'
    ),
  body('parcel_size')
    .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
    .isIn(['small', 'medium', 'large'])
    .withMessage(
      'Parcel size must be small, medium or large'
    ),
  body('pickup_address')
    .isLength({ min: 5, max: 500 })
    .withMessage(
      'Pickup address is required'
    )
    .trim(),
  body('dropoff_address')
    .isLength({ min: 5, max: 500 })
    .withMessage(
      'Dropoff address is required'
    )
    .trim(),
];

const createJobValidators = [
  ...createOrderValidators,
  body('delivery_type')
    .isIn(['local', 'intercity'])
    .withMessage(
      'Delivery type must be local or intercity'
    ),
];

/** Login accepts email OR phone plus password — align with authController.login */
const loginValidators = [
  body('password')
    .isLength({ min: 6 })
    .withMessage(
      'Password must be at least 6 characters'
    ),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('phone')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
  body()
    .custom((_, { req }) => {
      const emailTrim = req.body.email != null ? String(req.body.email).trim() : '';
      const phoneTrim = req.body.phone != null ? String(req.body.phone).trim() : '';
      if (!emailTrim && !phoneTrim) {
        throw new Error('Email or phone is required');
      }
      return true;
    }),
];

const registerValidators = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('phone')
    .notEmpty()
    .withMessage('Phone is required')
    .custom((val) => {
      if (!val) return true;
      if (!isValidSAPhone(val)) {
        throw new Error(
          'Please enter a valid SA mobile number e.g. 0821234567'
        );
      }
      return true;
    })
    .customSanitizer((val) => normalizeSAPhone(val)),
  body('password')
    .isLength({ min: 8 })
    .withMessage(
      'Password must be at least 8 characters'
    )
    .matches(/\d/)
    .withMessage(
      'Password must contain at least one number'
    ),
  body('full_name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name is required')
    .trim()
    .escape(),
];

module.exports = {
  createOrderValidators,
  createJobValidators,
  loginValidators,
  registerValidators,
  normalizeSAPhone,
  isValidSAPhone,
};

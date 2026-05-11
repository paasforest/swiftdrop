const { body } = require('express-validator');

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

module.exports = {
  createOrderValidators,
  createJobValidators,
  loginValidators,
};

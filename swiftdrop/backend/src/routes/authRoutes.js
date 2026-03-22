const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const driverApplicationController = require('../controllers/driverApplicationController');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/me', auth, authController.getMe);
router.post('/register-customer', authController.registerCustomer);
router.post('/register-driver', authController.registerDriver);
router.post('/verify-phone', authController.verifyPhone);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);
router.post(
  '/driver/submit-application',
  auth,
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'uber_profile_screenshot', maxCount: 1 },
    { name: 'vehicle_photo', maxCount: 1 },
    { name: 'national_id', maxCount: 1 },
    { name: 'drivers_license', maxCount: 1 },
    { name: 'vehicle_registration', maxCount: 1 },
    { name: 'license_disc', maxCount: 1 },
    { name: 'saps_clearance', maxCount: 1 },
    { name: 'vehicle_photo_front', maxCount: 1 },
    { name: 'vehicle_photo_back', maxCount: 1 },
    { name: 'vehicle_photo_side', maxCount: 1 },
  ]),
  driverApplicationController.submitDriverApplication
);

module.exports = router;

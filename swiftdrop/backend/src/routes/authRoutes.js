const express = require('express');
const multer = require('multer');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, verifyFirebaseToken } = require('../middleware/auth');

const driverApplicationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/login', authController.login);
router.post('/register-customer', authController.registerCustomer);
router.post('/register-driver', authController.registerDriver);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', auth, authController.getMe);
router.post('/register', verifyFirebaseToken, authController.register);
router.post('/bootstrap-profile', verifyFirebaseToken, authController.bootstrapProfile);
router.post('/set-role', auth, authController.setRole);
router.post('/complete-profile', auth, authController.completeProfile);
router.post('/request-phone-verification', auth, authController.requestPhoneVerification);
router.post('/verify-phone', auth, authController.verifyPhone);
router.post(
  '/driver/submit-application',
  auth,
  driverApplicationUpload.any(),
  authController.submitDriverApplication
);

module.exports = router;

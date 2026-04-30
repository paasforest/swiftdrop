const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, verifyFirebaseToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register-customer', authController.registerCustomer);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', auth, authController.getMe);
router.post('/register', verifyFirebaseToken, authController.register);
router.post('/bootstrap-profile', verifyFirebaseToken, authController.bootstrapProfile);
router.post('/set-role', auth, authController.setRole);
router.post('/complete-profile', auth, authController.completeProfile);
router.post('/request-phone-verification', auth, authController.requestPhoneVerification);
router.post('/verify-phone', auth, authController.verifyPhone);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register-customer', authController.registerCustomer);
router.post('/register-driver', authController.registerDriver);
router.post('/verify-phone', authController.verifyPhone);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;

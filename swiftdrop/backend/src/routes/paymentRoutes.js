const express = require('express');
const { auth } = require('../middleware/auth');
const payment = require('../controllers/paymentController');

const router = express.Router();

router.post('/payfast/initiate', auth, payment.initiatePayFast);

module.exports = router;


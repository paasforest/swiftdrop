const express = require('express');
const { auth } = require('../middleware/auth');
const { getWalletBalance } = require('../controllers/walletController');

const router = express.Router();

router.get('/balance', auth, getWalletBalance);

module.exports = router;

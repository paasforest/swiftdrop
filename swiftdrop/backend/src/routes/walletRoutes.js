const express = require('express');
const { auth } = require('../middleware/auth');
const { getWalletBalance, getTransactions } = require('../controllers/walletController');

const router = express.Router();

router.get('/balance', auth, getWalletBalance);
router.get('/transactions', auth, getTransactions);

module.exports = router;

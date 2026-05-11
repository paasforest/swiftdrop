const express = require('express');
const { auth } = require('../middleware/auth');
const ratings = require('../controllers/ratingsController');

const router = express.Router();

router.post('/', auth, ratings.submitRating);
router.get('/customer/:orderId', auth, ratings.getCustomerRating);
router.get('/driver/:driverId', ratings.getDriverRating);

module.exports = router;

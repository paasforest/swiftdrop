const express = require('express');
const { auth } = require('../middleware/auth');
const ratingsController = require('../controllers/ratingsController');

const router = express.Router();

router.post('/ratings', auth, ratingsController.submitRating);
router.get('/ratings/customer/:orderId', auth, ratingsController.getCustomerRating);

module.exports = router;


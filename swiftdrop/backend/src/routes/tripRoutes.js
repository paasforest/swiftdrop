const express = require('express');
const { auth } = require('../middleware/auth');
const tripController = require('../controllers/tripController');

const router = express.Router();

router.get('/search', auth, tripController.searchTrips);

module.exports = router;

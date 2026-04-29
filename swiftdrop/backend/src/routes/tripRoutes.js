const express = require('express');
const router = express.Router();
const { searchTrips } = require('../controllers/tripController');
const { auth } = require('../middleware/auth');

router.get('/search', auth, searchTrips);

module.exports = router;

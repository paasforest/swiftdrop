const express = require('express');
const { auth } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

/** POST /api/driver-routes — create a driver route (driver only, auth required) */
router.post('/', auth, driverController.createDriverRoute);

module.exports = router;

const express = require('express');
const { auth } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

/** POST /api/driver-routes — create a driver route (driver only, auth required) */
router.post('/', auth, driverController.createDriverRoute);

/** PATCH /api/driver-routes/:id/cancel — driver cancels a posted trip */
router.patch('/:id/cancel', auth, driverController.cancelDriverRoute);

module.exports = router;

const express = require('express');
const { auth } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

/** POST /api/driver-routes — create a driver route (driver only, auth required) */
router.post('/', auth, driverController.createDriverRoute);

/** GET /api/driver-routes/my — list the driver's own active routes */
router.get('/my', auth, driverController.getMyRoutes);

/** GET /api/driver-routes/:id/parcels — all parcels on a trip */
router.get('/:id/parcels', auth, driverController.getTripParcels);

/** PATCH /api/driver-routes/:id/cancel — driver cancels a posted trip */
router.patch('/:id/cancel', auth, driverController.cancelDriverRoute);

module.exports = router;

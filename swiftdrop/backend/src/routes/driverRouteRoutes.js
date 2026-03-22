const express = require('express');
const { auth } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

/** GET /api/driver-routes/my — list active routes for logged-in driver */
router.get('/my', auth, driverController.listMyDriverRoutes);

/** POST /api/driver-routes — create a driver route (driver only, auth required) */
router.post('/', auth, driverController.createDriverRoute);

/** DELETE /api/driver-routes/:id — cancel a posted route (driver only) */
router.delete('/:id', auth, driverController.cancelDriverRoute);

module.exports = router;

const express = require('express');
const { auth } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

router.get('/status', auth, driverController.getStatus);
router.patch('/status', auth, driverController.patchStatus);
router.patch('/location', auth, driverController.patchLocation);
router.get('/earnings/today', auth, driverController.getTodayEarnings);
router.get('/earnings/summary', auth, driverController.getEarningsSummary);

module.exports = router;

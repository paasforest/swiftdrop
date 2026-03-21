const express = require('express');
const { auth } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

router.get('/status', auth, driverController.getStatus);
router.patch('/status', auth, driverController.patchStatus);
router.patch('/location', auth, driverController.patchLocation);

module.exports = router;

const express = require('express');
const { auth } = require('../middleware/auth');
const adminDriverController = require('../controllers/adminDriverController');

const router = express.Router();

router.get('/drivers', auth, adminDriverController.listDriverApplications);
router.post('/drivers/:id/approve', auth, adminDriverController.approveDriver);

module.exports = router;


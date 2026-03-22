const express = require('express');
const { auth } = require('../middleware/auth');
const adminDriverController = require('../controllers/adminDriverController');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard-stats', auth, adminController.dashboardStats);
router.get('/finance/summary', auth, adminController.financeSummary);
router.get('/finance/revenue', auth, adminController.financeRevenueDaily);
router.get('/finance/insurance', auth, adminController.financeInsurancePool);
router.get('/deliveries', auth, adminController.listAdminDeliveries);
router.post('/wallet/set', auth, adminController.setUserWallet);
router.post('/user/verify', auth, adminController.verifyUserByEmail);

router.get('/drivers', auth, adminDriverController.listDriverApplications);
router.get('/drivers/:id', auth, adminDriverController.getDriverApplicationDetail);
router.post('/drivers/:id/approve', auth, adminDriverController.approveDriver);
router.post('/drivers/:id/reject', auth, adminDriverController.rejectDriver);

module.exports = router;

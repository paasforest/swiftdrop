const express = require('express');
const { auth } = require('../middleware/auth');
const dispute = require('../controllers/disputeController');

const router = express.Router();

router.post('/', auth, dispute.createDispute);
router.get('/my', auth, dispute.getMyDisputes);
router.get('/admin', auth, dispute.getAdminDisputes);
router.get('/', auth, dispute.getAllDisputes);
router.post('/:id/resolve', auth, dispute.resolveDispute);
router.patch('/:id/resolve', auth, dispute.resolveDispute);
router.get('/:id', auth, dispute.getDisputeDetail);

module.exports = router;

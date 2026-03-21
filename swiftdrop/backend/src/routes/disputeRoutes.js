const express = require('express');
const { auth } = require('../middleware/auth');
const disputeController = require('../controllers/disputeController');

const router = express.Router();

router.post('/', auth, disputeController.raiseDispute);
router.get('/my', auth, disputeController.getMyDisputes);
router.get('/', auth, disputeController.getAllDisputes);
router.get('/:id', auth, disputeController.getDisputeDetail);
router.patch('/:id/resolve', auth, disputeController.resolveDispute);

module.exports = router;

const express = require('express');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const order = require('../controllers/orderController');

const router = express.Router();

// Public estimate (no auth)
router.post('/price-estimate', order.calculatePrice);

// Lists / dashboard (before /:id)
router.get('/customer', auth, order.getCustomerOrders);
router.get('/driver/dashboard', auth, order.getDriverDashboard);
router.get('/driver', auth, order.getDriverOrders);

router.get('/pending-offer', auth, order.getPendingOffer);

router.post('/validate-promo', auth, order.validatePromo);

router.post('/', auth, order.createOrder);

router.get('/:id/tracking', auth, order.getOrderTracking);
router.post('/:id/cancel', auth, order.cancelOrder);
router.delete('/:id', auth, order.cancelOrder);
router.post('/:id/retry-matching', auth, order.retryMatching);
router.post('/:id/accept', auth, order.acceptOrder);
router.post('/:id/decline', auth, order.declineOrder);
router.patch('/:id/status', auth, order.updateOrderStatus);
router.post('/:id/pickup-otp', auth, order.confirmPickupOTP);
router.post('/:id/delivery-otp', auth, order.confirmDeliveryOTP);
router.post('/:id/pickup-photo', auth, upload.single('photo'), order.uploadPickupPhoto);
router.post('/:id/delivery-photo', auth, upload.single('photo'), order.uploadDeliveryPhoto);
router.get('/:id', auth, order.getOrderById);

module.exports = router;

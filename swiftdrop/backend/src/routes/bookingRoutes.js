const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, verifyFirebaseToken } = require('../middleware/auth');
const c = require('../controllers/bookingController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Sender routes
router.get('/my-bookings', auth, c.myBookings);
router.post('/request', auth, c.requestBooking);
router.delete('/:bookingId', auth, c.cancelBooking);
router.get('/:bookingId/pickup-otp', auth, c.getPickupOtp);

// Sender additional routes
router.get('/:bookingId/dropoff-otp', auth, c.getDropoffOtp);
router.post('/:bookingId/rate', auth, c.rateBooking);

// Driver routes (Firebase token only)
router.post('/:bookingId/accept', verifyFirebaseToken, c.acceptBooking);
router.post('/:bookingId/decline', verifyFirebaseToken, c.declineBooking);
router.post('/:bookingId/arrived-pickup', verifyFirebaseToken, c.arrivedPickup);
router.post('/:bookingId/arrived-dropoff', verifyFirebaseToken, c.arrivedDropoff);
router.post('/:bookingId/verify-pickup-otp', verifyFirebaseToken, c.verifyPickupOtp);
router.post('/:bookingId/verify-dropoff-otp', verifyFirebaseToken, c.verifyDropoffOtp);
router.post('/:bookingId/upload-photo', verifyFirebaseToken, upload.single('photo'), c.uploadPhoto);
router.post('/:bookingId/complete', verifyFirebaseToken, c.completeBooking);

module.exports = router;

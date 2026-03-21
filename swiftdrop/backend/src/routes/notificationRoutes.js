const express = require('express');
const { auth } = require('../middleware/auth');
const { registerFcmToken } = require('../controllers/notificationsController');

const router = express.Router();

router.post('/fcm-token', auth, registerFcmToken);

module.exports = router;

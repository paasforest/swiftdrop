require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const adminDriverRoutes = require('./src/routes/adminDriverRoutes');
const ratingsRoutes = require('./src/routes/ratingsRoutes');
const driverRoutes = require('./src/routes/driverRoutes');
const driverRouteRoutes = require('./src/routes/driverRouteRoutes');
const disputeRoutes = require('./src/routes/disputeRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const tripRoutes = require('./src/routes/tripRoutes');
const jobRoutes = require('./src/routes/jobRoutes');

try {
  require('./src/utils/jwtSecret').requireJwtSecret();
} catch (e) {
  console.error('[SwiftDrop]', e.message);
  process.exit(1);
}

const cron = require('node-cron');
const { retryFailedSMS } = require('./src/services/smsQueue');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/register-customer', authLimiter);
app.use('/api/auth/register-driver', authLimiter);

app.use('/api/', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminDriverRoutes);
app.use('/api', ratingsRoutes);
app.use('/api/drivers', driverRoutes);
/** Alias: mobile app calls /api/driver/earnings/* */
app.use('/api/driver', driverRoutes);
app.use('/api/driver-routes', driverRouteRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/jobs', jobRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SwiftDrop API', version: '1.2.0' });
});

// Global error handler (must remain last; 4 parameters)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack,
    userId: req.user?.id,
  });

  const statusCode = err.statusCode || err.status || 500;

  const message =
    statusCode === 500
      ? 'Something went wrong. Please try again.'
      : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

const HOST = process.env.HOST || '0.0.0.0';

cron.schedule('*/5 * * * *', () => {
  retryFailedSMS().catch((e) =>
    console.error('[smsQueue] retry:', e?.message || e)
  );
});

app.listen(PORT, HOST, () => {
  console.log(`SwiftDrop API running on http://${HOST}:${PORT}`);
});

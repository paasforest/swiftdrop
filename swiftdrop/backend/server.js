require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const db = require('./src/database/connection');
const { refundWallet } = require('./src/utils/wallet');
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

app.use((req, res, next) => {
  res.setHeader('X-API-Version', '1.0');
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000 || res.statusCode >= 400) {
      console.log({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id,
      });
    }
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      environment: process.env.NODE_ENV || 'production',
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed',
    });
  }
});

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

cron.schedule('0 * * * *', async () => {
  try {
    const { rows } = await db.query(`
      UPDATE delivery_jobs
      SET status = 'expired',
          updated_at = NOW()
      WHERE status = 'open'
        AND expires_at < NOW()
      RETURNING id
    `);
    if (rows.length > 0) {
      console.log(`Expired ${rows.length} jobs`);

      for (const job of rows) {
        try {
          const { rows: jobRows } = await db.query(
            `SELECT * FROM delivery_jobs WHERE id = $1`,
            [job.id]
          );

          const fullJob = jobRows[0];
          if (
            fullJob?.payment_status === 'paid'
            && fullJob.payment_method === 'wallet'
          ) {
            const total = Number(fullJob.total_price);
            if (!Number.isFinite(total) || total <= 0) {
              continue;
            }
            const client = await db.getClient();
            try {
              await client.query('BEGIN');
              await refundWallet(
                client,
                fullJob.customer_id,
                total,
                `EXPIRED-${job.id}`
              );
              await client.query(
                `
                  UPDATE delivery_jobs
                  SET payment_status = 'refunded'
                  WHERE id = $1
                `,
                [job.id]
              );
              await client.query('COMMIT');
            } catch (err) {
              try {
                await client.query('ROLLBACK');
              } catch {
                /* ignore */
              }
              console.error('Refund failed for job', job.id, err);
            } finally {
              client.release();
            }
          }
        } catch (err) {
          console.error('Error processing expired job', job.id, err);
        }
      }
    }
  } catch (err) {
    console.error('Job expiry cron error:', err);
  }
});

app.listen(PORT, HOST, () => {
  console.log(`SwiftDrop API running on http://${HOST}:${PORT}`);
});

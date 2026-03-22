require('dotenv').config();
const express = require('express');
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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminDriverRoutes);
app.use('/api', ratingsRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/driver-routes', driverRouteRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet', walletRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SwiftDrop API', version: '1.0.0' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`SwiftDrop API running on http://${HOST}:${PORT}`);
});

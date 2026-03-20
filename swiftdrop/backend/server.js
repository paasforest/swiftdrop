require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const adminDriverRoutes = require('./src/routes/adminDriverRoutes');
const ratingsRoutes = require('./src/routes/ratingsRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminDriverRoutes);
app.use('/api', ratingsRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SwiftDrop API', version: '1.0.0' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`SwiftDrop API running on http://${HOST}:${PORT}`);
});

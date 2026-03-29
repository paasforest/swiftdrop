require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes          = require('./src/routes/authRoutes');
const bookingRoutes       = require('./src/routes/bookingRoutes');
const driverRoutes        = require('./src/routes/driverRoutes');
const notificationRoutes  = require('./src/routes/notificationRoutes');
const seedRoutes          = require('./src/routes/seedRoutes');
const trackPublic         = require('./src/controllers/trackPublicController');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.get('/track/:token', trackPublic.serveTrackPage);
app.get('/api/public/track/:token', trackPublic.getPublicTrackJson);

app.use('/api/auth',          authRoutes);
app.use('/api/bookings',      bookingRoutes);
app.use('/api/drivers',       driverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/seed', seedRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SwiftDrop API', version: '2.0.7-declaration-track', status: 'auth-foundation' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'SwiftDrop' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`SwiftDrop API running on http://${HOST}:${PORT}`);
});

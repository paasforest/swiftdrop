require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes    = require('./src/routes/authRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const seedRoutes    = require('./src/routes/seedRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth',     authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/seed',     seedRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SwiftDrop API', version: '2.0.2-seed', status: 'auth-foundation' });
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

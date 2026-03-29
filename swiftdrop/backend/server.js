require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes          = require('./src/routes/authRoutes');
const bookingRoutes       = require('./src/routes/bookingRoutes');
const driverRoutes        = require('./src/routes/driverRoutes');
const notificationRoutes  = require('./src/routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth',          authRoutes);
app.use('/api/bookings',      bookingRoutes);
app.use('/api/drivers',       driverRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SwiftDrop API', version: '2.0.4-earnings', status: 'auth-foundation' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'SwiftDrop' });
});

// Debug — shows live RTDB drivers node (remove after testing)
app.get('/debug/rtdb-drivers', async (req, res) => {
  const { getRealtimeDb } = require('./src/services/firebaseAdmin');
  const rtdb = getRealtimeDb();
  if (!rtdb) return res.json({ rtdb: 'NOT_INITIALIZED', drivers: null });
  try {
    const snap = await rtdb.ref('drivers').once('value');
    return res.json({ rtdb: 'OK', drivers: snap.val() });
  } catch (e) {
    return res.json({ rtdb: 'ERROR', error: e.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`SwiftDrop API running on http://${HOST}:${PORT}`);
});

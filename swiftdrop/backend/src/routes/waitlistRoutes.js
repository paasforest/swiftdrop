const express = require('express');
const db = require('../database/connection');

const router = express.Router();

router.post('/waitlist', async (req, res) => {
  const { email, latitude, longitude } = req.body;
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  try {
    await db.query(
      `INSERT INTO waitlist (email, lat, lng, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [String(email).trim().toLowerCase(), latitude ?? null, longitude ?? null]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('waitlist:', err);
    return res.status(500).json({ error: 'Could not save' });
  }
});

module.exports = router;

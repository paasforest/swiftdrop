const cron = require('node-cron');
const db = require('../database/connection');
const { findMatchingDrivers } = require('../services/routeMatchingService');
const { sendJobOfferToDriver } = require('../services/matchingService');

cron.schedule('*/10 * * * *', async () => {
  const { rows } = await db.query(`
    SELECT * FROM orders
    WHERE status='pending'
    AND assigned_driver_route_id IS NULL
    AND province IS NOT NULL
    AND created_at > NOW()-INTERVAL '2 hours'
  `);
  for (const order of rows) {
    try {
      const matches = await findMatchingDrivers(order);
      if (matches.length > 0) {
        await sendJobOfferToDriver(order, matches[0]);
      }
    } catch (err) {
      console.error(`[Rematch] ${order.id}:`, err.message);
    }
  }
});

module.exports = {};

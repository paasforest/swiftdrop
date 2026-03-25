/**
 * Best-effort: pending orders (e.g. after all drivers declined) get matching restarted.
 * Nearest-driver engine only — no corridor / driver_routes.
 */
const cron = require('node-cron');
const db = require('../database/connection');
const { runMatching } = require('../services/matchingService');

cron.schedule('*/10 * * * *', async () => {
  const { rows } = await db.query(`
    SELECT * FROM orders
    WHERE status = 'pending'
      AND province IS NOT NULL
      AND created_at > NOW() - INTERVAL '2 hours'
  `);
  for (const order of rows) {
    try {
      await db.query(
        `UPDATE orders SET status = 'matching', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [order.id]
      );
      runMatching(order.id);
    } catch (err) {
      console.error(`[Rematch] ${order.id}:`, err.message);
    }
  }
});

module.exports = {};

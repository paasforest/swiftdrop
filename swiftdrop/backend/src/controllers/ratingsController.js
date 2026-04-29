const db = require('../database/connection');

async function submitRating(req, res) {
  try {
    if (!req.user || req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const orderId = req.body?.orderId ?? req.body?.order_id;
    const ratingRaw = req.body?.rating;
    const comment = req.body?.comment ?? null;

    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const rating = parseInt(String(ratingRaw), 10);
    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const orderRes = await db.query(
      `SELECT id, status FROM orders WHERE id = $1 AND customer_id = $2`,
      [orderId, req.user.id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not ready for rating yet' });
    }

    await db.query(
      `DELETE FROM ratings WHERE order_id = $1 AND rated_by = 'customer'`,
      [orderId]
    );

    const inserted = await db.query(
      `INSERT INTO ratings (order_id, rated_by, rating, comment)
       VALUES ($1, 'customer', $2, $3)
       RETURNING id, order_id, rated_by, rating, comment, created_at`,
      [orderId, rating, comment]
    );

    return res.status(201).json({ rating: inserted.rows[0] });
  } catch (err) {
    console.error('submitRating:', err);
    return res.status(500).json({ error: err.message || 'Failed to submit rating' });
  }
}

async function getCustomerRating(req, res) {
  try {
    if (!req.user || req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const orderRes = await db.query(
      `SELECT id FROM orders WHERE id = $1 AND customer_id = $2`,
      [orderId, req.user.id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const ratingRes = await db.query(
      `SELECT id, order_id, rated_by, rating, comment, created_at
       FROM ratings
       WHERE order_id = $1 AND rated_by = 'customer'
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    );

    return res.json({ rating: ratingRes.rows[0] || null });
  } catch (err) {
    console.error('getCustomerRating:', err);
    return res.status(500).json({ error: err.message || 'Failed to load rating' });
  }
}

module.exports = { submitRating, getCustomerRating };


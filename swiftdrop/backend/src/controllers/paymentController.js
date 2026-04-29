const db = require('../database/connection');
const { initiatePayFastPayment } = require('../services/payfastService');

async function initiatePayFast(req, res) {
  try {
    if (!process.env.PAYFAST_MERCHANT_ID || !process.env.PAYFAST_MERCHANT_KEY) {
      return res.status(503).json({
        error: 'Card payment is not available yet',
        code: 'PAYMENT_UNAVAILABLE',
      });
    }

    const { order_id } = req.body;
    const amountFromClient = req.body?.amount;
    const item_name = req.body?.item_name || 'SwiftDrop delivery';

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const orderRes = await db.query(
      `SELECT id, order_number, customer_id, total_price
       FROM orders
       WHERE id = $1`,
      [order_id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const amount = amountFromClient ?? order.total_price;
    if (amount == null) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const customerRes = await db.query(
      `SELECT full_name, email, phone
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    const customer = customerRes.rows[0];

    const result = await initiatePayFastPayment({
      order,
      customer,
      amount: Number(amount),
      item_name,
    });

    return res.json(result);
  } catch (e) {
    console.error('initiatePayFast:', e);
    return res.status(500).json({ error: e.message || 'PayFast initiation failed' });
  }
}

module.exports = {
  initiatePayFast,
};


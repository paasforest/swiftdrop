const db = require('../database/connection');

async function releaseEscrow(orderId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query(
      `SELECT base_price, commission_amount, driver_earnings, insurance_fee FROM orders WHERE id = $1`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order) throw new Error('Order not found');

    const commission = parseFloat(order.commission_amount) || 0;
    const driverAmount = parseFloat(order.driver_earnings) || 0;
    const insuranceAmount = parseFloat(order.insurance_fee) || 0;

    await client.query(
      `UPDATE payments SET escrow_status = 'released', commission = $1, driver_amount = $2,
       insurance_amount = $3, payout_status = 'pending', updated_at = NOW()
       WHERE order_id = $4`,
      [commission, driverAmount, insuranceAmount, orderId]
    );
    await client.query('COMMIT');
    return { commission, driverAmount, insuranceAmount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { releaseEscrow };

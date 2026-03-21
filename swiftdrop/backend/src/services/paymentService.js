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

/**
 * Credit customer wallet for a refund (e.g. dispute). Reduces payment.driver_amount proportionally.
 * @param {number} orderId
 * @param {number} refundAmount
 * @param {import('pg').PoolClient} [client] optional transaction client
 */
async function refundCustomer(orderId, refundAmount, client = null) {
  const useClient = client || (await db.pool.connect());
  const ownClient = !client;
  if (ownClient) await useClient.query('BEGIN');
  try {
    const orderRes = await useClient.query(`SELECT id, customer_id, total_price FROM orders WHERE id = $1`, [orderId]);
    const order = orderRes.rows[0];
    if (!order) throw new Error('Order not found');

    const total = parseFloat(order.total_price) || 0;
    const raw = parseFloat(refundAmount);
    if (!Number.isFinite(raw) || raw <= 0) throw new Error('Invalid refund amount');
    const amt = Math.min(raw, total);

    await useClient.query(
      `UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2`,
      [amt, order.customer_id]
    );

    await useClient.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
       VALUES ($1,'credit',$2,$3,$4)`,
      [order.customer_id, amt, `order:${orderId}`, 'Dispute refund']
    );

    const payRes = await useClient.query(`SELECT * FROM payments WHERE order_id = $1`, [orderId]);
    const pay = payRes.rows[0];
    if (pay) {
      const driverAmt = parseFloat(pay.driver_amount) || 0;
      const ratio = total > 0 ? amt / total : 0;
      const deduction = Math.min(driverAmt, driverAmt * ratio);
      await useClient.query(
        `UPDATE payments SET driver_amount = GREATEST(0, driver_amount - $1), updated_at = NOW() WHERE order_id = $2`,
        [deduction, orderId]
      );
    }

    if (ownClient) await useClient.query('COMMIT');
  } catch (e) {
    if (ownClient) await useClient.query('ROLLBACK');
    throw e;
  } finally {
    if (ownClient) useClient.release();
  }
}

/** Clear dispute hold so driver payout can proceed (pending). */
async function releaseHeldDriverPayout(orderId, client = null) {
  const q = client || db;
  await q.query(
    `UPDATE payments SET payout_status = 'pending', updated_at = NOW()
     WHERE order_id = $1 AND payout_status = 'held'`,
    [orderId]
  );
}

/** Hold driver payout while dispute is open (only if still pending). */
async function setPayoutHeld(orderId) {
  await db.query(
    `UPDATE payments SET payout_status = 'held', updated_at = NOW()
     WHERE order_id = $1 AND payout_status = 'pending'`,
    [orderId]
  );
}

module.exports = {
  releaseEscrow,
  refundCustomer,
  releaseHeldDriverPayout,
  setPayoutHeld,
};

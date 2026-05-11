const db = require('../database/connection');

/**
 * Release held escrow for an order inside an existing DB transaction (same client).
 * Idempotent: if payments.escrow_status is not 'held', returns { skipped: true } without crediting again.
 *
 * @param {import('pg').PoolClient} client
 * @param {number|string|null} orderId
 * @param {number|string|null} jobId - optional; used to resolve orders.id via delivery_jobs.order_id
 * @returns {Promise<{
 *   driver_id: number,
 *   earnings_released: number,
 *   new_balance: number|null,
 *   skipped?: boolean,
 *   reason?: string,
 * }>}
 */
async function releaseEscrow(client, orderId, jobId) {
  let resolvedOrderId =
    orderId != null && orderId !== ''
      ? parseInt(String(orderId), 10)
      : null;

  if ((!resolvedOrderId || resolvedOrderId <= 0) && jobId != null && jobId !== '') {
    const jid = parseInt(String(jobId), 10);
    const jr = await client.query(
      `SELECT order_id FROM delivery_jobs WHERE id = $1 FOR UPDATE`,
      [jid]
    );
    const oid = jr.rows[0]?.order_id;
    resolvedOrderId =
      oid != null ? parseInt(String(oid), 10) : null;
  }

  if (!resolvedOrderId || resolvedOrderId <= 0) {
    throw new Error('Could not find order for escrow release');
  }

  const { rows: orderRows } = await client.query(
    `
      SELECT
        id,
        driver_id,
        customer_id,
        driver_earnings,
        total_price,
        base_price,
        commission_amount,
        insurance_fee
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `,
    [resolvedOrderId]
  );
  const record = orderRows[0];

  if (!record || !record.driver_id) {
    throw new Error('Could not find order/job for escrow release');
  }

  const driverEarnings = Math.round(Number(record.driver_earnings || 0) * 100) / 100;
  if (!(driverEarnings > 0)) {
    throw new Error('Invalid driver earnings amount');
  }

  const payRes = await client.query(
    `
      SELECT id, escrow_status
      FROM payments
      WHERE order_id = $1
      FOR UPDATE
    `,
    [resolvedOrderId]
  );
  const pay = payRes.rows[0];

  const commissionAmt = Math.round(Number(record.commission_amount || 0) * 100) / 100;
  const insuranceAmt = Math.round(Number(record.insurance_fee || 0) * 100) / 100;

  if (!pay) {
    return {
      skipped: true,
      reason: 'no_payment_row',
      driver_id: record.driver_id,
      earnings_released: 0,
      new_balance: null,
    };
  }

  if (pay.escrow_status !== 'held') {
    const balRes = await client.query(
      `SELECT wallet_balance FROM users WHERE id = $1`,
      [record.driver_id]
    );
    const bal = Math.round(Number(balRes.rows[0]?.wallet_balance || 0) * 100) / 100;
    return {
      skipped: true,
      reason: pay.escrow_status,
      driver_id: record.driver_id,
      earnings_released: 0,
      new_balance: bal,
    };
  }

  const payUpd = await client.query(
    `
      UPDATE payments
      SET escrow_status = 'released',
          commission = $1::numeric,
          driver_amount = $2::numeric,
          insurance_amount = $3::numeric,
          payout_status = 'pending',
          updated_at = NOW()
      WHERE order_id = $4
        AND escrow_status = 'held'
      RETURNING id
    `,
    [commissionAmt, driverEarnings, insuranceAmt, resolvedOrderId]
  );

  if (payUpd.rowCount === 0) {
    const balRes = await client.query(
      `SELECT wallet_balance FROM users WHERE id = $1`,
      [record.driver_id]
    );
    const bal = Math.round(Number(balRes.rows[0]?.wallet_balance || 0) * 100) / 100;
    return {
      skipped: true,
      reason: 'race_released',
      driver_id: record.driver_id,
      earnings_released: 0,
      new_balance: bal,
    };
  }

  await client.query(
    `SELECT id FROM users WHERE id = $1 FOR UPDATE`,
    [record.driver_id]
  );

  await client.query(
    `
      UPDATE users
      SET wallet_balance = wallet_balance + $1::numeric,
          updated_at = NOW()
      WHERE id = $2
    `,
    [driverEarnings, record.driver_id]
  );

  const { rows: balRows } = await client.query(
    `SELECT wallet_balance FROM users WHERE id = $1`,
    [record.driver_id]
  );
  const newBalance = Math.round(Number(balRows[0]?.wallet_balance || 0) * 100) / 100;

  await client.query(
    `
      INSERT INTO wallet_transactions (
        user_id, type, amount, reference, description, balance_after
      )
      VALUES ($1, 'credit', $2::numeric, $3, $4, $5::numeric)
    `,
    [
      record.driver_id,
      driverEarnings,
      `DELIVERY-${resolvedOrderId}`,
      'Delivery earnings released',
      newBalance,
    ]
  );

  await client.query(
    `
      INSERT INTO driver_tiers (driver_id, tier_name, deliveries_completed)
      VALUES ($1, 'new', 1)
      ON CONFLICT (driver_id)
      DO UPDATE SET
        deliveries_completed = driver_tiers.deliveries_completed + 1,
        tier_updated_at = NOW()
    `,
    [record.driver_id]
  );

  return {
    driver_id: record.driver_id,
    earnings_released: driverEarnings,
    new_balance: newBalance,
  };
}

module.exports = { releaseEscrow };

const db = require('../database/connection');
const { queueSMS } = require('../services/smsQueue');
const { sendPushNotification } = require('../services/notificationService');
const { setPayoutHeld } = require('../services/paymentService');
const { refundWallet, deductWallet, InsufficientWalletBalanceError } = require('../utils/wallet');
const { releaseEscrow } = require('../utils/escrow');

const VALID_REASONS = new Set([
  'not_delivered',
  'damaged',
  'wrong_item',
  'late_delivery',
  'driver_behaviour',
  'other',
]);

function mapLegacyDisputeType(t) {
  const s = String(t || '');
  if (s === 'lost_item') return 'other';
  if (VALID_REASONS.has(s)) return s;
  if (['damaged', 'not_delivered', 'wrong_item', 'driver_behaviour', 'other'].includes(s)) return s;
  return 'other';
}

async function notifyAdminsPush(orderNumber, orderId) {
  try {
    const r = await db.query(`SELECT id FROM users WHERE user_type = 'admin' AND is_active = true`);
    const title = 'New dispute';
    const body = `Dispute raised on order #${orderNumber || orderId}`;
    for (const row of r.rows) {
      await sendPushNotification(row.id, title, body, {
        type: 'dispute_admin',
        orderId: String(orderId || ''),
      });
    }
  } catch (e) {
    console.error('notifyAdminsPush:', e.message);
  }
}

/** POST /api/disputes — customer */
async function createDispute(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const customerId = req.user.id;
    let { order_id, job_id, reason, description } = req.body || {};

    if (!reason && req.body?.dispute_type) {
      reason = mapLegacyDisputeType(req.body.dispute_type);
    }

    const oid = order_id != null ? parseInt(String(order_id), 10) : null;
    const jid = job_id != null ? parseInt(String(job_id), 10) : null;

    if (!Number.isInteger(oid) && !Number.isInteger(jid)) {
      return res.status(400).json({ error: 'order_id or job_id is required' });
    }

    if (!reason || !VALID_REASONS.has(String(reason))) {
      return res.status(400).json({ error: 'Invalid dispute reason' });
    }

    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({
        error:
          'Please describe the issue in more detail (minimum 10 characters)',
      });
    }

    let record = null;
    let resolvedOrderId = Number.isInteger(oid) ? oid : null;
    let resolvedJobId = Number.isInteger(jid) ? jid : null;
    let driverId = null;

    if (Number.isInteger(oid)) {
      const { rows } = await db.query(
        `SELECT o.*,
                u.phone AS driver_phone,
                u.full_name AS driver_name
         FROM orders o
         LEFT JOIN users u ON u.id = o.driver_id
         WHERE o.id = $1
           AND o.customer_id = $2
           AND o.status IN ('delivered', 'completed')`,
        [oid, customerId]
      );
      if (!rows[0]) {
        return res.status(404).json({
          error: 'Order not found or not eligible for dispute',
        });
      }
      record = rows[0];
      driverId = record.driver_id ? Number(record.driver_id) : null;
      resolvedJobId = resolvedJobId ?? (record.delivery_job_id != null ? Number(record.delivery_job_id) : null);
    }

    if (Number.isInteger(jid)) {
      const { rows } = await db.query(
        `SELECT j.*,
                u.phone AS driver_phone,
                u.full_name AS driver_name
         FROM delivery_jobs j
         LEFT JOIN users u ON u.id = j.selected_driver_id
         WHERE j.id = $1
           AND j.customer_id = $2
           AND j.status IN ('delivered', 'completed')`,
        [jid, customerId]
      );
      if (!rows[0]) {
        return res.status(404).json({
          error: 'Job not found or not eligible for dispute',
        });
      }
      record = rows[0];
      driverId = record.selected_driver_id ? Number(record.selected_driver_id) : null;
      if (record.order_id) {
        resolvedOrderId = Number(record.order_id);
      }
    }

    if (!driverId || !Number.isFinite(driverId)) {
      return res.status(400).json({ error: 'No driver assigned for this delivery' });
    }

    const deliveredAt =
      record.delivery_confirmed_at || record.updated_at || record.created_at;
    const hoursSinceDelivery =
      (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60);

    if (!Number.isFinite(hoursSinceDelivery) || hoursSinceDelivery > 24) {
      return res.status(400).json({
        error:
          'Dispute window has closed. Disputes must be raised within 24 hours of delivery.',
      });
    }

    const existing = await db.query(
      `SELECT id FROM disputes d
       WHERE d.customer_id = $1
         AND d.status NOT IN ('resolved_refund','resolved_release','resolved_partial','closed')
         AND (
           ($2::integer IS NOT NULL AND d.order_id = $2)
           OR ($3::integer IS NOT NULL AND d.job_id = $3)
         )`,
      [customerId, resolvedOrderId, resolvedJobId]
    );

    if (existing.rows[0]) {
      return res.status(409).json({
        error: 'A dispute already exists for this delivery',
      });
    }

    const { rows: disputeRows } = await db.query(
      `INSERT INTO disputes (
        order_id, job_id,
        customer_id, driver_id,
        raised_by_user_id,
        dispute_type,
        reason,
        description,
        status,
        auto_release_at,
        updated_at
      ) VALUES (
        $1, $2,
        $3, $4,
        $3,
        CASE WHEN $5 = 'late_delivery' THEN 'other' ELSE $5 END,
        $5,
        $6,
        'open',
        NOW() + INTERVAL '24 hours',
        NOW()
      )
      RETURNING *`,
      [
        resolvedOrderId,
        resolvedJobId,
        customerId,
        driverId,
        String(reason),
        String(description).trim(),
      ]
    );

    const dispute = disputeRows[0];

    try {
      await setPayoutHeld(resolvedOrderId);
    } catch (e) {
      console.warn('setPayoutHeld:', e?.message || e);
    }

    if (resolvedOrderId) {
      await db.query(
        `UPDATE payments
         SET escrow_status = 'held',
             updated_at = NOW()
         WHERE order_id = $1`,
        [resolvedOrderId]
      );
    }

    await notifyAdminsPush(record.order_number, resolvedOrderId);

    const { rows: adminRows } = await db.query(
      `SELECT phone FROM users
       WHERE user_type = 'admin' AND is_active = true
       LIMIT 5`
    );

    const targetRef = resolvedOrderId || resolvedJobId;
    for (const admin of adminRows) {
      if (admin.phone) {
        queueSMS(
          admin.phone,
          `SwiftDrop DISPUTE #${dispute.id}\n`
            + `Reason: ${reason}\n`
            + `Order/Job: ${targetRef}\n`
            + 'Review in admin panel.',
          `DISPUTE-${dispute.id}-ADMIN-${Date.now()}`
        ).catch(() => {});
      }
    }

    if (record.driver_phone) {
      queueSMS(
        record.driver_phone,
        'SwiftDrop: A dispute has been '
          + `raised for delivery #${targetRef}.\n`
          + `Reason: ${reason}\n`
          + 'An admin will review and contact you shortly.',
        `DISPUTE-${dispute.id}-DRIVER-${Date.now()}`
      ).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      dispute_id: dispute.id,
      message:
        'Dispute raised successfully. An admin will review within 24 hours.',
    });
  } catch (err) {
    console.error('createDispute:', err);
    return res.status(500).json({ error: 'Could not create dispute' });
  }
}

/** GET /api/disputes/my — customer or driver */
async function getMyDisputes(req, res) {
  try {
    const userId = req.user.id;
    const isDriver = req.user.user_type === 'driver';

    const { rows } = await db.query(
      `SELECT
         d.*,
         o.pickup_address,
         o.dropoff_address,
         o.total_price,
         o.order_number,
         o.status AS order_status,
         cu.full_name AS customer_name,
         du.full_name AS driver_name
       FROM disputes d
       LEFT JOIN orders o ON o.id = d.order_id
       LEFT JOIN users cu ON cu.id = d.customer_id
       LEFT JOIN users du ON du.id = d.driver_id
       WHERE ${isDriver ? 'd.driver_id = $1' : 'd.customer_id = $1'}
       ORDER BY d.created_at DESC
       LIMIT 25`,
      [userId]
    );

    return res.json({ disputes: rows });
  } catch (err) {
    console.error('getMyDisputes:', err);
    return res.status(500).json({ error: 'Could not load disputes' });
  }
}

/** GET /api/disputes/admin — admin queue */
async function getAdminDisputes(req, res) {
  try {
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const raw = req.query.status || 'open';

    let rows;
    if (raw === 'open') {
      const r = await db.query(
        `SELECT
           d.*,
           o.pickup_address,
           o.dropoff_address,
           o.total_price,
           o.order_number,
           o.pickup_photo_url,
           o.delivery_photo_url,
           o.pickup_otp,
           o.delivery_otp,
           o.pickup_otp_attempts,
           o.delivery_otp_attempts,
           cu.full_name AS customer_name,
           cu.phone AS customer_phone,
           du.full_name AS driver_name,
           du.phone AS driver_phone,
           COALESCE(dt.current_rating, 0) AS driver_rating,
           COALESCE(dt.deliveries_completed, 0) AS driver_deliveries
         FROM disputes d
         LEFT JOIN orders o ON o.id = d.order_id
         LEFT JOIN users cu ON cu.id = d.customer_id
         LEFT JOIN users du ON du.id = d.driver_id
         LEFT JOIN driver_tiers dt ON dt.driver_id = d.driver_id
         WHERE d.status IN ('open', 'under_review')
         ORDER BY d.created_at ASC
         LIMIT 50`
      );
      rows = r.rows;
    } else {
      const r = await db.query(
        `SELECT
           d.*,
           o.pickup_address,
           o.dropoff_address,
           o.total_price,
           o.order_number,
           o.pickup_photo_url,
           o.delivery_photo_url,
           o.pickup_otp,
           o.delivery_otp,
           o.pickup_otp_attempts,
           o.delivery_otp_attempts,
           cu.full_name AS customer_name,
           cu.phone AS customer_phone,
           du.full_name AS driver_name,
           du.phone AS driver_phone,
           COALESCE(dt.current_rating, 0) AS driver_rating,
           COALESCE(dt.deliveries_completed, 0) AS driver_deliveries
         FROM disputes d
         LEFT JOIN orders o ON o.id = d.order_id
         LEFT JOIN users cu ON cu.id = d.customer_id
         LEFT JOIN users du ON du.id = d.driver_id
         LEFT JOIN driver_tiers dt ON dt.driver_id = d.driver_id
         WHERE d.status = $1
         ORDER BY d.created_at ASC
         LIMIT 50`,
        [raw]
      );
      rows = r.rows;
    }

    return res.json({ disputes: rows });
  } catch (err) {
    console.error('getAdminDisputes:', err);
    return res.status(500).json({ error: 'Could not load disputes' });
  }
}

/** GET /api/disputes — admin list (legacy query ?status=open) */
async function getAllDisputes(req, res) {
  if (req.user.user_type !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  return getAdminDisputes(req, res);
}

/** GET /api/disputes/:id — admin detail */
async function getDisputeDetail(req, res) {
  try {
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const dRes = await db.query(
      `SELECT
        d.id AS dispute_id,
        d.order_id,
        d.job_id,
        d.customer_id,
        d.driver_id,
        d.raised_by_user_id,
        d.dispute_type,
        d.reason,
        d.description,
        d.status AS dispute_status,
        d.resolution,
        d.resolution_notes,
        d.admin_notes,
        d.refund_amount,
        d.resolved_by_admin_id,
        d.admin_id,
        d.resolved_at,
        d.created_at AS dispute_created_at,
        d.updated_at AS dispute_updated_at,
        o.id AS order_pk,
        o.order_number,
        o.status AS order_status,
        o.pickup_address,
        o.dropoff_address,
        o.pickup_photo_url,
        o.delivery_photo_url,
        o.pickup_confirmed_at,
        o.delivery_confirmed_at,
        o.total_price,
        o.base_price,
        o.driver_earnings,
        o.driver_id AS order_driver_id,
        c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
        dr.full_name AS driver_name, dr.email AS driver_email, dr.phone AS driver_phone
       FROM disputes d
       LEFT JOIN orders o ON o.id = d.order_id
       INNER JOIN users c ON c.id = d.customer_id
       LEFT JOIN users dr ON dr.id = d.driver_id
       WHERE d.id = $1`,
      [id]
    );
    if (dRes.rows.length === 0) return res.status(404).json({ error: 'Dispute not found' });

    const row = dRes.rows[0];
    const order = row.order_pk
      ? {
          id: row.order_pk,
          order_number: row.order_number,
          status: row.order_status,
          pickup_address: row.pickup_address,
          dropoff_address: row.dropoff_address,
          pickup_photo_url: row.pickup_photo_url,
          delivery_photo_url: row.delivery_photo_url,
          pickup_confirmed_at: row.pickup_confirmed_at,
          delivery_confirmed_at: row.delivery_confirmed_at,
          total_price: row.total_price,
          base_price: row.base_price,
          driver_earnings: row.driver_earnings,
        }
      : null;

    const dispute = {
      id: row.dispute_id,
      order_id: row.order_id,
      job_id: row.job_id,
      customer_id: row.customer_id,
      driver_id: row.driver_id,
      raised_by_user_id: row.raised_by_user_id,
      dispute_type: row.dispute_type,
      reason: row.reason,
      description: row.description,
      status: row.dispute_status,
      resolution: row.resolution,
      resolution_notes: row.resolution_notes,
      admin_notes: row.admin_notes,
      refund_amount: row.refund_amount,
      resolved_by_admin_id: row.resolved_by_admin_id,
      admin_id: row.admin_id,
      resolved_at: row.resolved_at,
      created_at: row.dispute_created_at,
      updated_at: row.dispute_updated_at,
    };

    return res.json({
      dispute,
      order,
      customer: {
        full_name: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone,
      },
      driver: row.driver_id
        ? {
            full_name: row.driver_name,
            email: row.driver_email,
            phone: row.driver_phone,
          }
        : null,
    });
  } catch (err) {
    console.error('getDisputeDetail:', err);
    return res.status(500).json({
      error: 'Something went wrong. Please try again.',
    });
  }
}

async function maybeUpdateInsurancePool(client, orderId, amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0 || !orderId) return;
  await client.query(
    `UPDATE insurance_pool
     SET claim_amount = $1,
         claim_status = 'claimed',
         claimed_at = NOW()
     WHERE order_id = $2`,
    [amt, orderId]
  );
}

/** POST /api/disputes/:id/resolve — admin */
async function resolveDispute(req, res) {
  const adminId = req.user?.id;
  if (req.user?.user_type !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const disputeId = Number(req.params.id);
  if (!Number.isFinite(disputeId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  let resolution = req.body?.resolution ?? req.body?.decision;
  const refund_amount = req.body?.refund_amount;
  const admin_notes = req.body?.admin_notes ?? req.body?.resolution_notes ?? req.body?.resolution_note;
  const resolution_reason = req.body?.resolution_reason;

  if (resolution === 'refund_customer') resolution = 'refund';
  if (resolution === 'no_refund') resolution = 'release';
  if (resolution === 'partial_refund') resolution = 'partial';

  const validResolutions = ['refund', 'release', 'partial'];
  if (!validResolutions.includes(resolution)) {
    return res.status(400).json({
      error: 'Invalid resolution. Must be refund, release, or partial',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: dispRows } = await client.query(
      `SELECT d.*,
              o.total_price,
              o.driver_earnings,
              o.customer_id AS order_customer_id,
              o.order_number,
              p.escrow_status AS pay_escrow_status
       FROM disputes d
       LEFT JOIN orders o ON o.id = d.order_id
       LEFT JOIN payments p ON p.order_id = d.order_id
       WHERE d.id = $1
         AND d.status IN ('open', 'under_review')
       FOR UPDATE`,
      [disputeId]
    );

    if (!dispRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Dispute not found or already resolved',
      });
    }

    const dispute = dispRows[0];
    const orderId = dispute.order_id ? Number(dispute.order_id) : null;
    const customerId = Number(dispute.customer_id);
    const driverUserId = Number(dispute.driver_id);
    const totalPrice = Math.round(Number(dispute.total_price || 0) * 100) / 100;
    const driverEarnings = Math.round(Number(dispute.driver_earnings || 0) * 100) / 100;
    const escrowWasReleased = dispute.pay_escrow_status === 'released';

    if (!orderId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'This dispute is not linked to an order; resolve payouts manually.',
      });
    }

    if (resolution === 'refund') {
      const refundAmt = totalPrice;
      if (refundAmt > 0) {
        await refundWallet(
          client,
          customerId,
          refundAmt,
          `DISPUTE-REFUND-${disputeId}`
        );
      }

      if (escrowWasReleased && driverEarnings > 0) {
        try {
          await deductWallet(
            client,
            driverUserId,
            Math.min(driverEarnings, refundAmt),
            `DISPUTE-CLAWBACK-${disputeId}`
          );
        } catch (wErr) {
          if (!(wErr instanceof InsufficientWalletBalanceError)) throw wErr;
          console.warn(
            'resolveDispute: driver wallet insufficient for clawback',
            disputeId,
            wErr.message
          );
        }
      }

      await client.query(
        `UPDATE payments
         SET escrow_status = 'refunded',
             updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      );

      await client.query(
        `UPDATE orders
         SET status = 'disputed_refunded',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );

      await maybeUpdateInsurancePool(client, orderId, refundAmt);
    } else if (resolution === 'release') {
      await releaseEscrow(client, orderId, null);

      await client.query(
        `UPDATE orders
         SET status = 'completed',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );
    } else if (resolution === 'partial') {
      const partialRefund = Math.round(Number(refund_amount) * 100) / 100;
      if (!Number.isFinite(partialRefund) || partialRefund <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Refund amount required for partial resolution',
        });
      }

      if (partialRefund > totalPrice) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Refund exceeds order total' });
      }

      await refundWallet(
        client,
        customerId,
        partialRefund,
        `DISPUTE-PARTIAL-${disputeId}`
      );

      const driverNet = Math.max(
        0,
        Math.round((driverEarnings - partialRefund) * 100) / 100
      );

      if (!escrowWasReleased && driverNet > 0) {
        await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [
          driverUserId,
        ]);
        await client.query(
          `UPDATE users
           SET wallet_balance = wallet_balance + $1::numeric,
               updated_at = NOW()
           WHERE id = $2`,
          [driverNet, driverUserId]
        );
        const { rows: balRows } = await client.query(
          `SELECT wallet_balance FROM users WHERE id = $1`,
          [driverUserId]
        );
        const nb = Math.round(Number(balRows[0]?.wallet_balance || 0) * 100) / 100;
        await client.query(
          `INSERT INTO wallet_transactions (
             user_id, type, amount, reference, description, balance_after
           ) VALUES ($1, 'credit', $2::numeric, $3, $4, $5::numeric)`,
          [
            driverUserId,
            driverNet,
            `DISPUTE-PARTIAL-DRIVER-${disputeId}`,
            'Partial dispute resolution — driver share',
            nb,
          ]
        );
      }

      if (escrowWasReleased && partialRefund > 0) {
        try {
          await deductWallet(
            client,
            driverUserId,
            Math.min(partialRefund, driverEarnings),
            `DISPUTE-PARTIAL-CLAWBACK-${disputeId}`
          );
        } catch (wErr) {
          if (!(wErr instanceof InsufficientWalletBalanceError)) throw wErr;
          console.warn('resolveDispute: partial clawback skipped', wErr.message);
        }
      }

      await client.query(
        `UPDATE payments
         SET escrow_status = 'released',
             updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      );

      await maybeUpdateInsurancePool(client, orderId, partialRefund);
    }

    const statusMap = {
      refund: 'resolved_refund',
      release: 'resolved_release',
      partial: 'resolved_partial',
    };

    const notesVal =
      admin_notes != null && String(admin_notes).trim()
        ? String(admin_notes).trim()
        : null;
    const refundStored =
      resolution === 'refund'
        ? totalPrice
        : resolution === 'partial'
          ? Math.round(Number(refund_amount) * 100) / 100
          : null;

    await client.query(
      `UPDATE disputes
       SET status = $1,
           admin_id = $2,
           resolved_by_admin_id = $2,
           admin_notes = COALESCE($3, admin_notes),
           refund_amount = COALESCE($4::numeric, refund_amount),
           resolution_reason = COALESCE($5, resolution_reason),
           resolution_notes = COALESCE($3, resolution_notes),
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $6`,
      [
        statusMap[resolution],
        adminId,
        notesVal,
        refundStored,
        resolution_reason != null ? String(resolution_reason) : null,
        disputeId,
      ]
    );

    await client.query('COMMIT');

    const { rows: parties } = await db.query(
      `SELECT
         cu.phone AS customer_phone,
         cu.full_name AS customer_name,
         du.phone AS driver_phone,
         du.full_name AS driver_name
       FROM disputes d
       JOIN users cu ON cu.id = d.customer_id
       JOIN users du ON du.id = d.driver_id
       WHERE d.id = $1`,
      [disputeId]
    );
    const party = parties[0];

    if (party?.customer_phone) {
      const msg =
        resolution === 'refund'
          ? `SwiftDrop: Your dispute #${disputeId} has been resolved. Full refund of R${totalPrice.toFixed(
              2
            )} added to your wallet.`
          : resolution === 'partial'
            ? `SwiftDrop: Your dispute #${disputeId} has been resolved. Partial refund of R${Number(
                refund_amount
              ).toFixed(2)} added to your wallet.`
            : `SwiftDrop: Your dispute #${disputeId} has been reviewed. Payment has been released to the driver.`;

      queueSMS(
        party.customer_phone,
        msg,
        `DISPUTE-${disputeId}-CUST-RESOLVED-${Date.now()}`
      ).catch(() => {});
    }

    if (party?.driver_phone) {
      const partialRefundNum = Number(refund_amount);
      const driverShare =
        resolution === 'partial'
          ? Math.max(0, driverEarnings - partialRefundNum)
          : 0;
      const msg =
        resolution === 'release'
          ? `SwiftDrop: Dispute #${disputeId} resolved in your favour. Payment released to your wallet.`
          : resolution === 'partial'
            ? `SwiftDrop: Dispute #${disputeId} resolved. Your net share after adjustment: R${driverShare.toFixed(
                2
              )}.`
            : `SwiftDrop: Dispute #${disputeId} resolved. Refund issued to customer.`;

      queueSMS(
        party.driver_phone,
        msg,
        `DISPUTE-${disputeId}-DRV-RESOLVED-${Date.now()}`
      ).catch(() => {});
    }

    if (customerId) {
      await sendPushNotification(
        customerId,
        'Dispute resolved',
        `Your dispute #${disputeId} has been resolved`,
        { type: 'dispute_resolved', disputeId: String(disputeId), orderId: String(orderId) }
      );
    }
    if (driverUserId) {
      await sendPushNotification(
        driverUserId,
        'Dispute resolved',
        `Dispute #${disputeId} on order #${dispute.order_number || orderId}`,
        {
          type: 'dispute_resolved_driver',
          disputeId: String(disputeId),
          orderId: String(orderId),
        }
      );
    }

    return res.json({
      success: true,
      resolution,
      dispute_id: disputeId,
      message: 'Dispute resolved successfully',
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('resolveDispute:', err);
    return res.status(500).json({ error: 'Could not resolve dispute' });
  } finally {
    client.release();
  }
}

module.exports = {
  createDispute,
  getMyDisputes,
  getAdminDisputes,
  getAllDisputes,
  getDisputeDetail,
  resolveDispute,
};

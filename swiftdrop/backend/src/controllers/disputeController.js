const db = require('../database/connection');
const { sendPushNotification } = require('../services/notificationService');
const { refundCustomer, releaseHeldDriverPayout, setPayoutHeld } = require('../services/paymentService');

const DISPUTE_TYPES = new Set([
  'lost_item',
  'damaged',
  'not_delivered',
  'wrong_item',
  'driver_behaviour',
  'other',
]);

function requireAdmin(user) {
  if (!user || user.user_type !== 'admin') {
    const err = new Error('Admins only');
    err.statusCode = 403;
    throw err;
  }
}

async function notifyAdminsNewDispute(orderNumber, orderId) {
  try {
    const r = await db.query(`SELECT id FROM users WHERE user_type = 'admin' AND is_active = true`);
    const title = 'New dispute';
    const body = `New dispute raised on order #${orderNumber || orderId}`;
    for (const row of r.rows) {
      await sendPushNotification(row.id, title, body, {
        type: 'dispute_admin',
        orderId: String(orderId),
      });
    }
  } catch (e) {
    console.error('notifyAdminsNewDispute:', e.message);
  }
}

/** POST /api/disputes — customer */
async function raiseDispute(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const { order_id, dispute_type, description } = req.body;
    const oid = parseInt(order_id, 10);
    if (!Number.isInteger(oid)) {
      return res.status(400).json({ error: 'order_id is required' });
    }
    if (!dispute_type || !DISPUTE_TYPES.has(String(dispute_type))) {
      return res.status(400).json({ error: 'Invalid dispute_type' });
    }
    if (!description || String(description).trim().length < 20) {
      return res.status(400).json({ error: 'description must be at least 20 characters' });
    }

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [oid]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'This order does not belong to you' });
    }
    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Disputes can only be raised for delivered or completed orders' });
    }

    const openRes = await db.query(
      `SELECT id FROM disputes WHERE order_id = $1 AND status IN ('open','in_review')`,
      [oid]
    );
    if (openRes.rows.length > 0) {
      return res.status(400).json({ error: 'A dispute is already open for this order' });
    }

    const ins = await db.query(
      `INSERT INTO disputes (
        order_id, raised_by_user_id, dispute_type, description, status, updated_at
      ) VALUES ($1, $2, $3, $4, 'open', NOW())
      RETURNING *`,
      [oid, req.user.id, dispute_type, String(description).trim()]
    );

    const dispute = ins.rows[0];

    await setPayoutHeld(oid);

    await notifyAdminsNewDispute(order.order_number, oid);

    return res.status(201).json(dispute);
  } catch (err) {
    console.error('raiseDispute:', err);
    return res.status(500).json({ error: 'Failed to raise dispute' });
  }
}

/** GET /api/disputes/my — customer */
async function getMyDisputes(req, res) {
  try {
    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const rows = await db.query(
      `SELECT d.*,
        o.order_number, o.status AS order_status, o.pickup_address, o.dropoff_address,
        o.total_price, o.driver_id, o.pickup_photo_url, o.delivery_photo_url,
        o.created_at AS order_created_at
       FROM disputes d
       INNER JOIN orders o ON o.id = d.order_id
       WHERE d.raised_by_user_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    return res.json({ disputes: rows.rows });
  } catch (err) {
    console.error('getMyDisputes:', err);
    return res.status(500).json({ error: 'Failed to load disputes' });
  }
}

/** GET /api/disputes — admin */
async function getAllDisputes(req, res) {
  try {
    requireAdmin(req.user);
    const status = req.query.status;
    const params = [];
    let where = '';
    if (status) {
      if (!['open', 'in_review', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      params.push(status);
      where = `WHERE d.status = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT d.*,
        o.order_number, o.status AS order_status, o.total_price,
        o.pickup_address, o.dropoff_address,
        o.pickup_photo_url, o.delivery_photo_url,
        o.pickup_confirmed_at, o.delivery_confirmed_at,
        o.base_price, o.insurance_fee, o.commission_amount, o.driver_earnings,
        c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
        dr.full_name AS driver_name, dr.phone AS driver_phone
       FROM disputes d
       INNER JOIN orders o ON o.id = d.order_id
       INNER JOIN users c ON c.id = o.customer_id
       LEFT JOIN users dr ON dr.id = o.driver_id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    );
    return res.json({ disputes: rows.rows });
  } catch (err) {
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    console.error('getAllDisputes:', err);
    return res.status(500).json({ error: 'Failed to load disputes' });
  }
}

/** GET /api/disputes/:id — admin */
async function getDisputeDetail(req, res) {
  try {
    requireAdmin(req.user);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const dRes = await db.query(
      `SELECT
        d.id AS dispute_id,
        d.order_id,
        d.raised_by_user_id,
        d.dispute_type,
        d.description,
        d.status AS dispute_status,
        d.resolution,
        d.resolution_notes,
        d.refund_amount,
        d.resolved_by_admin_id,
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
        o.driver_id,
        c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
        dr.full_name AS driver_name, dr.email AS driver_email, dr.phone AS driver_phone
       FROM disputes d
       INNER JOIN orders o ON o.id = d.order_id
       INNER JOIN users c ON c.id = o.customer_id
       LEFT JOIN users dr ON dr.id = o.driver_id
       WHERE d.id = $1`,
      [id]
    );
    if (dRes.rows.length === 0) return res.status(404).json({ error: 'Dispute not found' });

    const row = dRes.rows[0];
    const order = {
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
    };

    const dispute = {
      id: row.dispute_id,
      order_id: row.order_id,
      raised_by_user_id: row.raised_by_user_id,
      dispute_type: row.dispute_type,
      description: row.description,
      status: row.dispute_status,
      resolution: row.resolution,
      resolution_notes: row.resolution_notes,
      refund_amount: row.refund_amount,
      resolved_by_admin_id: row.resolved_by_admin_id,
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
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    console.error('getDisputeDetail:', err);
    return res.status(500).json({ error: 'Failed to load dispute' });
  }
}

/** PATCH /api/disputes/:id/resolve — admin */
async function resolveDispute(req, res) {
  const client = await db.pool.connect();
  try {
    requireAdmin(req.user);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { resolution, resolution_notes, refund_amount } = req.body;
    if (!resolution || !['refund_customer', 'no_refund', 'partial_refund'].includes(resolution)) {
      return res.status(400).json({ error: 'resolution must be refund_customer, no_refund, or partial_refund' });
    }

    await client.query('BEGIN');

    const dRes = await client.query(
      `SELECT d.*, o.order_number, o.customer_id, o.driver_id, o.total_price
       FROM disputes d
       INNER JOIN orders o ON o.id = d.order_id
       WHERE d.id = $1 FOR UPDATE`,
      [id]
    );
    if (dRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dispute not found' });
    }
    const drow = dRes.rows[0];
    if (drow.status === 'resolved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Dispute already resolved' });
    }

    const orderId = drow.order_id;
    const totalPrice = parseFloat(drow.total_price) || 0;

    let storedRefundAmount = null;

    if (resolution === 'refund_customer') {
      await refundCustomer(orderId, totalPrice, client);
      storedRefundAmount = totalPrice;
    } else if (resolution === 'partial_refund') {
      const ra = parseFloat(refund_amount);
      if (!Number.isFinite(ra) || ra <= 0 || ra > totalPrice) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'refund_amount must be between 0 and order total' });
      }
      await refundCustomer(orderId, ra, client);
      storedRefundAmount = ra;
    } else {
      await releaseHeldDriverPayout(orderId, client);
    }

    if (resolution !== 'no_refund') {
      await releaseHeldDriverPayout(orderId, client);
    }

    if (resolution === 'refund_customer' || resolution === 'partial_refund') {
      await client.query(
        `UPDATE insurance_pool
         SET claim_amount = $1,
             claim_status = 'claimed',
             claimed_at = NOW()
         WHERE order_id = $2`,
        [storedRefundAmount, orderId]
      );
    }

    const upd = await client.query(
      `UPDATE disputes SET
        status = 'resolved',
        resolution = $1,
        resolution_notes = $2,
        refund_amount = COALESCE($3, refund_amount),
        resolved_by_admin_id = $4,
        resolved_at = NOW(),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        resolution,
        resolution_notes != null ? String(resolution_notes) : null,
        storedRefundAmount,
        req.user.id,
        id,
      ]
    );

    await client.query('COMMIT');

    const updated = upd.rows[0];
    const orderNum = drow.order_number || orderId;

    if (drow.customer_id) {
      await sendPushNotification(
        drow.customer_id,
        'Dispute resolved',
        `Your dispute #${id} has been resolved`,
        { type: 'dispute_resolved', disputeId: String(id), orderId: String(orderId) }
      );
    }
    if (drow.driver_id) {
      await sendPushNotification(
        drow.driver_id,
        'Dispute resolved',
        `Dispute resolved on order #${orderNum}`,
        { type: 'dispute_resolved_driver', disputeId: String(id), orderId: String(orderId) }
      );
    }

    return res.json(updated);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    console.error('resolveDispute:', err);
    return res.status(500).json({ error: err.message || 'Failed to resolve dispute' });
  } finally {
    client.release();
  }
}

module.exports = {
  raiseDispute,
  getMyDisputes,
  getAllDisputes,
  getDisputeDetail,
  resolveDispute,
};

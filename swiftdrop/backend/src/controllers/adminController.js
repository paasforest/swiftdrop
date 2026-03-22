const db = require('../database/connection');
const { normalizeSouthAfricaToE164 } = require('../utils/phoneNormalize');

function requireAdmin(user) {
  if (!user || user.user_type !== 'admin') {
    const err = new Error('Admins only');
    err.statusCode = 403;
    throw err;
  }
}

/** GET /api/admin/dashboard-stats */
async function dashboardStats(req, res) {
  try {
    requireAdmin(req.user);

    const [
      activeDeliveries,
      onlineDrivers,
      todayRevenue,
      openDisputes,
      pendingDriverApplications,
      unmatchedOrders,
    ] = await Promise.all([
      db.query(`
        SELECT COUNT(*)::int AS c FROM orders
        WHERE status NOT IN ('delivered', 'completed', 'cancelled', 'disputed')
      `),
      db.query(`
        SELECT COUNT(*)::int AS c FROM driver_locations WHERE is_online = true
      `),
      db.query(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS s FROM payments
        WHERE (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
      `),
      db.query(`SELECT COUNT(*)::int AS c FROM disputes WHERE status = 'open'`),
      db.query(
        `SELECT COUNT(*)::int AS c FROM driver_profiles WHERE verification_status = 'pending'`
      ),
      db.query(`SELECT COUNT(*)::int AS c FROM orders WHERE status = 'unmatched'`),
    ]);

    return res.json({
      active_deliveries: activeDeliveries.rows[0]?.c ?? 0,
      online_drivers: onlineDrivers.rows[0]?.c ?? 0,
      today_revenue: parseFloat(todayRevenue.rows[0]?.s) || 0,
      open_disputes: openDisputes.rows[0]?.c ?? 0,
      pending_driver_applications: pendingDriverApplications.rows[0]?.c ?? 0,
      unmatched_orders: unmatchedOrders.rows[0]?.c ?? 0,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to load stats' });
  }
}

/** GET /api/admin/deliveries */
async function listAdminDeliveries(req, res) {
  try {
    requireAdmin(req.user);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const statusFilter = (req.query.status || 'all').toLowerCase();
    const search = (req.query.search || '').trim();

    const params = [];
    const whereParts = [];
    let i = 1;

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'active') {
        whereParts.push(
          `o.status IN (
            'pending','matching','accepted',
            'pickup_en_route','pickup_arrived','collected',
            'delivery_en_route','delivery_arrived','delivered'
          )`
        );
      } else if (statusFilter === 'completed') {
        whereParts.push(`o.status IN ('delivered','completed')`);
      } else if (statusFilter === 'disputed') {
        whereParts.push(`o.status = 'disputed'`);
      } else if (statusFilter === 'cancelled') {
        whereParts.push(`o.status = 'cancelled'`);
      }
    }

    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      whereParts.push(`(o.order_number ILIKE $${i} OR c.full_name ILIKE $${i + 1})`);
      i += 2;
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS c
       FROM orders o
       JOIN users c ON c.id = o.customer_id
       ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.c ?? 0;

    const listParams = [...params, limit, offset];
    const base = params.length;
    const limitIdx = base + 1;
    const offsetIdx = base + 2;

    const rows = await db.query(
      `SELECT
         o.id,
         o.order_number,
         o.status,
         o.pickup_address,
         o.dropoff_address,
         o.total_price,
         o.commission_amount,
         o.driver_earnings,
         o.created_at,
         o.pickup_confirmed_at,
         o.delivery_confirmed_at,
         o.pickup_photo_url,
         o.delivery_photo_url,
         c.full_name AS customer_name,
         dr.full_name AS driver_name,
         p.amount AS payment_amount
       FROM orders o
       JOIN users c ON c.id = o.customer_id
       LEFT JOIN users dr ON dr.id = o.driver_id
       LEFT JOIN payments p ON p.order_id = o.id
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );

    return res.json({
      deliveries: rows.rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to load deliveries' });
  }
}

/**
 * POST /api/admin/wallet/set
 * Body: { phone: string (E.164 or SA local), wallet_balance: number }
 * Admin only. Sets user's wallet_balance to the given amount (replace, not increment).
 */
async function setUserWallet(req, res) {
  try {
    requireAdmin(req.user);

    const { phone, wallet_balance } = req.body || {};
    if (phone == null || String(phone).trim() === '') {
      return res.status(400).json({ error: 'phone is required' });
    }

    const bal = parseFloat(wallet_balance);
    if (!Number.isFinite(bal) || bal < 0) {
      return res.status(400).json({ error: 'wallet_balance must be a non-negative number' });
    }

    const phoneNorm = normalizeSouthAfricaToE164(String(phone).trim());
    if (!phoneNorm) {
      return res.status(400).json({
        error: 'Invalid phone number. Use a South African mobile (e.g. +2782… or 082…).',
      });
    }

    const amountStr = bal.toFixed(2);
    const r = await db.query(
      `UPDATE users
       SET wallet_balance = $1::numeric, updated_at = NOW()
       WHERE phone = $2
       RETURNING id, full_name, phone, email, user_type, wallet_balance`,
      [amountStr, phoneNorm]
    );

    if (!r.rows[0]) {
      return res.status(404).json({ error: 'User not found for this phone' });
    }

    return res.json({
      message: 'Wallet updated',
      user: r.rows[0],
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to set wallet' });
  }
}

/**
 * POST /api/admin/user/verify
 * Body: { email: string }
 * Admin only. Sets is_verified = true for the user with the given email.
 */
async function verifyUser(req, res) {
  try {
    requireAdmin(req.user);

    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ error: 'email is required' });
    }

    const r = await db.query(
      `UPDATE users
       SET is_verified = true, updated_at = NOW()
       WHERE email = $1
       RETURNING id, full_name, email, is_verified`,
      [email.trim()]
    );

    if (!r.rows[0]) {
      return res.status(404).json({ error: 'User not found for this email' });
    }

    return res.json({
      message: 'User verified',
      user: r.rows[0],
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to verify user' });
  }
}

module.exports = {
  dashboardStats,
  listAdminDeliveries,
  setUserWallet,
  verifyUser,
};

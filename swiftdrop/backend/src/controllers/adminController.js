const db = require('../database/connection');
const { normalizeSouthAfricaToE164 } = require('../utils/phoneNormalize');

function normalizeEmailForLookup(email) {
  return String(email ?? '').trim().toLowerCase();
}

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
      platformRevenueToday,
      insurancePoolBalance,
      pendingDriverPayouts,
      totalPlatformRevenueAlltime,
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
      db.query(`
        SELECT COALESCE(SUM(commission_amount), 0)::numeric AS s FROM platform_revenue
        WHERE revenue_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      `),
      db.query(`
        SELECT COALESCE(SUM(amount_collected), 0) - COALESCE(SUM(claim_amount), 0) AS s
        FROM insurance_pool
      `),
      db.query(`
        SELECT COALESCE(SUM(driver_amount), 0)::numeric AS s FROM payments
        WHERE payout_status = 'pending'
      `),
      db.query(`
        SELECT COALESCE(SUM(commission_amount), 0)::numeric AS s FROM platform_revenue
      `),
    ]);

    return res.json({
      active_deliveries: activeDeliveries.rows[0]?.c ?? 0,
      online_drivers: onlineDrivers.rows[0]?.c ?? 0,
      today_revenue: parseFloat(todayRevenue.rows[0]?.s) || 0,
      open_disputes: openDisputes.rows[0]?.c ?? 0,
      pending_driver_applications: pendingDriverApplications.rows[0]?.c ?? 0,
      unmatched_orders: unmatchedOrders.rows[0]?.c ?? 0,
      platform_revenue_today: parseFloat(platformRevenueToday.rows[0]?.s) || 0,
      insurance_pool_balance: parseFloat(insurancePoolBalance.rows[0]?.s) || 0,
      pending_driver_payouts: parseFloat(pendingDriverPayouts.rows[0]?.s) || 0,
      total_platform_revenue_alltime: parseFloat(totalPlatformRevenueAlltime.rows[0]?.s) || 0,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to load stats' });
  }
}

/**
 * GET /api/admin/finance/summary
 * Platform commission, insurance pool, and pending driver payouts with period breakdowns.
 */
async function financeSummary(req, res) {
  try {
    requireAdmin(req.user);

    const [
      prToday,
      prWeek,
      prMonth,
      prAll,
      insBalance,
      insColToday,
      insColWeek,
      insColMonth,
      insColAll,
      insClaimToday,
      insClaimWeek,
      insClaimMonth,
      insClaimAll,
      pendingTotal,
    ] = await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(commission_amount), 0)::numeric AS s FROM platform_revenue
        WHERE revenue_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      `),
      db.query(`
        SELECT COALESCE(SUM(commission_amount), 0)::numeric AS s FROM platform_revenue
        WHERE revenue_date >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)::date
      `),
      db.query(`
        SELECT COALESCE(SUM(commission_amount), 0)::numeric AS s FROM platform_revenue
        WHERE revenue_date >= date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)::date
      `),
      db.query(`
        SELECT COALESCE(SUM(commission_amount), 0)::numeric AS s FROM platform_revenue
      `),
      db.query(`
        SELECT COALESCE(SUM(amount_collected), 0) - COALESCE(SUM(claim_amount), 0) AS s
        FROM insurance_pool
      `),
      db.query(`
        SELECT COALESCE(SUM(amount_collected), 0)::numeric AS s FROM insurance_pool
        WHERE (collected_at AT TIME ZONE 'UTC')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      `),
      db.query(`
        SELECT COALESCE(SUM(amount_collected), 0)::numeric AS s FROM insurance_pool
        WHERE collected_at >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      `),
      db.query(`
        SELECT COALESCE(SUM(amount_collected), 0)::numeric AS s FROM insurance_pool
        WHERE collected_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      `),
      db.query(`SELECT COALESCE(SUM(amount_collected), 0)::numeric AS s FROM insurance_pool`),
      db.query(`
        SELECT COALESCE(SUM(claim_amount), 0)::numeric AS s FROM insurance_pool
        WHERE (claimed_at AT TIME ZONE 'UTC')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      `),
      db.query(`
        SELECT COALESCE(SUM(claim_amount), 0)::numeric AS s FROM insurance_pool
        WHERE claimed_at >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      `),
      db.query(`
        SELECT COALESCE(SUM(claim_amount), 0)::numeric AS s FROM insurance_pool
        WHERE claimed_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      `),
      db.query(`
        SELECT COALESCE(SUM(claim_amount), 0)::numeric AS s FROM insurance_pool
      `),
      db.query(`
        SELECT COALESCE(SUM(driver_amount), 0)::numeric AS s FROM payments
        WHERE payout_status = 'pending'
      `),
    ]);

    const pending = parseFloat(pendingTotal.rows[0]?.s) || 0;

    return res.json({
      platform_revenue: {
        today: parseFloat(prToday.rows[0]?.s) || 0,
        week: parseFloat(prWeek.rows[0]?.s) || 0,
        month: parseFloat(prMonth.rows[0]?.s) || 0,
        alltime: parseFloat(prAll.rows[0]?.s) || 0,
      },
      insurance_pool: {
        balance: parseFloat(insBalance.rows[0]?.s) || 0,
        collected: {
          today: parseFloat(insColToday.rows[0]?.s) || 0,
          week: parseFloat(insColWeek.rows[0]?.s) || 0,
          month: parseFloat(insColMonth.rows[0]?.s) || 0,
          alltime: parseFloat(insColAll.rows[0]?.s) || 0,
        },
        claimed: {
          today: parseFloat(insClaimToday.rows[0]?.s) || 0,
          week: parseFloat(insClaimWeek.rows[0]?.s) || 0,
          month: parseFloat(insClaimMonth.rows[0]?.s) || 0,
          alltime: parseFloat(insClaimAll.rows[0]?.s) || 0,
        },
      },
      pending_driver_payouts: {
        total: pending,
        today: pending,
        week: pending,
        month: pending,
        alltime: pending,
        note: 'Current snapshot: sum of driver_amount where payout_status is pending',
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to load finance summary' });
  }
}

/**
 * GET /api/admin/finance/revenue
 * Daily platform commission totals for the last 30 days (for charts).
 */
async function financeRevenueDaily(req, res) {
  try {
    requireAdmin(req.user);

    const r = await db.query(
      `
      SELECT revenue_date::text AS date, COALESCE(SUM(commission_amount), 0)::numeric AS total
      FROM platform_revenue
      WHERE revenue_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - INTERVAL '29 days'
      GROUP BY revenue_date
      ORDER BY revenue_date ASC
      `
    );

    const rows = r.rows.map((row) => ({
      date: row.date,
      total: parseFloat(row.total) || 0,
    }));

    return res.json({ days: rows, count: rows.length });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to load revenue series' });
  }
}

/**
 * GET /api/admin/finance/insurance
 * Insurance pool rows (transactions).
 */
async function financeInsurancePool(req, res) {
  try {
    requireAdmin(req.user);

    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const r = await db.query(
      `
      SELECT id, order_id, order_number, amount_collected, collected_at,
             claim_amount, claim_status, claimed_at
      FROM insurance_pool
      ORDER BY collected_at DESC NULLS LAST, id DESC
      LIMIT $1
      `,
      [limit]
    );

    return res.json({ transactions: r.rows, limit });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Failed to load insurance pool' });
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
 * Admin only. Sets is_verified = true for the user with this email.
 */
async function verifyUserByEmail(req, res) {
  try {
    requireAdmin(req.user);

    const { email } = req.body || {};
    if (email == null || String(email).trim() === '') {
      return res.status(400).json({ error: 'email is required' });
    }

    const emailNorm = normalizeEmailForLookup(email);
    if (!emailNorm || !emailNorm.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const r = await db.query(
      `UPDATE users
       SET is_verified = true, updated_at = NOW()
       WHERE email = $1
       RETURNING id, full_name, phone, email, user_type, is_verified`,
      [emailNorm]
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
  financeSummary,
  financeRevenueDaily,
  financeInsurancePool,
  listAdminDeliveries,
  setUserWallet,
  verifyUserByEmail,
};

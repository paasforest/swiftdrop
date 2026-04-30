const db = require('../database/connection');

function formatZAR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'R0.00';
  const fixed = n.toFixed(2);
  const [intPart, dec] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `R${withCommas}.${dec}`;
}

/**
 * GET /api/wallet/balance — authenticated user's wallet_balance from users row.
 */
async function getWalletBalance(req, res) {
  try {
    const r = await db.query(
      `SELECT wallet_balance FROM users WHERE id = $1`,
      [req.user.id]
    );
    const row = r.rows[0];
    const raw = row?.wallet_balance;
    const balance = parseFloat(raw);
    const safe = Number.isFinite(balance) ? balance : 0;

    return res.json({
      balance: safe,
      formatted: formatZAR(safe),
    });
  } catch (err) {
    console.error('getWalletBalance:', err);
    return res.status(500).json({ error: 'Could not load wallet balance' });
  }
}

/**
 * GET /api/wallet/transactions?limit=20 — recent wallet rows for the authenticated user.
 */
async function getTransactions(req, res) {
  try {
    const raw = req.query.limit;
    const n = raw != null ? parseInt(String(raw), 10) : 20;
    const limit = Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 20;
    const { rows } = await db.query(
      `SELECT id, user_id, type, amount, reference, description, created_at
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    return res.json({ transactions: rows });
  } catch (err) {
    console.error('getTransactions:', err);
    return res.status(500).json({ error: 'Could not load transactions' });
  }
}

module.exports = {
  getWalletBalance,
  getTransactions,
};

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

module.exports = {
  getWalletBalance,
};

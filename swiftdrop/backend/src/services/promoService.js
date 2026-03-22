const db = require('../database/connection');

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase();
}

function computeDiscountAmount(promoRow, orderTotal) {
  const total = roundMoney(Number(orderTotal));
  if (!Number.isFinite(total) || total <= 0) return 0;
  const dv = Number(promoRow.discount_value);
  if (!Number.isFinite(dv) || dv < 0) return 0;
  const type = String(promoRow.discount_type || '').toLowerCase();
  if (type === 'percent') {
    const d = roundMoney((total * dv) / 100);
    return Math.min(d, total);
  }
  if (type === 'fixed') {
    return Math.min(roundMoney(dv), total);
  }
  return 0;
}

/**
 * Validate promo for API (no row lock). Re-validated in createOrder with FOR UPDATE.
 * @returns {Promise<{ valid: boolean, discount_amount?: number, final_total?: number, error?: string }>}
 */
async function validatePromoForOrder(userId, codeRaw, orderTotal) {
  const normalized = normalizePromoCode(codeRaw);
  if (!normalized) {
    return { valid: false, error: 'Code required' };
  }
  const total = roundMoney(Number(orderTotal));
  if (!Number.isFinite(total) || total <= 0) {
    return { valid: false, error: 'Invalid order total' };
  }

  const promoRes = await db.query(
    `SELECT * FROM promo_codes WHERE UPPER(TRIM(code)) = $1`,
    [normalized]
  );
  const row = promoRes.rows[0];
  if (!row || !row.is_active) {
    return { valid: false, error: 'Invalid or inactive promo code' };
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { valid: false, error: 'This promo code has expired' };
  }
  const uses = parseInt(row.uses_count, 10) || 0;
  const maxUses = row.max_uses != null ? parseInt(row.max_uses, 10) : null;
  if (maxUses != null && uses >= maxUses) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }

  const usedRes = await db.query(
    `SELECT id FROM promo_code_uses WHERE code_id = $1 AND user_id = $2`,
    [row.id, userId]
  );
  if (usedRes.rows.length > 0) {
    return { valid: false, error: 'You have already used this promo code' };
  }

  const discount_amount = computeDiscountAmount(row, total);
  const final_total = roundMoney(Math.max(0, total - discount_amount));

  return {
    valid: true,
    discount_amount,
    final_total,
  };
}

/**
 * Apply promo inside an open transaction (locks promo row).
 * @param {import('pg').PoolClient} client
 * @returns {Promise<{ discount: number, promoRow: object } | null>}
 */
async function applyPromoInTransaction(client, userId, codeRaw, orderSubtotal) {
  const normalized = normalizePromoCode(codeRaw);
  if (!normalized) return null;

  const subtotal = roundMoney(Number(orderSubtotal));
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    const err = new Error('Invalid order total');
    err.statusCode = 400;
    throw err;
  }

  const promoRes = await client.query(
    `SELECT * FROM promo_codes WHERE UPPER(TRIM(code)) = $1 FOR UPDATE`,
    [normalized]
  );
  const row = promoRes.rows[0];
  if (!row || !row.is_active) {
    const err = new Error('Invalid or inactive promo code');
    err.statusCode = 400;
    throw err;
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    const err = new Error('This promo code has expired');
    err.statusCode = 400;
    throw err;
  }
  const uses = parseInt(row.uses_count, 10) || 0;
  const maxUses = row.max_uses != null ? parseInt(row.max_uses, 10) : null;
  if (maxUses != null && uses >= maxUses) {
    const err = new Error('This promo code has reached its usage limit');
    err.statusCode = 400;
    throw err;
  }

  const usedRes = await client.query(
    `SELECT id FROM promo_code_uses WHERE code_id = $1 AND user_id = $2`,
    [row.id, userId]
  );
  if (usedRes.rows.length > 0) {
    const err = new Error('You have already used this promo code');
    err.statusCode = 400;
    throw err;
  }

  const discount = computeDiscountAmount(row, subtotal);
  return { discount, promoRow: row };
}

module.exports = {
  roundMoney,
  normalizePromoCode,
  computeDiscountAmount,
  validatePromoForOrder,
  applyPromoInTransaction,
};

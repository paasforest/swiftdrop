const DEFAULT_GENERIC = 'Something went wrong. Please try again.';

class InsufficientWalletBalanceError extends Error {
  constructor(required, available) {
    super(
      `Insufficient balance. Required: R${required}, Available: R${available}`
    );
    this.name = 'InsufficientWalletBalanceError';
    this.statusCode = 400;
    this.required = required;
    this.available = available;
  }
}

/**
 * Debit wallet inside an open transaction with row-level lock on the user.
 * Records wallet_transactions.balance_after when the column exists.
 */
async function deductWallet(client, userId, amount, reference, paymentDescriptionOverride) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error(DEFAULT_GENERIC);
  }

  const { rows } = await client.query(
    `
      SELECT wallet_balance
      FROM users
      WHERE id = $1
      FOR UPDATE
    `,
    [userId]
  );

  if (!rows[0]) {
    throw new Error(DEFAULT_GENERIC);
  }

  const balance = Number(rows[0].wallet_balance || 0);
  const roundedBalance = Math.round(balance * 100) / 100;
  const roundedAmt = Math.round(amt * 100) / 100;

  if (roundedBalance < roundedAmt) {
    throw new InsufficientWalletBalanceError(roundedAmt, roundedBalance);
  }

  const balanceAfter = Math.round((roundedBalance - roundedAmt) * 100) / 100;

  await client.query(
    `
      UPDATE users
      SET wallet_balance = wallet_balance - $1::numeric,
          updated_at = NOW()
      WHERE id = $2
    `,
    [roundedAmt, userId]
  );

  const desc =
    paymentDescriptionOverride
    ?? `Payment for ${reference}`;

  await client.query(
    `
      INSERT INTO wallet_transactions (
        user_id, type, amount, reference, description, balance_after
      )
      VALUES ($1, 'debit', $2::numeric, $3, $4, $5::numeric)
    `,
    [userId, roundedAmt, reference, desc, balanceAfter]
  );
}

/**
 * Credit wallet inside an open transaction; serializes on the user row.
 */
async function refundWallet(client, userId, amount, reference, refundDescriptionOverride) {
  await client.query(
    `
      SELECT 1 FROM users WHERE id = $1 FOR UPDATE
    `,
    [userId]
  );

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error(DEFAULT_GENERIC);
  }

  const roundedAmt = Math.round(amt * 100) / 100;

  await client.query(
    `
      UPDATE users
      SET wallet_balance = wallet_balance + $1::numeric,
          updated_at = NOW()
      WHERE id = $2
    `,
    [roundedAmt, userId]
  );

  const { rows } = await client.query(
    `SELECT wallet_balance FROM users WHERE id = $1`,
    [userId]
  );

  const balAfter =
    rows[0]?.wallet_balance != null ? Number(rows[0].wallet_balance) : roundedAmt;

  const desc =
    refundDescriptionOverride
    ?? `Refund for ${reference}`;

  await client.query(
    `
      INSERT INTO wallet_transactions (
        user_id, type, amount, reference, description, balance_after
      )
      VALUES ($1, 'credit', $2::numeric, $3, $4, $5::numeric)
    `,
    [userId, roundedAmt, reference, desc, Math.round(balAfter * 100) / 100]
  );
}

module.exports = {
  deductWallet,
  refundWallet,
  InsufficientWalletBalanceError,
  DEFAULT_GENERIC,
};

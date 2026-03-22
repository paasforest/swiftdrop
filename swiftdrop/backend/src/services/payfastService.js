const crypto = require('crypto');

function getPayFastBaseUrl() {
  const useSandbox =
    String(process.env.PAYFAST_USE_SANDBOX || '').toLowerCase() === 'true' ||
    String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

  if (useSandbox) {
    return (
      process.env.PAYFAST_SANDBOX_PROCESS_URL ||
      'https://sandbox.payfast.co.za/eng/process'
    );
  }

  return process.env.PAYFAST_PROCESS_URL || 'https://www.payfast.co.za/eng/process';
}

function md5(text) {
  return crypto.createHash('md5').update(String(text), 'utf8').digest('hex');
}

function buildSignature(params, passphrase) {
  // PayFast signature string uses urlencoded key/value pairs, concatenated with &
  // and (optionally) appends the passphrase.
  const signatureKeys = [
    'merchant_id',
    'merchant_key',
    'amount',
    'item_name',
    'item_description',
    'return_url',
    'cancel_url',
    'notify_url',
    'name_first',
    'name_last',
    'email_address',
    'cell_number',
    'm_payment_id',
    'custom_str1',
    'custom_int1',
  ];

  const parts = [];
  for (const k of signatureKeys) {
    if (params[k] === undefined || params[k] === null || params[k] === '') continue;
    parts.push(`${k}=${encodeURIComponent(params[k])}`);
  }

  // When PayFast passphrase is used, it gets appended with &passphrase=...
  const base = parts.join('&');
  if (passphrase) {
    return md5(`${base}&passphrase=${encodeURIComponent(passphrase)}`);
  }

  return md5(base);
}

async function initiatePayFastPayment({ order, customer, amount, item_name }) {
  const merchant_id = process.env.PAYFAST_MERCHANT_ID;
  const merchant_key = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const return_url = process.env.PAYFAST_RETURN_URL;
  const cancel_url = process.env.PAYFAST_CANCEL_URL;
  const notify_url = process.env.PAYFAST_NOTIFY_URL;

  if (!merchant_id || !merchant_key) {
    throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY must be set on the backend');
  }
  if (!return_url || !cancel_url) {
    throw new Error('PAYFAST_RETURN_URL and PAYFAST_CANCEL_URL must be set on the backend');
  }

  const [name_first, ...rest] = String(customer?.full_name || 'Customer').trim().split(/\s+/);
  const name_last = rest.join(' ') || 'Customer';

  const payment_id = String(order.order_number || order.id);

  const payload = {
    merchant_id,
    merchant_key,
    amount: amount.toFixed(2),
    item_name: item_name || 'SwiftDrop delivery',
    item_description: `Order ${payment_id} - SwiftDrop`,
    m_payment_id: payment_id,
    return_url,
    cancel_url,
    ...(notify_url ? { notify_url } : {}),
    name_first,
    name_last,
    email_address: customer?.email || '',
    cell_number: customer?.phone || '',
    custom_str1: `order:${order.id}`,
    custom_int1: order.id,
  };

  const signature = buildSignature(payload, passphrase);

  // Redirect URL: open this in the user's browser/WebView.
  const payment_url =
    getPayFastBaseUrl() +
    '?' +
    new URLSearchParams({
      ...payload,
      signature,
    }).toString();

  return {
    payment_url,
    payment_id,
    return_url,
    cancel_url,
  };
}

/**
 * Wallet top-up: no order row; uses wallet_topups id in custom_str1.
 */
async function initiatePayFastWalletTopUp({ topupId, amount, customer }) {
  const merchant_id = process.env.PAYFAST_MERCHANT_ID;
  const merchant_key = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const return_url = process.env.PAYFAST_RETURN_URL;
  const cancel_url = process.env.PAYFAST_CANCEL_URL;
  const notify_url = process.env.PAYFAST_WALLET_NOTIFY_URL || process.env.PAYFAST_NOTIFY_URL;

  if (!merchant_id || !merchant_key) {
    throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY must be set on the backend');
  }
  if (!return_url || !cancel_url) {
    throw new Error('PAYFAST_RETURN_URL and PAYFAST_CANCEL_URL must be set on the backend');
  }
  if (!notify_url) {
    throw new Error('PAYFAST_WALLET_NOTIFY_URL or PAYFAST_NOTIFY_URL must be set for wallet top-ups');
  }

  const [name_first, ...rest] = String(customer?.full_name || 'Customer').trim().split(/\s+/);
  const name_last = rest.join(' ') || 'Customer';
  const payment_id = `WALLET-${topupId}`;

  const payload = {
    merchant_id,
    merchant_key,
    amount: Number(amount).toFixed(2),
    item_name: 'SwiftDrop wallet top-up',
    item_description: `Wallet top-up #${topupId}`,
    m_payment_id: payment_id,
    return_url,
    cancel_url,
    notify_url,
    name_first,
    name_last,
    email_address: customer?.email || '',
    cell_number: customer?.phone || '',
    custom_str1: `wallet_topup:${topupId}`,
    custom_int1: topupId,
  };

  const signature = buildSignature(payload, passphrase);

  const payment_url =
    getPayFastBaseUrl() +
    '?' +
    new URLSearchParams({
      ...payload,
      signature,
    }).toString();

  return {
    payment_url,
    payment_id,
    return_url,
    cancel_url,
  };
}

/**
 * Verify PayFast ITN signature (incoming POST body as plain object).
 */
function verifyPayFastItnSignature(body) {
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const received = body && body.signature;
  if (!received) return false;

  const keys = Object.keys(body)
    .filter((k) => k !== 'source' && k !== 'signature')
    .sort();

  const pairs = [];
  for (const k of keys) {
    const v = body[k];
    if (v === undefined || v === null || v === '') continue;
    pairs.push(`${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`);
  }
  const base = pairs.join('&');
  const calc = passphrase ? md5(`${base}&passphrase=${encodeURIComponent(passphrase)}`) : md5(base);
  return calc === received;
}

module.exports = { initiatePayFastPayment, initiatePayFastWalletTopUp, verifyPayFastItnSignature };


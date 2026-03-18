const https = require('https');

function normalizeDestination(phoneNumber) {
  // Expected format: "27XXXXXXXXX" (no '+', digits only).
  let value = String(phoneNumber ?? '').trim();
  value = value.replace(/\s+/g, '');

  if (value.startsWith('+')) value = value.slice(1);

  // Basic SA normalization: 0xxxxxxxxx => 27xxxxxxxxx
  if (value.startsWith('0')) value = `27${value.slice(1)}`;

  const digits = value.replace(/[^\d]/g, '');
  // Ensure it starts with country code 27.
  if (!digits.startsWith('27')) return '';
  return digits;
}

async function request({ url, method, headers, body }) {
  // Prefer global fetch (Node 18+). Fall back to https to avoid runtime surprises.
  if (typeof fetch === 'function') {
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // leave json as null
    }
    return { ok: res.ok, status: res.status, text, json };
  }

  return await new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            // leave json as null
          }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: data, json });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let cachedToken = null;
let cachedTokenExpiresAt = 0; // epoch ms

async function getToken() {
  try {
    // Cache token for ~23 hours so we refresh before it expires.
    if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

    const clientId = process.env.SMSPORTAL_CLIENT_ID;
    const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log('[SMS] (SMSPortal not configured) Missing SMSPORTAL_CLIENT_ID / SMSPORTAL_CLIENT_SECRET');
      return null;
    }

    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

    const res = await request({
      url: 'https://rest.smsportal.com/v1/authentication',
      method: 'POST',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      body: null,
    });

    if (!res.ok) {
      throw new Error(`SMSPortal token request failed: HTTP ${res.status} - ${res.text?.slice(0, 300) || ''}`);
    }

    const token =
      res.json?.token ||
      res.json?.access_token ||
      res.json?.accessToken ||
      res.json?.data?.token ||
      res.json?.data?.access_token;

    if (!token) {
      throw new Error(`SMSPortal token missing in response: ${res.text?.slice(0, 300) || ''}`);
    }

    cachedToken = token;
    cachedTokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
    return cachedToken;
  } catch (err) {
    console.error('[SMSPortal] getToken failed:', err?.message || err);
    return null;
  }
}

async function sendSMS(phoneNumber, message) {
  try {
    const token = await getToken();
    if (!token) {
      // Never crash the app if SMS sending fails.
      return { ok: false, error: 'SMSPortal token unavailable' };
    }

    const destination = normalizeDestination(phoneNumber);
    if (!destination) {
      return { ok: false, error: `Invalid destination phone number: "${phoneNumber}"` };
    }

    const body = JSON.stringify({
      messages: [
        {
          destination,
          content: message,
        },
      ],
    });

    const res = await request({
      url: 'https://rest.smsportal.com/v1/bulkmessages',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    });

    if (!res.ok) {
      console.error('[SMSPortal] sendSMS failed HTTP', res.status, res.text?.slice(0, 500) || '');
      return { ok: false, error: `SMSPortal send failed: HTTP ${res.status}`, response: res.json || res.text };
    }

    return { ok: true, response: res.json || res.text };
  } catch (err) {
    console.error('[SMSPortal] sendSMS exception:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function sendOTP(phone, code) {
  try {
    return await sendSMS(phone, 'SwiftDrop: Your code is ' + code + '. Valid 10 min.');
  } catch (err) {
    console.error('[SMSPortal] sendOTP failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function sendPickupOTP(phone, code, driverName) {
  try {
    return await sendSMS(phone, 'SwiftDrop: ' + driverName + ' arrived. Pickup code: ' + code);
  } catch (err) {
    console.error('[SMSPortal] sendPickupOTP failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function sendDeliveryOTP(phone, code, driverName) {
  try {
    return await sendSMS(phone, 'SwiftDrop: ' + driverName + ' arrived with your parcel. Delivery code: ' + code);
  } catch (err) {
    console.error('[SMSPortal] sendDeliveryOTP failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function sendDeliveryConfirmation(phone, address) {
  try {
    return await sendSMS(phone, 'SwiftDrop: Your parcel was delivered to ' + address);
  } catch (err) {
    console.error('[SMSPortal] sendDeliveryConfirmation failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function sendDriverPayment(phone, amount, orderNum) {
  try {
    return await sendSMS(phone, 'SwiftDrop: R' + amount + ' earned on job #' + orderNum);
  } catch (err) {
    console.error('[SMSPortal] sendDriverPayment failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = {
  getToken,
  sendSMS,
  sendOTP,
  sendPickupOTP,
  sendDeliveryOTP,
  sendDeliveryConfirmation,
  sendDriverPayment,
};

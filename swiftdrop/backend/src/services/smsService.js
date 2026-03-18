const twilio = require('twilio');

let client = null;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Only init Twilio if credentials look valid (real SIDs start with AC)
if (accountSid && accountSid.startsWith('AC') && authToken) {
  client = twilio(accountSid, authToken);
}

async function sendSMS(to, message) {
  if (!client || !fromNumber) {
    console.log('[SMS] (Twilio not configured) Would send to', to, ':', message);
    return { ok: true, simulated: true };
  }
  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to: to.startsWith('+') ? to : `+27${to.replace(/^0/, '')}`,
  });
  return { ok: true, sid: result.sid };
}

module.exports = { sendSMS };

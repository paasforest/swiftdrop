'use strict';

const crypto = require('crypto');
const db = require('../database/connection');
const smsService = require('./smsService');

/**
 * Send SMS with logging; failed sends are stored for retryFailedSMS.
 * @param {string} phone
 * @param {string} message
 * @param {string} [reference] unique key (recommended)
 */
async function queueSMS(phone, message, reference) {
  const ref =
    reference
    || `SMS-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  try {
    const sendRes = await smsService.sendSMS(phone, message);
    if (!sendRes.ok) {
      throw new Error(sendRes.error || 'SMS send failed');
    }

    await db.query(
      `
      INSERT INTO sms_log (
        phone, message, reference,
        status, attempts, last_error, updated_at
      ) VALUES ($1, $2, $3, 'sent', 1, NULL, NOW())
      ON CONFLICT (reference) DO UPDATE SET
        status = 'sent',
        attempts = 1,
        last_error = NULL,
        updated_at = NOW()
      `,
      [phone, message, ref]
    );
  } catch (err) {
    console.error('SMS failed:', err);
    const msg = err.message != null ? String(err.message) : 'SMS send failed';

    await db.query(
      `
      INSERT INTO sms_log (
        phone, message, reference,
        status, attempts, last_error, updated_at
      ) VALUES ($1, $2, $3, 'pending', 1, LEFT($4::text, 2000), NOW())
      ON CONFLICT (reference) DO UPDATE SET
        attempts = sms_log.attempts + 1,
        last_error = LEFT($4::text, 2000),
        status = 'pending',
        updated_at = NOW()
      `,
      [phone, message, ref, msg]
    );
  }
}

async function retryFailedSMS() {
  const { rows } = await db.query(
    `
    SELECT *
    FROM sms_log
    WHERE status = 'pending'
      AND attempts < 3
      AND (
        last_attempted_at IS NULL
        OR last_attempted_at < NOW() - INTERVAL '5 minutes'
      )
    ORDER BY created_at ASC
    LIMIT 10
    `
  );

  for (const sms of rows) {
    await db.query(
      `UPDATE sms_log SET last_attempted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [sms.id]
    );

    try {
      const sendRes = await smsService.sendSMS(sms.phone, sms.message);
      if (!sendRes.ok) {
        throw new Error(sendRes.error || 'SMS send failed');
      }

      await db.query(
        `
        UPDATE sms_log
        SET status = 'sent',
            last_error = NULL,
            updated_at = NOW()
        WHERE id = $1
        `,
        [sms.id]
      );
    } catch (err) {
      const errText = err.message != null ? String(err.message).slice(0, 2000) : 'retry failed';

      await db.query(
        `
        UPDATE sms_log
        SET attempts = sms_log.attempts + 1,
            last_error = $1,
            status = CASE
              WHEN sms_log.attempts + 1 >= 3 THEN 'failed'
              ELSE 'pending'
            END,
            updated_at = NOW()
        WHERE id = $2
        `,
        [errText, sms.id]
      );
    }
  }
}

module.exports = { queueSMS, retryFailedSMS };

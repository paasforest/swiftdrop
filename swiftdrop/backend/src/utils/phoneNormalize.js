function stripInvisible(s) {
  return String(s ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
}

/**
 * Canonical South African mobile for DB storage (E.164): +27XXXXXXXXX
 * Accepts common user inputs: +27..., 27..., 0..., or 9 digits starting with 6/7/8.
 */
function normalizeSouthAfricaToE164(input) {
  let value = stripInvisible(input).replace(/\s+/g, '');
  if (!value) return null;

  if (value.startsWith('+')) value = value.slice(1);

  if (value.startsWith('0')) {
    value = `27${value.slice(1)}`;
  }

  let digits = value.replace(/[^\d]/g, '');

  if (digits.startsWith('27')) {
    // 27 + 9-digit national number (typical SA mobile length)
    if (digits.length === 11) {
      return `+${digits}`;
    }
    return null;
  }

  // Local mobile without leading 0 (9 digits; SA mobiles typically start with 6, 7, or 8)
  if (digits.length === 9 && /^[678]/.test(digits)) {
    return `+27${digits}`;
  }

  return null;
}

module.exports = { normalizeSouthAfricaToE164 };

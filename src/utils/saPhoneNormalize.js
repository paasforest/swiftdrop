export function stripInvisible(s) {
  return String(s ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
}

/** Canonical +27… form for API (aligned with backend normalizeSouthAfricaToE164). */
export function normalizePhoneForApi(phoneInput) {
  let v = stripInvisible(phoneInput).replace(/\s+/g, '');
  if (v.startsWith('+')) v = v.slice(1);
  if (v.startsWith('0')) v = `27${v.slice(1)}`;
  const digitsOnly = v.replace(/[^\d]/g, '');
  if (digitsOnly.startsWith('27') && digitsOnly.length === 11) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 9 && /^[678]/.test(digitsOnly)) {
    return `+27${digitsOnly}`;
  }
  return '';
}

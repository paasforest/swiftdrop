/**
 * Mirrors backend `utils/pricing.js` — sender-facing estimate in the app.
 * R45 + R7/km + size surcharge, round to nearest R5.
 */
const BASE_ZAR = 45;
const PER_KM_ZAR = 7;

const SIZE_SURCHARGE = {
  Small: 0,
  Medium: 10,
  Large: 20,
};

function normalizeParcelSize(size) {
  const s = String(size || 'Small').trim();
  return SIZE_SURCHARGE[s] !== undefined ? s : 'Small';
}

export function customerFareZar(tripKm, parcelSize) {
  const km = Math.max(0, Number(tripKm) || 0);
  const sur = SIZE_SURCHARGE[normalizeParcelSize(parcelSize)];
  const raw = BASE_ZAR + PER_KM_ZAR * km + sur;
  return Math.round(raw / 5) * 5;
}

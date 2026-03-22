/**
 * Customer-facing driver trust line (rating + completed deliveries).
 */

export function formatDriverRatingForCustomer(rating) {
  const n = Number(rating);
  if (!Number.isFinite(n) || n <= 0) return 'New';
  return n.toFixed(1);
}

export function normalizeDriverDeliveriesCompleted(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** e.g. "⭐ 4.8 · 127 deliveries" */
export function driverTrustSubtitle(rating, deliveriesRaw) {
  const r = formatDriverRatingForCustomer(rating);
  const d = normalizeDriverDeliveriesCompleted(deliveriesRaw);
  return `⭐ ${r} · ${d} deliveries`;
}

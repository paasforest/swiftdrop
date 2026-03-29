/**
 * Market-aligned pricing (research: vs Uber Connect, premium OTP + photo proof).
 * Customer: R45 base + R7/km + size surcharge, rounded to nearest R5.
 * Driver: 80% of customer fare (platform 20%) — attracts drivers vs ~25–30% take elsewhere.
 */

const BASE_ZAR = 45;
const PER_KM_ZAR = 7;
const DRIVER_SHARE = 0.8;

const SIZE_SURCHARGE = {
  Small: 0,
  Medium: 10,
  Large: 20,
};

function normalizeParcelSize(size) {
  const s = String(size || 'Small').trim();
  return SIZE_SURCHARGE[s] !== undefined ? s : 'Small';
}

function roundToNearest5(n) {
  return Math.round(Number(n) / 5) * 5;
}

function customerFareZar(tripKm, parcelSize) {
  const km = Math.max(0, Number(tripKm) || 0);
  const sur = SIZE_SURCHARGE[normalizeParcelSize(parcelSize)];
  const raw = BASE_ZAR + PER_KM_ZAR * km + sur;
  return roundToNearest5(raw);
}

function driverPayoutFromCustomerFare(customerFare) {
  return Math.round(Number(customerFare) * DRIVER_SHARE);
}

/** @returns {{ customerFare: number, driverPayout: number, platformFee: number }} */
function tripFareBreakdown(tripKm, parcelSize) {
  const customerFare = customerFareZar(tripKm, parcelSize);
  const driverPayout = driverPayoutFromCustomerFare(customerFare);
  const platformFee = customerFare - driverPayout;
  return { customerFare, driverPayout, platformFee };
}

module.exports = {
  BASE_ZAR,
  PER_KM_ZAR,
  DRIVER_SHARE,
  SIZE_SURCHARGE,
  normalizeParcelSize,
  roundToNearest5,
  customerFareZar,
  driverPayoutFromCustomerFare,
  tripFareBreakdown,
};

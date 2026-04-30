const db = require('../database/connection');

const SLOTS_PER_SIZE = { small: 1, medium: 2, large: 3 };

function getSlotsForParcel(parcelSize) {
  const key = String(parcelSize || '').toLowerCase();
  return SLOTS_PER_SIZE[key] || 1;
}

async function getSlotsUsed(driverRouteId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(
       CASE LOWER(parcel_size)
         WHEN 'small'  THEN 1
         WHEN 'medium' THEN 2
         WHEN 'large'  THEN 3
         ELSE 1
       END
     ), 0)::int AS used
     FROM orders
     WHERE assigned_driver_route_id = $1
       AND status NOT IN ('cancelled', 'unmatched')`,
    [driverRouteId]
  );
  return rows[0]?.used ?? 0;
}

async function hasAvailableSlots(driverRouteId, maxParcels, parcelSize) {
  const used = await getSlotsUsed(driverRouteId);
  const need = getSlotsForParcel(parcelSize);
  const capacity = Number(maxParcels) || 0;
  return (used + need) <= capacity;
}

async function getSlotsRemaining(driverRouteId, maxParcels) {
  const used = await getSlotsUsed(driverRouteId);
  const capacity = Number(maxParcels) || 0;
  return Math.max(0, capacity - used);
}

module.exports = {
  SLOTS_PER_SIZE,
  getSlotsForParcel,
  getSlotsUsed,
  hasAvailableSlots,
  getSlotsRemaining,
};

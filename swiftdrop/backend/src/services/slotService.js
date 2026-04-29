const db = require('../database/connection');

const SLOTS_PER_SIZE = {
  small: 1,
  medium: 2,
  large: 3,
};

function getSlotsForParcel(parcelSize) {
  return SLOTS_PER_SIZE[parcelSize?.toLowerCase()] || 1;
}

async function getSlotsUsed(driverRouteId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(
        CASE
          WHEN parcel_size = 'small' THEN 1
          WHEN parcel_size = 'medium' THEN 2
          WHEN parcel_size = 'large' THEN 3
          ELSE 1
        END
      ), 0) AS slots_used
     FROM orders
     WHERE assigned_driver_route_id = $1
       AND status NOT IN ('cancelled', 'delivered', 'completed')`,
    [driverRouteId]
  );
  return Number(rows[0].slots_used);
}

async function hasAvailableSlots(driverRouteId, maxParcels, parcelSize) {
  const slotsUsed = await getSlotsUsed(driverRouteId);
  const slotsNeeded = getSlotsForParcel(parcelSize);
  return slotsUsed + slotsNeeded <= maxParcels;
}

async function getSlotsRemaining(driverRouteId, maxParcels) {
  const slotsUsed = await getSlotsUsed(driverRouteId);
  return maxParcels - slotsUsed;
}

module.exports = {
  getSlotsForParcel,
  getSlotsUsed,
  hasAvailableSlots,
  getSlotsRemaining,
  SLOTS_PER_SIZE,
};

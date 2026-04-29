const db = require('../database/connection');
const { getSlotsRemaining } = require('../services/slotService');

async function searchTrips(req, res) {
  try {
    const { from_city, to_city, date } = req.query;

    if (!from_city || !to_city) {
      return res.status(400).json({ error: 'from_city and to_city are required' });
    }

    const { rows } = await db.query(
      `SELECT
          dr.id,
          dr.from_address,
          dr.to_address,
          dr.from_lat,
          dr.from_lng,
          dr.to_lat,
          dr.to_lng,
          dr.departure_time,
          dr.max_parcels,
          dr.boot_space,
          dr.pickup_method,
          dr.meeting_point_address,
          dr.trip_type,
          dr.province,
          u.full_name  AS driver_name,
          u.profile_photo_url AS driver_photo,
          u.id         AS driver_id,
          COALESCE(dt.current_rating, 0) AS driver_rating,
          (SELECT COUNT(*)
           FROM orders o
           WHERE o.assigned_driver_route_id = dr.id
             AND o.status NOT IN ('cancelled', 'delivered', 'completed')
          ) AS booked_count,
          (SELECT COALESCE(SUM(
              CASE
                WHEN o.parcel_size = 'small'  THEN 1
                WHEN o.parcel_size = 'medium' THEN 2
                WHEN o.parcel_size = 'large'  THEN 3
                ELSE 1
              END
           ), 0)
           FROM orders o
           WHERE o.assigned_driver_route_id = dr.id
             AND o.status NOT IN ('cancelled', 'delivered', 'completed')
          ) AS slots_used
       FROM driver_routes dr
       JOIN users u ON u.id = dr.driver_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = dr.driver_id
       WHERE dr.status = 'active'
         AND dr.from_address ILIKE $1
         AND dr.to_address   ILIKE $2
         AND DATE(dr.departure_time AT TIME ZONE 'Africa/Johannesburg') >= CURRENT_DATE
         AND (
           $3::date IS NULL OR
           DATE(dr.departure_time AT TIME ZONE 'Africa/Johannesburg') = $3::date
         )
       ORDER BY dr.departure_time ASC`,
      [`%${from_city}%`, `%${to_city}%`, date || null]
    );

    const trips = rows.map((trip) => ({
      ...trip,
      slots_remaining: trip.max_parcels - Number(trip.slots_used),
      is_full: Number(trip.slots_used) >= trip.max_parcels,
    }));

    const available = trips.filter((t) => !t.is_full);

    return res.json({ trips: available, total: available.length });
  } catch (err) {
    console.error('searchTrips:', err);
    return res.status(500).json({ error: 'Trip search failed' });
  }
}

module.exports = { searchTrips };

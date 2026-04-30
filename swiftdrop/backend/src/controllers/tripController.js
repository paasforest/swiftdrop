const db = require('../database/connection');
const { getSlotsRemaining } = require('../services/slotService');

/**
 * GET /api/trips/search?from_city=&to_city=&date=YYYY-MM-DD
 * Returns active intercity driver_routes with at least one parcel slot remaining.
 */
async function searchTrips(req, res) {
  try {
    const fromCity = String(req.query.from_city || '').trim();
    const toCity   = String(req.query.to_city   || '').trim();
    const date     = req.query.date ? String(req.query.date).trim() : null;

    if (!fromCity || !toCity) {
      return res.status(400).json({ error: 'from_city and to_city are required' });
    }

    const params = [`%${fromCity}%`, `%${toCity}%`];
    let dateClause = '';
    if (date) {
      params.push(date);
      dateClause = ` AND dr.departure_time::date = $${params.length}::date`;
    }

    const { rows } = await db.query(
      `SELECT
         dr.id,
         dr.driver_id,
         dr.from_address,
         dr.from_lat,
         dr.from_lng,
         dr.to_address,
         dr.to_lat,
         dr.to_lng,
         dr.departure_time,
         dr.max_parcels,
         dr.boot_space,
         dr.trip_type,
         dr.pickup_method,
         dr.meeting_point_address,
         dr.meeting_point_lat,
         dr.meeting_point_lng,
         dr.delivery_radius_km,
         u.full_name  AS driver_name,
         dt.current_rating AS driver_rating
       FROM driver_routes dr
       JOIN users u ON u.id = dr.driver_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = dr.driver_id
       WHERE dr.status = 'active'
         AND dr.trip_type = 'intercity'
         AND dr.departure_time > NOW()
         AND dr.from_address ILIKE $1
         AND dr.to_address   ILIKE $2
         ${dateClause}
       ORDER BY dr.departure_time ASC
       LIMIT 50`,
      params
    );

    const trips = await Promise.all(
      rows.map(async (r) => {
        const remaining = await getSlotsRemaining(r.id, r.max_parcels);
        return { ...r, slots_remaining: remaining };
      })
    );

    const available = trips.filter((t) => t.slots_remaining > 0);
    return res.json({ trips: available });
  } catch (err) {
    console.error('searchTrips:', err);
    return res.status(500).json({ error: 'Failed to load trips' });
  }
}

module.exports = { searchTrips };

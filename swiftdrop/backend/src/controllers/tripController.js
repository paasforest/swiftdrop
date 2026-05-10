const db = require('../database/connection');
const { getSlotsRemaining } = require('../services/slotService');

const SEARCH_RADIUS_KM = 50;

function haversineKmExpr(latParam, lngParam, routeLatCol, routeLngCol) {
  return `
    6371 * acos(
      LEAST(1.0::double precision, GREATEST(-1.0::double precision,
        cos(radians($${latParam}::double precision))
        * cos(radians(${routeLatCol}::double precision))
        * cos(radians(${routeLngCol}::double precision) - radians($${lngParam}::double precision))
        + sin(radians($${latParam}::double precision))
        * sin(radians(${routeLatCol}::double precision))
      ))
    )`;
}

/**
 * GET /api/trips/search?from_city=&to_city=&from_lat=&from_lng=&to_lat=&to_lng=&date=YYYY-MM-DD
 * When lat/lng pairs are provided (finite numbers), matches routes within SEARCH_RADIUS_KM
 * of those points OR by ILIKE on city/address. Otherwise ILIKE only.
 * Returns active intercity driver_routes with at least one parcel slot remaining.
 */
async function searchTrips(req, res) {
  try {
    const fromCity = String(req.query.from_city || '').trim();
    const toCity = String(req.query.to_city || '').trim();
    const date = req.query.date ? String(req.query.date).trim() : null;

    const fromLat = req.query.from_lat != null ? Number(req.query.from_lat) : null;
    const fromLng = req.query.from_lng != null ? Number(req.query.from_lng) : null;
    const toLat = req.query.to_lat != null ? Number(req.query.to_lat) : null;
    const toLng = req.query.to_lng != null ? Number(req.query.to_lng) : null;

    if (!fromCity || !toCity) {
      return res.status(400).json({ error: 'from_city and to_city are required' });
    }

    const hasFromCoords =
      fromLat != null &&
      fromLng != null &&
      Number.isFinite(fromLat) &&
      Number.isFinite(fromLng);
    const hasToCoords =
      toLat != null &&
      toLng != null &&
      Number.isFinite(toLat) &&
      Number.isFinite(toLng);

    const params = [];
    let fromClause;
    if (hasFromCoords) {
      const iLat = params.length + 1;
      const iLng = params.length + 2;
      const iRad = params.length + 3;
      const iPat = params.length + 4;
      params.push(fromLat, fromLng, SEARCH_RADIUS_KM, `%${fromCity}%`);
      const dist = haversineKmExpr(iLat, iLng, 'dr.from_lat', 'dr.from_lng');
      fromClause = `(
        dr.from_city ILIKE $${iPat}
        OR dr.from_address ILIKE $${iPat}
        OR (
          dr.from_lat IS NOT NULL
          AND dr.from_lng IS NOT NULL
          AND (${dist}) <= $${iRad}::double precision
        )
      )`;
    } else {
      const iPat = params.length + 1;
      params.push(`%${fromCity}%`);
      fromClause = `(dr.from_city ILIKE $${iPat} OR dr.from_address ILIKE $${iPat})`;
    }

    let toClause;
    if (hasToCoords) {
      const iLat = params.length + 1;
      const iLng = params.length + 2;
      const iRad = params.length + 3;
      const iPat = params.length + 4;
      params.push(toLat, toLng, SEARCH_RADIUS_KM, `%${toCity}%`);
      const dist = haversineKmExpr(iLat, iLng, 'dr.to_lat', 'dr.to_lng');
      toClause = `(
        dr.to_city ILIKE $${iPat}
        OR dr.to_address ILIKE $${iPat}
        OR (
          dr.to_lat IS NOT NULL
          AND dr.to_lng IS NOT NULL
          AND (${dist}) <= $${iRad}::double precision
        )
      )`;
    } else {
      const iPat = params.length + 1;
      params.push(`%${toCity}%`);
      toClause = `(dr.to_city ILIKE $${iPat} OR dr.to_address ILIKE $${iPat})`;
    }

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
         dr.from_city,
         dr.to_address,
         dr.to_lat,
         dr.to_lng,
         dr.to_city,
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
         AND ${fromClause}
         AND ${toClause}
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

const polylineLib = require('@mapbox/polyline');
const db = require('../database/connection');
const { getProvinceConfig } = require('./provinceService');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minDistToPolyline(lat, lng, points) {
  let minDist = Infinity;
  let minIdx = 0;
  points.forEach(([pLat, pLng], i) => {
    const d = haversineKm(lat, lng, pLat, pLng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  });
  return { dist: minDist, idx: minIdx };
}

function commuterScore(order, route, thresholdKm) {
  if (!route.route_polyline) return null;
  const pts = polylineLib.decode(route.route_polyline);
  const pu = minDistToPolyline(order.pickup_lat, order.pickup_lng, pts);
  const do_ = minDistToPolyline(order.dropoff_lat, order.dropoff_lng, pts);
  if (pu.dist > thresholdKm || do_.dist > thresholdKm) return null;
  if (pu.idx >= do_.idx) return null;
  return pu.dist + do_.dist;
}

function dedicatedScore(order, driverLat, driverLng, radiusKm) {
  const d = haversineKm(driverLat, driverLng, order.pickup_lat, order.pickup_lng);
  return d > radiusKm ? null : d;
}

async function findMatchingDrivers(order) {
  const config = getProvinceConfig(order.province);
  if (!config) return [];

  const { rows: candidates } = await db.query(
    `SELECT dr.*, u.full_name, u.phone, u.profile_photo_url,
            u.id as driver_user_id, u.current_lat, u.current_lng,
            COALESCE(dt.current_rating, 0.0) AS rating
     FROM driver_routes dr
     JOIN users u ON u.id = dr.driver_id
     LEFT JOIN driver_tiers dt ON dt.driver_id = dr.driver_id
     WHERE dr.status = 'active'
       AND dr.province = $1
       AND dr.departure_time BETWEEN
           (NOW() - INTERVAL '30 minutes') AND
           (NOW() + INTERVAL '2 hours')
       AND dr.max_parcels > (
         SELECT COUNT(*) FROM orders o2
         WHERE o2.assigned_driver_route_id = dr.id
           AND o2.status NOT IN ('cancelled','delivered','completed')
       )
       AND (
         ($2 = 'small') OR
         ($2 = 'medium' AND dr.boot_space IN ('medium','large')) OR
         ($2 = 'large' AND dr.boot_space = 'large')
       )`,
    [order.province, order.parcel_size]
  );

  const matches = [];
  for (const route of candidates) {
    let score = null;
    if (route.driver_type === 'commuter') {
      score = commuterScore(order, route, config.corridorThresholdKm);
    } else if (route.driver_type === 'dedicated') {
      score = dedicatedScore(
        order,
        route.current_lat,
        route.current_lng,
        config.dedicatedRadiusKm
      );
    }
    if (score !== null) {
      matches.push({ ...route, matchScore: score });
    }
  }

  matches.sort((a, b) => {
    if (Math.abs(a.matchScore - b.matchScore) < 0.5) {
      return (b.rating || 0) - (a.rating || 0);
    }
    return a.matchScore - b.matchScore;
  });
  return matches;
}

module.exports = { findMatchingDrivers };

const axios = require('axios');

async function fetchRoutePolyline(fromLat, fromLng, toLat, toLng) {
  try {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: `${fromLat},${fromLng}`,
          destination: `${toLat},${toLng}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );
    return data.routes?.[0]?.overview_polyline?.points || null;
  } catch (err) {
    console.error('[Directions]', err.message);
    return null;
  }
}

module.exports = { fetchRoutePolyline };

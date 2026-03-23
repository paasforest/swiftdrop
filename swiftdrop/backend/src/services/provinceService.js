const PROVINCES = {
  western_cape: {
    corridorThresholdKm: 5,
    dedicatedRadiusKm: 10,
    bounds: { minLat: -34.9, maxLat: -31.5, minLng: 18.0, maxLng: 21.5 },
  },
  gauteng: {
    corridorThresholdKm: 3,
    dedicatedRadiusKm: 8,
    bounds: { minLat: -26.7, maxLat: -25.2, minLng: 27.5, maxLng: 28.8 },
  },
};

function detectProvince(lat, lng) {
  for (const [key, p] of Object.entries(PROVINCES)) {
    const b = p.bounds;
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return key;
    }
  }
  return null;
}

function getProvinceConfig(key) {
  return PROVINCES[key] || null;
}

module.exports = { detectProvince, getProvinceConfig };

const SERVICE_AREAS = [
  {
    key: 'western_cape',
    name: 'Western Cape',
    bounds: {
      minLat: -34.9,
      maxLat: -31.5,
      minLng: 18.0,
      maxLng: 21.5,
    },
  },
  {
    key: 'gauteng',
    name: 'Gauteng',
    bounds: {
      minLat: -26.7,
      maxLat: -25.2,
      minLng: 27.5,
      maxLng: 28.8,
    },
  },
];

/** Legacy corridor config (Phase 2 / admin tools). Bounds match SERVICE_AREAS. */
const PROVINCES = {
  western_cape: {
    corridorThresholdKm: 5,
    dedicatedRadiusKm: 10,
    bounds: SERVICE_AREAS[0].bounds,
  },
  gauteng: {
    corridorThresholdKm: 3,
    dedicatedRadiusKm: 8,
    bounds: SERVICE_AREAS[1].bounds,
  },
};

function detectProvince(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  for (const area of SERVICE_AREAS) {
    const b = area.bounds;
    if (la >= b.minLat && la <= b.maxLat && ln >= b.minLng && ln <= b.maxLng) {
      return area.key;
    }
  }
  return null;
}

function getProvinceConfig(key) {
  return PROVINCES[key] || null;
}

module.exports = { detectProvince, getProvinceConfig, SERVICE_AREAS };

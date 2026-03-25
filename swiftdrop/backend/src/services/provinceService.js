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

module.exports = { detectProvince, SERVICE_AREAS };

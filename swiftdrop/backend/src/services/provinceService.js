const SERVICE_AREAS = [
  {
    key: 'western_cape',
    name: 'Western Cape',
    bounds: {
      minLat: -34.95,
      maxLat: -31.5,
      // West coast (e.g. Saldanha ~17.95°E) must be included; 18.0 was too tight.
      minLng: 17.5,
      maxLng: 21.5,
    },
  },
  {
    key: 'gauteng',
    name: 'Gauteng',
    bounds: {
      minLat: -26.75,
      maxLat: -25.2,
      // Western Rand and eastern Ekurhuleni sit outside the old 27.5–28.8 box.
      minLng: 27.25,
      maxLng: 29.05,
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

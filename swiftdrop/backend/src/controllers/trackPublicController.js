const db = require('../database/connection');
const { getRealtimeDb } = require('../services/firebaseAdmin');

const TOKEN_RE = /^[a-f0-9]{32,64}$/;

/** Strip whitespace, zero-width chars, decode URI — paste from SQL often breaks the hex string. */
function normalizeTrackToken(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  s = s.replace(/[\s\u200b-\u200d\ufeff]/g, '').toLowerCase();
  return s;
}

function shortenAddress(s) {
  if (!s) return '';
  const t = String(s).trim();
  return t.length <= 52 ? t : `${t.slice(0, 49)}…`;
}

function statusLabel(status) {
  const m = {
    searching: 'Finding a driver',
    active: 'Driver assigned',
    otp_pickup: 'Pickup in progress',
    in_transit: 'On the way',
    otp_dropoff: 'Arriving soon',
    delivering: 'Out for delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    no_drivers: 'No driver available',
  };
  return m[status] || status || 'Unknown';
}

/**
 * GET /api/public/track/:token — JSON for map page (no auth).
 */
async function getPublicTrackJson(req, res) {
  const token = normalizeTrackToken(req.params.token);
  if (!TOKEN_RE.test(token)) {
    return res.status(400).json({
      error: 'Invalid link',
      hint:
        'Use the full tracking token (40-character hex from the app or public_track_token column), not the booking id.',
    });
  }

  let row;
  try {
    const r = await db.query(
      `SELECT id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
              pickup_address, dropoff_address
       FROM bookings
       WHERE LOWER(public_track_token) = $1`,
      [token]
    );
    if (!r.rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    row = r.rows[0];
  } catch (e) {
    console.error('[publicTrack] DB error:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }

  let liveStatus = row.status;
  let driverLocation = null;

  const rtdb = getRealtimeDb();
  if (rtdb) {
    try {
      const stSnap = await rtdb.ref(`bookings/${row.id}/status`).once('value');
      const stVal = stSnap.val();
      if (typeof stVal === 'string' && stVal) {
        liveStatus = stVal;
      }
    } catch {
      /* ignore */
    }
    try {
      const locSnap = await rtdb.ref(`active_deliveries/${row.id}/driver_location`).once('value');
      const v = locSnap.val();
      if (v && Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude))) {
        driverLocation = {
          lat: Number(v.latitude),
          lng: Number(v.longitude),
          updatedAt: v.timestamp != null ? Number(v.timestamp) : null,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return res.json({
    status: liveStatus,
    statusLabel: statusLabel(liveStatus),
    pickup: {
      lat: row.pickup_lat != null ? Number(row.pickup_lat) : null,
      lng: row.pickup_lng != null ? Number(row.pickup_lng) : null,
      label: shortenAddress(row.pickup_address),
    },
    dropoff: {
      lat: row.dropoff_lat != null ? Number(row.dropoff_lat) : null,
      lng: row.dropoff_lng != null ? Number(row.dropoff_lng) : null,
      label: shortenAddress(row.dropoff_address),
    },
    driver: driverLocation,
  });
}

/**
 * GET /track/:token — minimal Leaflet map (no app required).
 */
function invalidTrackHtml(looksLikeBookingId) {
  const extra = looksLikeBookingId
    ? '<p>You may have used the <strong>booking number</strong> (e.g. 2841). Open the <strong>full URL</strong> from the app — tap <strong>Share live tracking link</strong> — or paste the whole <code>public_track_token</code> value (40 letters and numbers), not the <code>id</code>.</p>'
    : '<p>Copy the token with no spaces or line breaks, or open the link from the SwiftDrop app.</p>';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Invalid link</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:520px;margin:0 auto;line-height:1.5;color:#0A0A0F}a{color:#2563eb}</style></head><body>
<h1>Invalid tracking link</h1>
${extra}
<p><a href="/">SwiftDrop API</a></p></body></html>`;
}

function serveTrackPage(req, res) {
  const token = normalizeTrackToken(req.params.token);
  const looksLikeBookingId = /^\d{1,12}$/.test(token);
  if (!TOKEN_RE.test(token)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(invalidTrackHtml(looksLikeBookingId));
  }

  const apiBase =
    process.env.PUBLIC_TRACK_BASE_URL ||
    `${req.protocol}://${req.get('host') || 'localhost'}`;

  const safeToken = JSON.stringify(token.toLowerCase());
  const safeApi = JSON.stringify(apiBase.replace(/\/$/, ''));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
  <title>SwiftDrop — Track delivery</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    .top {
      background: #0A0A0F;
      color: #fff;
      padding: 14px 16px;
      font-size: 15px;
    }
    .top strong { color: #E8FF00; }
    #map { height: calc(100vh - 56px); width: 100%; }
    .hint { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 4px; }
  </style>
</head>
<body>
  <div class="top">
    <div><strong>SwiftDrop</strong> · <span id="lbl">Loading…</span></div>
    <div class="hint" id="sub"></div>
  </div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
(function () {
  var TOKEN = ${safeToken};
  var API = ${safeApi};
  var map = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var markers = { pickup: null, dropoff: null, driver: null };
  function setMarker(key, lat, lng, label, color) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (markers[key]) { map.removeLayer(markers[key]); }
    markers[key] = L.circleMarker([lat, lng], {
      radius: key === 'driver' ? 10 : 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    }).addTo(map).bindPopup(label);
  }
  function fitAll() {
    var layers = [];
    if (markers.pickup) layers.push(markers.pickup);
    if (markers.dropoff) layers.push(markers.dropoff);
    if (markers.driver) layers.push(markers.driver);
    if (layers.length) {
      var g = L.featureGroup(layers);
      map.fitBounds(g.getBounds().pad(0.2));
    } else {
      map.setView([-26.2, 28.0], 11);
    }
  }
  async function poll() {
    try {
      var res = await fetch(API + '/api/public/track/' + TOKEN);
      var data = await res.json();
      if (!res.ok) {
        document.getElementById('lbl').textContent = data.error || 'Unavailable';
        return;
      }
      document.getElementById('lbl').textContent = data.statusLabel || data.status || 'Update';
      var sub = [];
      if (data.pickup && data.pickup.label) sub.push('From: ' + data.pickup.label);
      if (data.dropoff && data.dropoff.label) sub.push('To: ' + data.dropoff.label);
      document.getElementById('sub').textContent = sub.join(' · ');
      setMarker('pickup', data.pickup && data.pickup.lat, data.pickup && data.pickup.lng, 'Pickup', '#4ADE80');
      setMarker('dropoff', data.dropoff && data.dropoff.lat, data.dropoff && data.dropoff.lng, 'Drop-off', '#E8FF00');
      if (data.driver) {
        setMarker('driver', data.driver.lat, data.driver.lng, 'Driver', '#3B82F6');
      } else if (markers.driver) {
        map.removeLayer(markers.driver);
        markers.driver = null;
      }
      fitAll();
    } catch (e) {
      document.getElementById('lbl').textContent = 'Could not load tracking';
    }
  }
  poll();
  setInterval(poll, 8000);
})();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  return res.send(html);
}

module.exports = { getPublicTrackJson, serveTrackPage };

import { METERS_PER_UNIT } from './seoulGeo.js';

// Overpass mirrors — rotated across retries to dodge a single server's rate limit.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const METERS_PER_FLOOR = 3.2;   // average storey height
const VERT_EXAG        = 10;    // strong artistic exaggeration so buildings tower like a toy city
const MAX_HEIGHT_M     = 260;   // clamp absurd/erroneous values (Lotte Tower ≈ 555 m → capped)

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch all building polygons within a geo bbox.
// Retries with backoff + endpoint rotation so a transient 429/timeout doesn't
// leave the chunk permanently empty.
// Returns [{coords:[{lat,lon}], height, type}]
export async function fetchBuildingsForChunk(bbox, attempt = 0) {
  const { S, N, W, E } = bbox;
  const bstr = `${S.toFixed(6)},${W.toFixed(6)},${N.toFixed(6)},${E.toFixed(6)}`;

  const query = `[out:json][timeout:30][bbox:${bstr}];way[building];out body;>;out skel qt;`;
  const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
  } catch (err) {
    if (attempt < 4) { await sleep(700 * (attempt + 1)); return fetchBuildingsForChunk(bbox, attempt + 1); }
    throw err;
  }
  // 429 (rate limited) / 504 / 503 are transient — back off and retry.
  if ([429, 502, 503, 504].includes(res.status)) {
    if (attempt < 4) { await sleep(900 * (attempt + 1)); return fetchBuildingsForChunk(bbox, attempt + 1); }
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const nodeMap = new Map();
  for (const el of json.elements) {
    if (el.type === 'node') nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
  }

  const buildings = [];
  for (const el of json.elements) {
    if (el.type !== 'way' || !el.tags?.building) continue;
    if (!el.nodes || el.nodes.length < 4) continue;

    const coords = el.nodes.slice(0, -1).map(id => nodeMap.get(id)).filter(Boolean);
    if (coords.length < 3) continue;

    // Only render buildings whose centroid is inside this chunk (avoids duplicates at borders)
    const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
    if (lat < S || lat > N || lon < W || lon > E) continue;

    const meters = buildingHeightMeters(el.tags);
    // Convert real meters → world units at the same scale as the footprint,
    // with a mild exaggeration so towers still feel tall but never needle-like.
    const height = (meters / METERS_PER_UNIT) * VERT_EXAG;

    buildings.push({ coords, height, type: buildingType(el.tags.building) });
  }

  return buildings;
}

// Resolve a building's real-world height in meters from OSM tags.
// Priority: explicit height tag → building:levels → per-type default.
function buildingHeightMeters(tags) {
  const h = parseFloat(tags.height); // OSM "height" is in metres
  if (!isNaN(h) && h > 0) return Math.min(h, MAX_HEIGHT_M);

  let levels = parseInt(tags['building:levels'], 10);
  if (isNaN(levels) || levels <= 0) levels = defaultLevels(tags.building);
  levels = Math.min(levels, 80);
  return Math.min(levels * METERS_PER_FLOOR, MAX_HEIGHT_M);
}

function defaultLevels(b) {
  switch (b) {
    case 'house': case 'detached': case 'semidetached_house': return 2;
    case 'apartments': case 'residential': case 'dormitory':  return 5;
    case 'commercial': case 'retail': case 'supermarket':     return 4;
    case 'office': case 'government': case 'civic':           return 8;
    case 'industrial': case 'warehouse': case 'storage_tank': return 2;
    case 'school': case 'university': case 'hospital':        return 4;
    default: return 3;
  }
}

function buildingType(b) {
  if (['house', 'detached', 'semidetached_house', 'apartments', 'residential', 'dormitory'].includes(b)) return 'res';
  if (['commercial', 'retail', 'supermarket', 'shop', 'kiosk', 'hotel'].includes(b)) return 'com';
  if (['office'].includes(b)) return 'off';
  if (['school', 'university', 'college', 'kindergarten', 'hospital', 'government', 'civic', 'public', 'church', 'temple', 'cathedral'].includes(b)) return 'civic';
  if (['industrial', 'warehouse', 'factory', 'manufacture', 'storage_tank', 'hangar'].includes(b)) return 'ind';
  return 'default';
}

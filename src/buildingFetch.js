import { METERS_PER_UNIT } from './seoulGeo.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const METERS_PER_FLOOR = 3.2;
const VERT_EXAG        = 10;
const MAX_HEIGHT_M     = 260;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Seeded pseudo-random ───────────────────────────────────────────────────
function seededRand(seed) {
  const v = Math.sin(seed * 91.17) * 43758.5453;
  return v - Math.floor(v);
}

// ── Procedural building generator ─────────────────────────────────────────
// Generates a realistic-looking urban block from geographic coordinates alone.
// Used when Overpass is unreachable so buildings always appear on zoom.
function generateProceduralBuildings(bbox) {
  const { S, N, W, E } = bbox;
  const cLat = (S + N) / 2;
  const cLon = (W + E) / 2;

  // Proximity to Seoul's CBD (City Hall area)
  const dLat = cLat - 37.5663;
  const dLon = cLon - 126.9779;
  const dCenter = Math.sqrt(dLat * dLat + dLon * dLon);

  const inGangnam = cLat > 37.490 && cLat < 37.535 && cLon > 127.010 && cLon < 127.105;
  const inYeouido = cLat > 37.515 && cLat < 37.535 && cLon > 126.910 && cLon < 126.945;
  const inCBD     = dCenter < 0.035;
  const highrise  = inGangnam || inYeouido || inCBD;
  const midrise   = dCenter < 0.080;

  const GRID = 6;
  const latStep = (N - S) / GRID;
  const lonStep = (E - W) / GRID;
  const chunkSeed = (Math.floor(W * 100000 + S * 10000)) & 0x7fffffff;
  const buildings = [];

  for (let gi = 0; gi < GRID; gi++) {
    for (let gj = 0; gj < GRID; gj++) {
      const s  = chunkSeed + gi * 97 + gj * 13;
      const r0 = seededRand(s);
      const r1 = seededRand(s + 1);
      const r2 = seededRand(s + 2);
      const r3 = seededRand(s + 3);
      const r4 = seededRand(s + 4);

      // Leave ~20-30% of cells as streets/open space
      if (r0 < (highrise ? 0.18 : 0.28)) continue;

      const pad = 0.08 + r1 * 0.05;
      const bS = S + gi * latStep + latStep * pad;
      const bN = bS + latStep * (0.55 + r2 * 0.30);
      const bW = W + gj * lonStep + lonStep * pad;
      const bE = bW + lonStep * (0.55 + r3 * 0.30);
      if (bN <= bS || bE <= bW) continue;

      let heightM;
      if (highrise)    heightM = 30 + r4 * 200;
      else if (midrise) heightM = 10 + r4 * 60;
      else             heightM =  5 + r4 * 25;
      heightM = Math.min(heightM, MAX_HEIGHT_M);

      let type;
      if (highrise)    type = r4 > 0.55 ? 'off' : (r4 > 0.25 ? 'com' : 'res');
      else if (midrise) type = r4 > 0.65 ? 'off' : (r4 > 0.40 ? 'com' : 'res');
      else             type = r4 > 0.15 ? 'res' : 'com';

      const coords = [
        { lat: bS, lon: bW },
        { lat: bS, lon: bE },
        { lat: bN, lon: bE },
        { lat: bN, lon: bW },
      ];
      const height = (heightM / METERS_PER_UNIT) * VERT_EXAG;
      buildings.push({ coords, height, type });
    }
  }
  return buildings;
}

// ── Overpass fetch with instant procedural fallback ────────────────────────
// Returns [{coords:[{lat,lon}], height, type}].
// Network errors fall through immediately to procedural (no retry delay) so
// buildings always appear even when Overpass is blocked or rate-limited.
export async function fetchBuildingsForChunk(bbox, attempt = 0) {
  const { S, N, W, E } = bbox;
  const bstr  = `${S.toFixed(6)},${W.toFixed(6)},${N.toFixed(6)},${E.toFixed(6)}`;
  const query  = `[out:json][timeout:25][bbox:${bstr}];way[building];out body;>;out skel qt;`;
  const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
  } catch {
    // Network unreachable → skip retries, return procedural instantly.
    return generateProceduralBuildings(bbox);
  }

  if (res.status === 429) {
    // Rate-limited: back off and retry a few times before giving up.
    if (attempt < 3) { await sleep(900 * (attempt + 1)); return fetchBuildingsForChunk(bbox, attempt + 1); }
    return generateProceduralBuildings(bbox);
  }
  if (!res.ok) return generateProceduralBuildings(bbox);

  let json;
  try { json = await res.json(); } catch { return generateProceduralBuildings(bbox); }

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

    const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
    if (lat < S || lat > N || lon < W || lon > E) continue;

    const meters = buildingHeightMeters(el.tags);
    const height  = (meters / METERS_PER_UNIT) * VERT_EXAG;
    buildings.push({ coords, height, type: buildingType(el.tags.building) });
  }

  // Overpass succeeded but returned very few buildings → fill with procedural.
  return buildings.length >= 4 ? buildings : generateProceduralBuildings(bbox);
}

function buildingHeightMeters(tags) {
  const h = parseFloat(tags.height);
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

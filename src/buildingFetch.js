const ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Fetch all building polygons within a geo bbox.
// Returns [{coords:[{lat,lon}], height, type}]
export async function fetchBuildingsForChunk(bbox) {
  const { S, N, W, E } = bbox;
  const bstr = `${S.toFixed(6)},${W.toFixed(6)},${N.toFixed(6)},${E.toFixed(6)}`;

  const query = `[out:json][timeout:30][bbox:${bstr}];way[building];out body;>;out skel qt;`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
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

    const levels = parseInt(el.tags['building:levels']) || defaultLevels(el.tags.building);
    const height = Math.min(levels, 60) * 0.14;

    buildings.push({ coords, height, type: buildingType(el.tags.building) });
  }

  return buildings;
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
  if (['commercial', 'retail', 'supermarket', 'shop'].includes(b)) return 'com';
  if (['office', 'government', 'civic'].includes(b)) return 'off';
  return 'default';
}

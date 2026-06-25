const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const BBOX_STR = '37.4133,126.7342,37.7151,127.1832';

// Fetch Seoul landuse + water + park polygons from OpenStreetMap Overpass API.
// Returns [{type, coords}] where coords = [{lat, lon}, ...]
// type = 'res' | 'com' | 'off' | 'park' | 'water'
export async function fetchSeoulData(onProgress) {
  const query = `[out:json][timeout:120][bbox:${BBOX_STR}];
(
  way[landuse~"^(residential|commercial|retail|industrial|office|military)$"];
  way[natural=water];
  relation[natural=water];
  way[leisure~"^(park|garden|recreation_ground|nature_reserve)$"];
  way[landuse~"^(park|grass|forest|meadow|farmland|cemetery)$"];
  relation[leisure=park];
);
out body;
>>;
out skel qt;`;

  onProgress(0, 'OpenStreetMap 서버 연결 중…');

  let json;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    onProgress(30, '데이터 다운로드 완료, 파싱 중…');
    json = await res.json();
  } catch (err) {
    throw new Error('Overpass API 연결 실패: ' + err.message);
  }

  onProgress(55, '노드 인덱싱 중…');

  // Index all nodes by ID
  const nodeMap = new Map();
  for (const el of json.elements) {
    if (el.type === 'node') {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  // Index all ways by ID
  const wayMap = new Map();
  for (const el of json.elements) {
    if (el.type === 'way') {
      wayMap.set(el.id, el);
    }
  }

  onProgress(65, '관계(relation) 처리 중…');

  // Propagate relation tags to member ways that have no own tags
  const wayTypeOverride = new Map();
  for (const el of json.elements) {
    if (el.type !== 'relation' || !el.members) continue;
    const type = tagToType(el.tags || {});
    if (!type) continue;
    for (const m of el.members) {
      if (m.type === 'way' && (m.role === 'outer' || m.role === '')) {
        if (!wayTypeOverride.has(m.ref)) wayTypeOverride.set(m.ref, type);
      }
    }
  }

  onProgress(75, '폴리곤 좌표 변환 중…');

  const result = [];
  for (const [id, el] of wayMap) {
    const type = tagToType(el.tags || {}) || wayTypeOverride.get(id);
    if (!type) continue;
    if (!el.nodes || el.nodes.length < 4) continue; // need ≥3 unique pts + close

    const coords = el.nodes.map(nid => nodeMap.get(nid)).filter(Boolean);
    if (coords.length < 3) continue;

    result.push({ type, coords });
  }

  return result;
}

function tagToType(tags) {
  if (tags.natural === 'water') return 'water';
  if (tags.leisure) {
    if (['park', 'garden', 'recreation_ground', 'nature_reserve'].includes(tags.leisure)) return 'park';
  }
  if (tags.landuse) {
    if (tags.landuse === 'residential') return 'res';
    if (['commercial', 'retail'].includes(tags.landuse)) return 'com';
    if (['industrial', 'office', 'military'].includes(tags.landuse)) return 'off';
    if (['park', 'grass', 'forest', 'meadow', 'farmland', 'cemetery'].includes(tags.landuse)) return 'park';
  }
  return null;
}

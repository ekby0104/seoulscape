const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const BBOX_STR = '37.4133,126.7342,37.7151,127.1832';

// ── Seoul landuse / water / green areas ─────────────────────────────────────

export async function fetchSeoulData(onProgress) {
  const query = `[out:json][timeout:120][bbox:${BBOX_STR}];
(
  way[landuse~"^(residential|commercial|retail|industrial|office|military|education|institutional|religious|farmland|cemetery|brownfield|construction)$"];
  way[natural~"^(water|wood|scrub|grassland|heath)$"];
  relation[natural=water];
  way[leisure~"^(park|garden|recreation_ground|nature_reserve|sports_centre|stadium|pitch|golf_course)$"];
  way[landuse~"^(park|grass|forest|meadow|farmland|cemetery|greenfield)$"];
  relation[leisure=park];
  way[amenity~"^(hospital|university|college|school)$"];
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
  const nodeMap = new Map();
  for (const el of json.elements) {
    if (el.type === 'node') nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
  }
  const wayMap = new Map();
  for (const el of json.elements) {
    if (el.type === 'way') wayMap.set(el.id, el);
  }

  onProgress(65, '관계(relation) 처리 중…');
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

  onProgress(75, '폴리곤 변환 중…');
  const result = [];
  for (const [id, el] of wayMap) {
    const type = tagToType(el.tags || {}) || wayTypeOverride.get(id);
    if (!type) continue;
    if (!el.nodes || el.nodes.length < 4) continue;
    const coords = el.nodes.map(nid => nodeMap.get(nid)).filter(Boolean);
    if (coords.length < 3) continue;
    result.push({ type, coords });
  }
  return result;
}

// ── Seoul administrative boundary ───────────────────────────────────────────

export async function fetchSeoulBoundary(onProgress) {
  const query = `[out:json][timeout:90];
relation["name:ko"="서울특별시"][boundary=administrative];
out body;
>>;
out skel qt;`;

  onProgress('서울시 행정 경계 불러오는 중…');
  let json;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    console.warn('경계 로드 실패, 직사각형으로 표시:', err.message);
    return []; // fallback: no mask → show full rectangle
  }

  const nodeMap = new Map();
  for (const el of json.elements) {
    if (el.type === 'node') nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
  }
  const wayData = new Map();
  for (const el of json.elements) {
    if (el.type === 'way' && el.nodes) {
      wayData.set(el.id, { id: el.id, nodes: el.nodes, coords: el.nodes.map(id => nodeMap.get(id)).filter(Boolean) });
    }
  }

  // Collect outer-ring way IDs from the relation
  let outerIds = [];
  for (const el of json.elements) {
    if (el.type === 'relation') {
      outerIds = el.members.filter(m => m.type === 'way' && m.role === 'outer').map(m => m.ref);
      break;
    }
  }

  const outerWays = outerIds.map(id => wayData.get(id)).filter(Boolean);
  return stitchWays(outerWays); // [{lat, lon}, …]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tagToType(tags) {
  if (tags.natural === 'water') return 'water';
  if (tags.natural && ['wood', 'scrub', 'grassland', 'heath'].includes(tags.natural)) return 'park';
  if (tags.leisure && ['park', 'garden', 'recreation_ground', 'nature_reserve', 'sports_centre', 'stadium', 'pitch', 'golf_course'].includes(tags.leisure)) return 'park';
  if (tags.landuse === 'residential') return 'res';
  if (['commercial', 'retail'].includes(tags.landuse)) return 'com';
  if (['industrial', 'office', 'military', 'education', 'institutional', 'religious'].includes(tags.landuse)) return 'off';
  if (['park', 'grass', 'forest', 'meadow', 'farmland', 'cemetery', 'greenfield'].includes(tags.landuse)) return 'park';
  if (['hospital', 'university', 'college', 'school'].includes(tags.amenity)) return 'off';
  return null;
}

// Stitch an unordered set of ways into a single closed coordinate ring.
function stitchWays(ways) {
  if (!ways.length) return [];

  const byFirst = new Map();
  const byLast  = new Map();
  for (const w of ways) {
    if (w.nodes.length < 2) continue;
    byFirst.set(w.nodes[0], w);
    byLast.set(w.nodes[w.nodes.length - 1], w);
  }

  const used = new Set();
  const ring = [];
  let cur = ways[0];

  while (cur && !used.has(cur.id)) {
    used.add(cur.id);
    for (let i = 0; i < cur.coords.length - 1; i++) {
      if (cur.coords[i]) ring.push(cur.coords[i]);
    }
    const endNode = cur.nodes[cur.nodes.length - 1];
    const next = byFirst.get(endNode);
    if (next && !used.has(next.id)) {
      cur = next;
    } else {
      // Try reversed neighbour
      const rev = byLast.get(endNode);
      if (rev && !used.has(rev.id)) {
        cur = { id: rev.id, nodes: [...rev.nodes].reverse(), coords: [...rev.coords].reverse() };
      } else {
        cur = null;
      }
    }
  }

  if (ring.length > 2) ring.push(ring[0]);
  return ring;
}

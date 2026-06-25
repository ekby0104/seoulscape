import './style.css';
import { initScene } from './scene.js';
import { fetchSeoulData, fetchSeoulBoundary } from './overpass.js';
import { buildGrid, buildBoundaryMask, stampRiver } from './gridBuilder.js';
import { renderGrid, renderBoundary, renderLandmarks } from './tileRenderer.js';
import { SEOUL_FALLBACK_RING, HAN_RIVER } from './seoulData.js';
import { BBOX } from './seoulGeo.js';
import { LodManager } from './lod.js';

// A valid Seoul boundary must span most of the bounding box. The Overpass
// stitch sometimes returns a broken ring covering only part of the city —
// reject those and use the hardcoded silhouette instead.
function ringCoversSeoul(ring) {
  if (!ring || ring.length < 8) return false;
  let minLat = 99, maxLat = -99, minLon = 999, maxLon = -999;
  for (const p of ring) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const latSpan = (maxLat - minLat) / (BBOX.N - BBOX.S);
  const lonSpan = (maxLon - minLon) / (BBOX.E - BBOX.W);
  return latSpan > 0.85 && lonSpan > 0.85;
}

const barEl  = document.getElementById('loading-bar');
const stepEl = document.getElementById('loading-step');

function setProgress(pct, label) {
  barEl.style.width = Math.min(100, pct) + '%';
  if (label) stepEl.textContent = label;
}

async function init() {
  setProgress(3, 'Three.js 씬 초기화 중…');
  const { scene, camera, renderer, controls } = initScene();

  setProgress(6, 'OpenStreetMap 연결 중 (경계 + 지도 데이터 병렬 로드)…');

  // Boundary and map data are fetched independently and neither is fatal:
  // if a request fails we still render the fallback Seoul island + river +
  // landmarks so the user always sees a recognizable city.
  // (?demo skips the network for offline/local previews.)
  const demo = location.search.includes('demo');
  let boundaryRing = [], ways = [];
  if (!demo) {
    const [boundaryRes, waysRes] = await Promise.allSettled([
      fetchSeoulBoundary((msg) => { stepEl.textContent = msg; }),
      fetchSeoulData((pct, msg) => setProgress(6 + pct * 0.44, msg)),
    ]);
    boundaryRing = boundaryRes.status === 'fulfilled' ? boundaryRes.value : [];
    ways = waysRes.status === 'fulfilled' ? waysRes.value : [];
    if (waysRes.status === 'rejected') {
      console.warn('지도 데이터 로드 실패, 기본 형태로 표시:', waysRes.reason?.message);
      stepEl.textContent = '지도 데이터 일부 생략 — 기본 서울 형태로 표시합니다…';
    }
  }

  // Boundary fetch can fail or return an incomplete/broken ring → fall back to
  // the hardcoded Seoul silhouette so the city always shows its full shape.
  if (!ringCoversSeoul(boundaryRing)) {
    boundaryRing = SEOUL_FALLBACK_RING;
  }

  setProgress(50, `폴리곤 ${ways.length.toLocaleString()}개 래스터화 중…`);
  const mask = await buildBoundaryMask(boundaryRing);
  const grid = await buildGrid(ways, (p) =>
    setProgress(50 + p * 36, '격자 분석 중…')
  );

  // Always paint the Han River so it's visible for orientation on first load.
  stampRiver(grid, mask, HAN_RIVER);

  // Fill every Seoul cell that has no landuse classification with type 6 (default urban)
  for (let i = 0; i < grid.length; i++) {
    if (mask[i] && grid[i] === 0) grid[i] = 6;
  }

  setProgress(86, '3D 오브젝트 생성 중…');
  renderBoundary(scene, boundaryRing);
  const { meshes, instanceMap } = renderGrid(scene, grid, mask);
  renderLandmarks(scene);

  setProgress(100, '완료 — 줌인하면 실제 건물이 로드됩니다');
  const loadEl = document.getElementById('loading');
  loadEl.style.opacity = '0';
  setTimeout(() => { loadEl.style.display = 'none'; }, 700);

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const lod = new LodManager(scene, meshes, instanceMap);

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const dist = camera.position.distanceTo(controls.target);
    lod.update(dist, controls.target);

    renderer.render(scene, camera);
  })();
}

init();

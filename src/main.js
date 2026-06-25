import './style.css';
import { initScene } from './scene.js';
import { fetchSeoulData, fetchSeoulBoundary } from './overpass.js';
import { buildGrid, buildBoundaryMask } from './gridBuilder.js';
import { renderGrid, renderBoundary } from './tileRenderer.js';
import { LodManager } from './lod.js';

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

  let boundaryRing, ways;
  try {
    [boundaryRing, ways] = await Promise.all([
      fetchSeoulBoundary((msg) => { stepEl.textContent = msg; }),
      fetchSeoulData((pct, msg) => setProgress(6 + pct * 0.44, msg)),
    ]);
  } catch (err) {
    stepEl.textContent = '⚠ ' + err.message + ' — 새로고침 후 다시 시도해 주세요.';
    barEl.style.background = '#f85149';
    return;
  }

  setProgress(50, `폴리곤 ${ways.length.toLocaleString()}개 래스터화 중…`);
  const mask = await buildBoundaryMask(boundaryRing);
  const grid = await buildGrid(ways, (p) =>
    setProgress(50 + p * 36, '격자 분석 중…')
  );

  setProgress(86, '3D 오브젝트 생성 중…');
  renderBoundary(scene, boundaryRing);
  const { meshes, instanceMap } = renderGrid(scene, grid, mask);

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

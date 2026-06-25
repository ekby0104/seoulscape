import './style.css';
import { initScene } from './scene.js';
import { fetchSeoulData } from './overpass.js';
import { buildGrid } from './gridBuilder.js';
import { renderGrid } from './tileRenderer.js';

const barEl  = document.getElementById('loading-bar');
const stepEl = document.getElementById('loading-step');

function setProgress(pct, label) {
  barEl.style.width = pct + '%';
  if (label) stepEl.textContent = label;
}

async function init() {
  setProgress(3, 'Three.js 씬 초기화 중…');
  const { scene, camera, renderer, controls } = initScene();

  setProgress(6, 'OpenStreetMap 연결 중…');

  let ways;
  try {
    ways = await fetchSeoulData((pct, label) =>
      setProgress(6 + pct * 0.46, label)   // 6 → 52 %
    );
  } catch (err) {
    stepEl.textContent = '⚠ ' + err.message + ' — 페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.';
    barEl.style.background = '#f85149';
    return;
  }

  setProgress(52, `폴리곤 ${ways.length.toLocaleString()}개 래스터화 중…`);

  const grid = await buildGrid(ways, (p) =>
    setProgress(52 + p * 38, '격자 분석 중…')   // 52 → 90 %
  );

  setProgress(90, '3D 오브젝트 생성 중…');
  renderGrid(scene, grid);

  setProgress(100, '완료');

  // Fade out loading screen
  const loadEl = document.getElementById('loading');
  loadEl.style.opacity = '0';
  setTimeout(() => { loadEl.style.display = 'none'; }, 700);

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}

init();

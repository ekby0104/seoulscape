import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ctx } from './context.js';
import { inBounds, worldToTile } from './constants.js';
import { placeTile } from './buildings.js';
import { placeStation, removeStationAt } from './subway.js';

// 카메라 조작은 OrbitControls 가 담당합니다.
// 짧고 거의 움직이지 않은 한 손가락 입력만 별도로 감지해 '건설 탭' 으로 처리합니다.
export function setupControls() {
  const { camera, renderer } = ctx;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 8;
  controls.maxDistance = 55;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.45;
  controls.target.set(0, 0, 0);
  controls.update();
  ctx.controls = controls;

  const el = renderer.domElement;
  const active = new Set();
  let startX = 0,
    startY = 0,
    startT = 0;

  el.addEventListener('pointerdown', (e) => {
    active.add(e.pointerId);
    if (active.size === 1) {
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
    }
  });
  function endPointer(e) {
    const wasSingle = active.size === 1;
    active.delete(e.pointerId);
    if (wasSingle) {
      const dt = performance.now() - startT;
      const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
      if (dist < 8 && dt < 350) handleTap(e.clientX, e.clientY);
    }
  }
  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', (e) => active.delete(e.pointerId));
}

const ndc = { x: 0, y: 0 };
function handleTap(cx, cy) {
  const { renderer, raycaster, camera, groundPlane } = ctx;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((cx - r.left) / r.width) * 2 - 1;
  ndc.y = -((cy - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(groundPlane);
  if (!hit.length) return;
  const p = hit[0].point;
  const { i, j } = worldToTile(p.x, p.z);
  if (!inBounds(i, j)) return;
  const tool = ctx.currentTool;
  if (tool === 'subway') {
    placeStation(i, j);
  } else if (tool === 'empty') {
    if (!removeStationAt(i, j)) placeTile(i, j, 'empty');
  } else {
    placeTile(i, j, tool);
  }
}

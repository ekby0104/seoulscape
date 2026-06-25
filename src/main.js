import './style.css';
import { ctx } from './context.js';
import { TICK_SECONDS } from './constants.js';
import { initScene, initTiles } from './scene.js';
import { buildRiver, buildLandmark, buildDistrictBoundaries, buildDistrictLabels } from './world.js';
import { setupControls } from './controls.js';
import { buildPalette, setupSpeedButtons, updateHUD } from './hud.js';
import { tick } from './simulation.js';

function init() {
  initScene();
  initTiles();

  buildRiver();
  buildLandmark();
  buildDistrictBoundaries();
  buildDistrictLabels();

  buildPalette();
  setupSpeedButtons();
  setupControls();
  updateHUD();

  window.addEventListener('resize', onResize);
  document.getElementById('loading').style.display = 'none';
  setTimeout(() => {
    const h = document.getElementById('hint');
    if (h) h.style.opacity = 0;
  }, 10000);

  animate();
}

function onResize() {
  ctx.camera.aspect = innerWidth / innerHeight;
  ctx.camera.updateProjectionMatrix();
  ctx.renderer.setSize(innerWidth, innerHeight);
}

let lastT = performance.now(),
  fpsAccum = 0,
  fpsCount = 0,
  tickAccum = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now(),
    dt = (now - lastT) / 1000;
  lastT = now;

  if (ctx.speed > 0) {
    tickAccum += dt * ctx.speed;
    while (tickAccum >= TICK_SECONDS) {
      tickAccum -= TICK_SECONDS;
      tick();
    }
  }

  ctx.controls.update();

  fpsAccum += dt;
  fpsCount++;
  if (fpsAccum >= 0.5) {
    document.getElementById('s-fps').textContent = Math.round(fpsCount / fpsAccum);
    fpsAccum = 0;
    fpsCount = 0;
  }

  ctx.renderer.render(ctx.scene, ctx.camera);
}

init();

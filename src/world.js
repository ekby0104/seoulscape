import * as THREE from 'three';
import { ctx } from './context.js';
import { GRID, TILE, RIVER_ROWS, DISTRICTS, DCENTER, tileToWorld } from './constants.js';

// 한강
export function buildRiver() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID * TILE, RIVER_ROWS.length * TILE),
    new THREE.MeshStandardMaterial({ color: 0x2f7bbf, roughness: 0.25, metalness: 0.4 })
  );
  mesh.rotation.x = -Math.PI / 2;
  const midJ = (RIVER_ROWS[0] + RIVER_ROWS[RIVER_ROWS.length - 1]) / 2;
  mesh.position.set(0, 0.02, (midJ - GRID / 2 + 0.5) * TILE);
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
}

// 남산타워 느낌의 랜드마크
export function buildLandmark() {
  const g = new THREE.Group();
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 2.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x4e7d3f, roughness: 1 })
  );
  hill.position.set(-9, 1.2, -10);
  hill.castShadow = hill.receiveShadow = true;
  g.add(hill);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 4.5, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8e8ea })
  );
  pole.position.set(-9, 4.65, -10);
  pole.castShadow = true;
  g.add(pole);
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.4, 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0xd94a4a })
  );
  deck.position.set(-9, 6.5, -10);
  deck.castShadow = true;
  g.add(deck);
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.06, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5555, emissive: 0x661111 })
  );
  spire.position.set(-9, 7.6, -10);
  g.add(spire);
  ctx.decoGroup.add(g);
}

// 자치구 경계선
export function buildDistrictBoundaries() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 });
  [-5, 5].forEach((x) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.07, GRID * TILE), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 0.03, 0);
    ctx.decoGroup.add(strip);
  });
}

// 자치구 라벨(스프라이트)
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function makeLabel() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const c = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(4.2, 2.1, 1);
  sp.renderOrder = 999;
  function set(name, pop) {
    c.clearRect(0, 0, 256, 128);
    c.fillStyle = 'rgba(13,17,23,0.6)';
    roundRect(c, 24, 26, 208, 72, 16);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.15)';
    c.lineWidth = 2;
    c.stroke();
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    c.font = 'bold 36px sans-serif';
    c.fillText(name, 128, 62);
    c.fillStyle = '#7ee787';
    c.font = '600 22px sans-serif';
    c.fillText('인구 ' + pop.toLocaleString('ko-KR'), 128, 90);
    tex.needsUpdate = true;
  }
  set('', 0);
  return { sprite: sp, set };
}
export function buildDistrictLabels() {
  DISTRICTS.forEach((d, idx) => {
    const lab = makeLabel();
    const [ci, cj] = DCENTER[idx];
    const { x, z } = tileToWorld(ci, cj);
    lab.sprite.position.set(x, 4.2, z);
    ctx.decoGroup.add(lab.sprite);
    lab.name = d.name;
    ctx.labelSprites.push(lab);
  });
}

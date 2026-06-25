import * as THREE from 'three';
import { GW, GH, TILE, CHUNK_W, CHUNK_H, toWorld, geoToWorld } from './seoulGeo.js';
import { LANDMARKS } from './seoulData.js';

const TILE_DEF = [
  null,
  { color: 0x4ec9b0, minH: 0.25, maxH: 0.75, castShadow: true  }, // 1 res
  { color: 0xff9d54, minH: 0.45, maxH: 1.40, castShadow: true  }, // 2 com
  { color: 0x539bf5, minH: 0.90, maxH: 2.80, castShadow: true  }, // 3 off
  { color: 0x57c057, minH: 0.04, maxH: 0.04, castShadow: false }, // 4 park
  { color: 0x2f7bbf, minH: 0.06, maxH: 0.06, castShadow: false }, // 5 water
  { color: 0xb8cfc0, minH: 0.07, maxH: 0.18, castShadow: false }, // 6 fill (unclassified Seoul)
];

function hash(col, row) {
  const v = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// Render the Seoul boundary as a filled shape (city silhouette)
export function renderBoundary(scene, ring) {
  if (!ring || ring.length < 3) return;
  const shape = new THREE.Shape();
  const p0 = geoToWorld(ring[0].lon, ring[0].lat);
  // Negate z: ShapeGeometry is in local XY; after rotation.x=-π/2,
  // local Y maps to world -Z, so passing -worldZ restores the correct orientation.
  shape.moveTo(p0.x, -p0.z);
  for (let i = 1; i < ring.length; i++) {
    const p = geoToWorld(ring[i].lon, ring[i].lat);
    shape.lineTo(p.x, -p.z);
  }
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: 0x8b9e6a, roughness: 1 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.008;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Build a floating text label as a sprite (canvas texture).
function makeLabelSprite(text) {
  const fontSize = 52;
  const pad = 22;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  const textW = ctx.measureText(text).width;
  canvas.width = textW + pad * 2;
  canvas.height = fontSize + pad * 2;
  // canvas resize clears the context — set the font again
  ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.fillStyle = 'rgba(20,24,34,0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, canvas.height / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  const scale = 4.5;
  sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
  return sprite;
}

// Render landmark markers (pin pole + ball + name label) for orientation.
export function renderLandmarks(scene) {
  const group = new THREE.Group();
  for (const lm of LANDMARKS) {
    const { x, z } = geoToWorld(lm.lon, lm.lat);
    const poleH = lm.h * 1.5 + 3; // tall enough to rise above buildings
    const mat = new THREE.MeshStandardMaterial({
      color: lm.color,
      emissive: lm.color,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.1,
    });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, poleH, 10), mat);
    pole.position.set(x, poleH / 2, z);
    pole.castShadow = true;
    group.add(pole);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 18), mat);
    ball.position.set(x, poleH + 0.6, z);
    ball.castShadow = true;
    group.add(ball);

    const label = makeLabelSprite(lm.name);
    label.position.set(x, poleH + 2.6, z);
    group.add(label);
  }
  scene.add(group);
  return group;
}

// Render landuse grid as InstancedMesh.
// Returns { meshes: InstancedMesh[5], instanceMap: Map<chunkId, [{meshIdx, instanceIdx, matrix}]> }
export function renderGrid(scene, grid, mask) {
  const counts = new Int32Array(6);
  for (let i = 0; i < grid.length; i++) {
    if (mask && !mask[i]) continue;
    counts[grid[i]]++;
  }

  const geom = new THREE.BoxGeometry(TILE * 0.88, 1, TILE * 0.88);
  const imSlots = [];   // [{im: InstancedMesh, idx: 0}|null] × 6
  const imRefs  = [];   // just the InstancedMesh (or null) for external use
  for (let t = 1; t <= 6; t++) {
    if (!counts[t]) { imSlots.push(null); imRefs.push(null); continue; }
    const def = TILE_DEF[t];
    const im = new THREE.InstancedMesh(
      geom,
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.80, metalness: 0.05 }),
      counts[t]
    );
    im.castShadow = def.castShadow;
    im.receiveShadow = true;
    scene.add(im);
    imSlots.push({ im, idx: 0 });
    imRefs.push(im);
  }

  const instanceMap = new Map(); // chunkId → [{meshIdx, instanceIdx, matrix}]
  const dummy = new THREE.Object3D();

  for (let row = 0; row < GH; row++) {
    for (let col = 0; col < GW; col++) {
      const cellIdx = row * GW + col;
      if (mask && !mask[cellIdx]) continue;
      const t = grid[cellIdx];
      if (t === 0) continue;
      const slot = imSlots[t - 1];
      if (!slot) continue;

      const def = TILE_DEF[t];
      const h = def.minH + hash(col, row) * (def.maxH - def.minH);
      const { x, z } = toWorld(col, row);
      dummy.position.set(x, h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();

      const iIdx = slot.idx++;
      slot.im.setMatrixAt(iIdx, dummy.matrix);

      const chunkId = `${Math.floor(col / CHUNK_W)}_${Math.floor(row / CHUNK_H)}`;
      if (!instanceMap.has(chunkId)) instanceMap.set(chunkId, []);
      instanceMap.get(chunkId).push({ meshIdx: t - 1, instanceIdx: iIdx, matrix: dummy.matrix.clone() });
    }
  }

  for (const slot of imSlots) {
    if (slot) slot.im.instanceMatrix.needsUpdate = true;
  }

  return { meshes: imRefs, instanceMap };
}

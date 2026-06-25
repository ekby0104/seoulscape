import * as THREE from 'three';
import { GW, GH, TILE, toWorld } from './seoulGeo.js';

// type code → { color, minH, maxH, castShadow }
const TILE_DEF = [
  null, // 0 = empty, handled by ground plane
  { color: 0x4ec9b0, minH: 0.30, maxH: 0.80, castShadow: true  }, // 1 res
  { color: 0xff9d54, minH: 0.50, maxH: 1.50, castShadow: true  }, // 2 com
  { color: 0x539bf5, minH: 1.00, maxH: 3.00, castShadow: true  }, // 3 off
  { color: 0x57c057, minH: 0.04, maxH: 0.04, castShadow: false }, // 4 park
  { color: 0x2f7bbf, minH: 0.06, maxH: 0.06, castShadow: false }, // 5 water
];

// Deterministic hash so height doesn't flicker between frames
function hash(col, row) {
  const v = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function renderGrid(scene, grid) {
  // Count instances needed per type
  const counts = new Int32Array(6);
  for (let i = 0; i < grid.length; i++) counts[grid[i]]++;

  // Unit-height box, scaled per instance
  const geom = new THREE.BoxGeometry(TILE * 0.88, 1, TILE * 0.88);

  // Build one InstancedMesh per type (skip empty=0)
  const meshes = [];
  for (let t = 1; t <= 5; t++) {
    if (counts[t] === 0) { meshes.push(null); continue; }
    const def = TILE_DEF[t];
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.80,
      metalness: 0.05,
    });
    const im = new THREE.InstancedMesh(geom, mat, counts[t]);
    im.castShadow = def.castShadow;
    im.receiveShadow = true;
    scene.add(im);
    meshes.push({ im, idx: 0 });
  }

  const dummy = new THREE.Object3D();
  const indices = new Int32Array(5); // running index per type (1-5 → 0-4)

  for (let row = 0; row < GH; row++) {
    for (let col = 0; col < GW; col++) {
      const t = grid[row * GW + col];
      if (t === 0) continue;

      const slot = meshes[t - 1];
      if (!slot) continue;

      const def = TILE_DEF[t];
      const h = def.minH + hash(col, row) * (def.maxH - def.minH);
      const { x, z } = toWorld(col, row);

      dummy.position.set(x, h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();

      slot.im.setMatrixAt(slot.idx++, dummy.matrix);
    }
  }

  for (const slot of meshes) {
    if (slot) slot.im.instanceMatrix.needsUpdate = true;
  }
}

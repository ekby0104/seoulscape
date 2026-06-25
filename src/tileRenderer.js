import * as THREE from 'three';
import { GW, GH, TILE, CHUNK_W, CHUNK_H, toWorld, geoToWorld } from './seoulGeo.js';

const TILE_DEF = [
  null,
  { color: 0x4ec9b0, minH: 0.25, maxH: 0.75, castShadow: true  }, // 1 res
  { color: 0xff9d54, minH: 0.45, maxH: 1.40, castShadow: true  }, // 2 com
  { color: 0x539bf5, minH: 0.90, maxH: 2.80, castShadow: true  }, // 3 off
  { color: 0x57c057, minH: 0.04, maxH: 0.04, castShadow: false }, // 4 park
  { color: 0x2f7bbf, minH: 0.06, maxH: 0.06, castShadow: false }, // 5 water
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
  shape.moveTo(p0.x, p0.z);
  for (let i = 1; i < ring.length; i++) {
    const p = geoToWorld(ring[i].lon, ring[i].lat);
    shape.lineTo(p.x, p.z);
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

// Render landuse grid as InstancedMesh.
// Returns { meshes: InstancedMesh[5], instanceMap: Map<chunkId, [{meshIdx, instanceIdx, matrix}]> }
export function renderGrid(scene, grid, mask) {
  const counts = new Int32Array(6);
  for (let i = 0; i < grid.length; i++) {
    if (mask && !mask[i]) continue;
    counts[grid[i]]++;
  }

  const geom = new THREE.BoxGeometry(TILE * 0.88, 1, TILE * 0.88);
  const imSlots = [];   // [{im: InstancedMesh, idx: 0}|null] × 5
  const imRefs  = [];   // just the InstancedMesh (or null) for external use
  for (let t = 1; t <= 5; t++) {
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

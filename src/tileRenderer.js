import * as THREE from 'three';
import { GW, GH, TILE, toWorld, geoToWorld } from './seoulGeo.js';

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

// Render the Seoul boundary as a filled shape (actual city silhouette)
export function renderBoundary(scene, ring) {
  if (!ring || ring.length < 3) return;

  const shape = new THREE.Shape();
  const p0 = geoToWorld(ring[0].lon, ring[0].lat);
  shape.moveTo(p0.x, p0.z);
  for (let i = 1; i < ring.length; i++) {
    const p = geoToWorld(ring[i].lon, ring[i].lat);
    shape.lineTo(p.x, p.z);
  }

  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x8b9e6a, roughness: 1 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.008;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Render the 90×66 landuse grid as InstancedMesh tiles.
// mask: Uint8Array (1=inside Seoul, 0=outside); if null render everything.
export function renderGrid(scene, grid, mask) {
  // Count instances per type (respecting mask)
  const counts = new Int32Array(6);
  for (let i = 0; i < grid.length; i++) {
    if (mask && !mask[i]) continue;
    counts[grid[i]]++;
  }

  const geom = new THREE.BoxGeometry(TILE * 0.88, 1, TILE * 0.88);

  const meshes = [];
  for (let t = 1; t <= 5; t++) {
    if (!counts[t]) { meshes.push(null); continue; }
    const def = TILE_DEF[t];
    const im = new THREE.InstancedMesh(
      geom,
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.80, metalness: 0.05 }),
      counts[t]
    );
    im.castShadow = def.castShadow;
    im.receiveShadow = true;
    scene.add(im);
    meshes.push({ im, idx: 0 });
  }

  const dummy = new THREE.Object3D();

  for (let row = 0; row < GH; row++) {
    for (let col = 0; col < GW; col++) {
      const idx = row * GW + col;
      if (mask && !mask[idx]) continue;
      const t = grid[idx];
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

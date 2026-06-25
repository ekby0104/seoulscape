import * as THREE from 'three';
import { BBOX, GW, GH, TILE, CHUNK_W, CHUNK_H } from './seoulGeo.js';
import { fetchBuildingsForChunk } from './buildingFetch.js';
import { createChunkMesh } from './buildingRender.js';

const LOD_DIST      = 48;   // camera distance to orbit target that activates LOD
const MAX_PARALLEL  = 2;    // max concurrent Overpass requests (keep low to avoid 429)
const MAX_CACHED    = 24;   // max chunks to keep in memory
const LOD_RADIUS    = 1;    // chunks loaded around the target → (1*2+1)² = 3×3
const RETRY_COOLDOWN = 5000;// ms to wait before retrying a failed chunk

const TOTAL_CC = Math.ceil(GW / CHUNK_W);
const TOTAL_CR = Math.ceil(GH / CHUNK_H);

// Transforms world X/Z back to chunk column/row index
function worldToChunk(x, z) {
  const col = Math.round(x / TILE + GW / 2 - 0.5);
  const row = Math.round(z / TILE + GH / 2 - 0.5);
  return {
    cc: Math.max(0, Math.min(TOTAL_CC - 1, Math.floor(col / CHUNK_W))),
    cr: Math.max(0, Math.min(TOTAL_CR - 1, Math.floor(row / CHUNK_H))),
  };
}

// Geo bbox for chunk (cc, cr)
function chunkBbox(cc, cr) {
  const W = BBOX.W + (cc * CHUNK_W / GW) * (BBOX.E - BBOX.W);
  const E = BBOX.W + Math.min((cc + 1) * CHUNK_W, GW) / GW * (BBOX.E - BBOX.W);
  const N = BBOX.N - (cr * CHUNK_H / GH) * (BBOX.N - BBOX.S);
  const S = BBOX.N - Math.min((cr + 1) * CHUNK_H, GH) / GH * (BBOX.N - BBOX.S);
  return { S, N, W, E };
}

// Show/hide the overview InstancedMesh tiles for a chunk.
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function toggleOverview(instanceMap, meshes, chunkId, show, savedMatrices) {
  const list = instanceMap.get(chunkId);
  if (!list) return;
  for (const { meshIdx, instanceIdx, matrix } of list) {
    const im = meshes[meshIdx];
    if (!im) continue;
    im.setMatrixAt(instanceIdx, show ? matrix : ZERO);
    im.instanceMatrix.needsUpdate = true;
  }
}

export class LodManager {
  constructor(scene, meshes, instanceMap) {
    this.scene        = scene;
    this.meshes       = meshes;       // InstancedMesh[5] from renderGrid()
    this.instanceMap  = instanceMap;  // Map<chunkId, instances>
    this.active       = new Map();    // chunkId → THREE.Group (building mesh)
    this.loading      = new Set();    // chunkId being fetched
    this.lruOrder     = [];           // for eviction
    this.cooldown     = new Map();    // chunkId → earliest retry time (ms)
    this.wasLod       = false;
  }

  update(camDist, target) {
    const isLod = camDist < LOD_DIST;

    // Exit LOD mode: restore all overview tiles and remove building meshes
    if (!isLod) {
      if (this.wasLod) {
        for (const [id, mesh] of this.active) {
          if (mesh) this.scene.remove(mesh);
          toggleOverview(this.instanceMap, this.meshes, id, true);
        }
        this.active.clear();
        this.lruOrder = [];
      }
      this.wasLod = false;
      return;
    }
    this.wasLod = true;

    const { cc, cr } = worldToChunk(target.x, target.z);

    // Determine which chunks should be loaded (square around current target)
    const want = new Set();
    for (let dc = -LOD_RADIUS; dc <= LOD_RADIUS; dc++) {
      for (let dr = -LOD_RADIUS; dr <= LOD_RADIUS; dr++) {
        const c = cc + dc, r = cr + dr;
        if (c >= 0 && c < TOTAL_CC && r >= 0 && r < TOTAL_CR) want.add(`${c}_${r}`);
      }
    }

    // Load missing chunks (respect MAX_PARALLEL and per-chunk retry cooldown)
    const now = performance.now();
    for (const id of want) {
      if (this.active.has(id) || this.loading.has(id)) continue;
      if ((this.cooldown.get(id) || 0) > now) continue;       // still cooling down after a failure
      if (this.loading.size >= MAX_PARALLEL) break;
      this._load(id);
    }

    // Evict chunks no longer wanted
    for (const [id, mesh] of this.active) {
      if (!want.has(id)) {
        if (mesh) this.scene.remove(mesh);
        toggleOverview(this.instanceMap, this.meshes, id, true);
        this.active.delete(id);
        this.lruOrder = this.lruOrder.filter(x => x !== id);
      }
    }

    // Keep LRU under cap
    while (this.lruOrder.length > MAX_CACHED) {
      const evict = this.lruOrder.shift();
      const mesh = this.active.get(evict);
      if (mesh) this.scene.remove(mesh);
      toggleOverview(this.instanceMap, this.meshes, evict, true);
      this.active.delete(evict);
    }
  }

  async _load(id) {
    this.loading.add(id);
    const [cc, cr] = id.split('_').map(Number);
    try {
      const buildings = await fetchBuildingsForChunk(chunkBbox(cc, cr));
      const mesh = createChunkMesh(buildings);
      // Hide overview tiles for this chunk and show buildings
      toggleOverview(this.instanceMap, this.meshes, id, false);
      if (mesh) this.scene.add(mesh);
      this.active.set(id, mesh);
      this.lruOrder.push(id);
      this.cooldown.delete(id);
    } catch (err) {
      console.warn('[LOD] chunk load failed (will retry):', id, err.message);
      // Don't mark active — leave the overview tiles up and retry after a cooldown.
      this.cooldown.set(id, performance.now() + RETRY_COOLDOWN);
    } finally {
      this.loading.delete(id);
    }
  }
}

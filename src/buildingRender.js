import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geoToWorld } from './seoulGeo.js';

// Base colour per building category. Per-building variation is layered on top
// via vertex colours so the city looks rich instead of flat blocks of 6 hues.
const TYPE_COLOR = {
  res:     0x5bc4b0, // teal
  com:     0xff9d54, // orange
  off:     0x5090e0, // blue
  civic:   0xb487e0, // purple (schools / hospitals / public)
  ind:     0xc9a884, // tan-brown (industrial / warehouse)
  default: 0xd0c4b4, // warm grey
};

// Drop only truly tiny structures so most real buildings show when zoomed in.
const MIN_AREA = 0.00015;

// Toy-city chunkiness: fatten each footprint and keep a minimum height so
// buildings read as solid blocks; cap height vs. width so nothing turns into
// a needle.
const INFLATE     = 1.3;
const MIN_HEIGHT  = 0.12;
const MAX_ASPECT  = 14;  // height ≤ shortest footprint side × this

const _c = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

// Deterministic 0..1 from a seed value.
function rand(seed) {
  const v = Math.sin(seed * 91.17) * 43758.5453;
  return v - Math.floor(v);
}

// Build a single merged THREE.Group containing all buildings in a chunk.
// One sub-mesh per building category; per-building tint via vertex colours.
export function createChunkMesh(buildings) {
  if (!buildings.length) return null;

  const byType = { res: [], com: [], off: [], civic: [], ind: [], default: [] };

  for (const { coords, height, type } of buildings) {
    const base = TYPE_COLOR[type] ?? TYPE_COLOR.default;
    const geo = extrudedBuilding(coords, height, base);
    if (geo) (byType[type] ?? byType.default).push(geo);
  }

  const group = new THREE.Group();
  for (const geos of Object.values(byType)) {
    if (!geos.length) continue;
    let merged;
    try { merged = mergeGeometries(geos, false); } catch { continue; }
    if (!merged) continue;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: 0xffffff,
        roughness: 0.72,
        side: THREE.DoubleSide,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group.children.length ? group : null;
}

// Convert an OSM building polygon + height into an ExtrudeGeometry in world
// space, tinted with a per-building variation of its category colour.
function extrudedBuilding(coords, height, baseHex) {
  let pts = coords.map(c => geoToWorld(c.lon, c.lat));

  // Polygon area (shoelace) on the true footprint — skip tiny structures.
  let area2 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area2 += pts[i].x * pts[i + 1].z - pts[i + 1].x * pts[i].z;
  }
  if (Math.abs(area2) / 2 < MIN_AREA) return null;

  // Fatten the footprint around its centroid for a chunky toy look.
  let cx = 0, cz = 0;
  for (const p of pts) { cx += p.x; cz += p.z; }
  cx /= pts.length; cz /= pts.length;
  pts = pts.map(p => ({ x: cx + (p.x - cx) * INFLATE, z: cz + (p.z - cz) * INFLATE }));

  // Clamp height: never paper-flat, never a needle relative to its footprint.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  const minSide = Math.max(0.04, Math.min(maxX - minX, maxZ - minZ));
  const h = Math.min(Math.max(height, MIN_HEIGHT), minSide * MAX_ASPECT);

  // Shape is defined in XY plane (using world X and -Z so rotation maps correctly)
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, -pts[0].z);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].z);

  let geo;
  try {
    geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    // Rotate -90° around X: XY shape → XZ ground plane, +Z extrusion → +Y world up
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  } catch {
    return null;
  }

  // Per-building tint: vary brightness/saturation/hue slightly from the base.
  const seed = pts[0].x * 12.9898 + pts[0].z * 78.233;
  const v = rand(seed) - 0.5;
  _c.set(baseHex);
  _c.getHSL(_hsl);
  _c.setHSL(
    (_hsl.h + v * 0.04 + 1) % 1,
    THREE.MathUtils.clamp(_hsl.s + v * 0.18, 0, 1),
    THREE.MathUtils.clamp(_hsl.l + v * 0.20, 0.18, 0.86)
  );

  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3]     = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geoToWorld } from './seoulGeo.js';

const TYPE_COLOR = {
  res:     0x5bc4b0,
  com:     0xff9d54,
  off:     0x5090e0,
  default: 0xd0c4b4,
};

// Build a single merged THREE.Group containing all buildings in a chunk.
// One sub-mesh per building type for consistent color-coding.
export function createChunkMesh(buildings) {
  if (!buildings.length) return null;

  const byType = { res: [], com: [], off: [], default: [] };

  for (const { coords, height, type } of buildings) {
    const geo = extrudedBuilding(coords, height);
    if (geo) byType[type]?.push(geo) ?? byType.default.push(geo);
  }

  const group = new THREE.Group();
  for (const [type, geos] of Object.entries(byType)) {
    if (!geos.length) continue;
    let merged;
    try { merged = mergeGeometries(geos, false); } catch { continue; }
    if (!merged) continue;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: TYPE_COLOR[type], roughness: 0.72, side: THREE.DoubleSide })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group.children.length ? group : null;
}

// Convert an OSM building polygon + height into an ExtrudeGeometry in world space.
function extrudedBuilding(coords, height) {
  const pts = coords.map(c => geoToWorld(c.lon, c.lat));

  // Filter tiny structures (< ~20 m² real-world area)
  let area2 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area2 += pts[i].x * pts[i + 1].z - pts[i + 1].x * pts[i].z;
  }
  if (Math.abs(area2) / 2 < 0.00008) return null;

  // Shape is defined in XY plane (using world X and -Z so rotation maps correctly)
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, -pts[0].z);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].z);

  try {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    // Rotate -90° around X: XY shape → XZ ground plane, +Z extrusion → +Y world up
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    return geo;
  } catch {
    return null;
  }
}

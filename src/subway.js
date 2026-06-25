import * as THREE from 'three';
import { ctx, state } from './context.js';
import { TYPES, inBounds, tileToWorld } from './constants.js';
import { disposeGroup } from './buildings.js';
import { updateHUD, flashMoney } from './hud.js';

export function placeStation(i, j) {
  if (!inBounds(i, j)) return;
  const t = ctx.tiles[i][j];
  if (t.type === 'water' || t.station) return;
  if (state.money < TYPES.subway.price) {
    flashMoney();
    return;
  }
  state.money -= TYPES.subway.price;
  t.station = true;
  const { x, z } = tileToWorld(i, j);
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0x2b8a3e })
  );
  base.position.y = 0.06;
  g.add(base);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xdfe3e8 })
  );
  pole.position.y = 0.35;
  g.add(pole);
  const sign = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 20),
    new THREE.MeshStandardMaterial({ color: 0x37d67a, emissive: 0x145c2e, emissiveIntensity: 0.8, side: THREE.DoubleSide })
  );
  sign.position.y = 0.6;
  g.add(sign);
  g.position.set(x, 0, z);
  ctx.subwayGroup.add(g);
  ctx.stations.push({ i, j, mesh: g });
  rebuildSubwayLines();
  updateHUD();
}

export function removeStationAt(i, j) {
  const idx = ctx.stations.findIndex((s) => s.i === i && s.j === j);
  if (idx < 0) return false;
  const s = ctx.stations[idx];
  ctx.subwayGroup.remove(s.mesh);
  disposeGroup(s.mesh);
  ctx.tiles[i][j].station = false;
  ctx.stations.splice(idx, 1);
  rebuildSubwayLines();
  updateHUD();
  return true;
}

export function rebuildSubwayLines() {
  ctx.lineMeshes.forEach((m) => {
    ctx.subwayGroup.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  ctx.lineMeshes = [];
  const stations = ctx.stations;
  for (let k = 1; k < stations.length; k++) {
    const a = tileToWorld(stations[k - 1].i, stations[k - 1].j),
      b = tileToWorld(stations[k].i, stations[k].j);
    const va = new THREE.Vector3(a.x, 0.1, a.z),
      vb = new THREE.Vector3(b.x, 0.1, b.z);
    const len = va.distanceTo(vb);
    const geo = new THREE.CylinderGeometry(0.05, 0.05, len, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b8a3e, emissive: 0x0e3d1c, emissiveIntensity: 0.5 });
    const cyl = new THREE.Mesh(geo, mat);
    cyl.position.copy(va).lerp(vb, 0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    ctx.subwayGroup.add(cyl);
    ctx.lineMeshes.push(cyl);
  }
}

export function subwayNear(i, j) {
  for (const s of ctx.stations) {
    if (Math.abs(s.i - i) + Math.abs(s.j - j) <= 3) return true;
  }
  return false;
}

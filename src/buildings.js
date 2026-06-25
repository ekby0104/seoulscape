import * as THREE from 'three';
import { ctx, state } from './context.js';
import { TYPES, TILE, inBounds, tileToWorld, rand } from './constants.js';
import { TEX } from './textures.js';
import { updateHUD, flashMoney } from './hud.js';

// 타입/레벨에 따른 건물 메시 생성
export function makeBuilding(type, level) {
  const g = new THREE.Group();
  const lv = Math.max(1, level);
  if (type === 'res') {
    const n = lv >= 3 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const hgt = lv * 0.9 + rand(0.4, 0.9);
      const tex = TEX.res.clone();
      tex.repeat.set(1, Math.max(1, Math.round(hgt)));
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, hgt, 0.5),
        new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.85 })
      );
      m.position.set(-0.28 + k * 0.28, hgt / 2, rand(-0.12, 0.12));
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
  } else if (type === 'com') {
    const hgt = lv * 0.5 + 0.6;
    const tex = TEX.com.clone();
    tex.repeat.set(2, Math.max(1, Math.round(hgt)));
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, hgt, 0.7),
      new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.8 })
    );
    m.position.y = hgt / 2;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.16, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0x551111, emissiveIntensity: 0.6 })
    );
    sign.position.set(0, hgt * 0.78, 0.37);
    g.add(sign);
  } else if (type === 'off') {
    const hgt = lv * 1.6 + 1.0;
    const tex = TEX.off.clone();
    tex.repeat.set(1, Math.max(2, Math.round(hgt * 1.2)));
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, hgt, 0.6),
      new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.35, metalness: 0.3 })
    );
    m.position.y = hgt / 2;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1a2330 })
    );
    cap.position.y = hgt + 0.2;
    g.add(cap);
  } else if (type === 'park') {
    for (let k = 0; k < 3; k++) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.25, 6),
        new THREE.MeshStandardMaterial({ color: 0x7a5230 })
      );
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x3f9e46, roughness: 1 })
      );
      const px = rand(-0.3, 0.3),
        pz = rand(-0.3, 0.3);
      trunk.position.set(px, 0.12, pz);
      leaf.position.set(px, 0.4, pz);
      trunk.castShadow = leaf.castShadow = true;
      g.add(trunk);
      g.add(leaf);
    }
  }
  return g;
}

function makePlate(type) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96),
    new THREE.MeshStandardMaterial({ color: TYPES[type].c, roughness: 1 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.receiveShadow = true;
  if (type === 'road') {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.9, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xe6c34a })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.02;
    m.add(line);
  }
  return m;
}

export function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

function clearTileMeshes(t) {
  if (t.group) {
    ctx.buildingGroup.remove(t.group);
    disposeGroup(t.group);
    t.group = null;
  }
  if (t.plate) {
    ctx.plateGroup.remove(t.plate);
    t.plate.geometry.dispose();
    t.plate = null;
  }
}

export function placeTile(i, j, type) {
  if (!inBounds(i, j)) return;
  const t = ctx.tiles[i][j];
  if (t.type === 'water') return;
  if (type === 'empty') {
    clearTileMeshes(t);
    t.type = 'empty';
    t.level = 0;
    updateHUD();
    return;
  }
  const cost = TYPES[type].price;
  if (state.money < cost) {
    flashMoney();
    return;
  }
  state.money -= cost;
  clearTileMeshes(t);
  t.type = type;
  t.level = 1;
  const { x, z } = tileToWorld(i, j);
  const plate = makePlate(type);
  plate.position.x = x;
  plate.position.z = z;
  ctx.plateGroup.add(plate);
  t.plate = plate;
  if (type !== 'road') {
    const g = makeBuilding(type, t.level);
    g.position.set(x, 0, z);
    ctx.buildingGroup.add(g);
    t.group = g;
  }
  updateHUD();
}

export function rebuildBuilding(i, j) {
  const t = ctx.tiles[i][j];
  if (t.group) {
    ctx.buildingGroup.remove(t.group);
    disposeGroup(t.group);
  }
  const { x, z } = tileToWorld(i, j);
  const g = makeBuilding(t.type, t.level);
  g.position.set(x, 0, z);
  ctx.buildingGroup.add(g);
  t.group = g;
}

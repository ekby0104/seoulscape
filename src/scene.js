import * as THREE from 'three';
import { ctx } from './context.js';
import { GRID, TILE, RIVER_ROWS } from './constants.js';

// 씬 / 카메라 / 렌더러 / 조명 / 지면 / 격자 / 그룹 / 타일 초기화
export function initScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec5e8);
  scene.fog = new THREE.Fog(0x9ec5e8, 42, 85);

  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 300);
  // OrbitControls 초기 시점 (반경 26, 약간 비스듬한 부감)
  camera.position.set(13.6, 15.1, 16.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a5a, 0.85));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.0);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 22;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID * TILE, GRID * TILE),
    new THREE.MeshStandardMaterial({ color: 0x6f9e58, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(GRID * TILE, GRID, 0x3d5a32, 0x3d5a32);
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);

  const buildingGroup = new THREE.Group();
  const plateGroup = new THREE.Group();
  const decoGroup = new THREE.Group();
  const subwayGroup = new THREE.Group();
  scene.add(buildingGroup, plateGroup, decoGroup, subwayGroup);

  ctx.scene = scene;
  ctx.camera = camera;
  ctx.renderer = renderer;
  ctx.groundPlane = ground;
  ctx.buildingGroup = buildingGroup;
  ctx.plateGroup = plateGroup;
  ctx.decoGroup = decoGroup;
  ctx.subwayGroup = subwayGroup;
  ctx.raycaster = new THREE.Raycaster();
}

// 타일 격자 초기화 (한강 행은 water)
export function initTiles() {
  for (let i = 0; i < GRID; i++) {
    ctx.tiles[i] = [];
    for (let j = 0; j < GRID; j++) {
      ctx.tiles[i][j] = { type: 'empty', level: 0, group: null, plate: null, station: false };
      if (RIVER_ROWS.includes(j)) ctx.tiles[i][j].type = 'water';
    }
  }
}

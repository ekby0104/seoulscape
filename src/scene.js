import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GW, GH, TILE } from './seoulGeo.js';

export function initScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8bbdd9);
  scene.fog = new THREE.FogExp2(0x8bbdd9, 0.006);

  const aspect = innerWidth / innerHeight;
  const camera = new THREE.PerspectiveCamera(48, aspect, 0.5, 500);
  // Positioned to see the full 90×66 grid from a bird's-eye angle
  camera.position.set(0, 90, 105);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  // Soft sky light + warm directional sun
  scene.add(new THREE.HemisphereLight(0xd6eeff, 0x7a9e5c, 0.95));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.15);
  sun.position.set(50, 100, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 70;
  sun.shadow.camera.left   = -s;
  sun.shadow.camera.right  =  s;
  sun.shadow.camera.top    =  s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 250;
  scene.add(sun);

  // Ground plane covering full grid
  const gw = GW * TILE, gh = GH * TILE;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(gw, gh),
    new THREE.MeshStandardMaterial({ color: 0x8b9e6a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = false;
  controls.minDistance = 15;
  controls.maxDistance = 220;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.45;
  controls.target.set(0, 0, 0);
  controls.update();

  return { scene, camera, renderer, controls };
}

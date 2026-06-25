import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8bbdd9);
  scene.fog = new THREE.FogExp2(0x8bbdd9, 0.006);

  const aspect = innerWidth / innerHeight;
  const camera = new THREE.PerspectiveCamera(48, aspect, 0.5, 500);
  // Positioned to frame the full Seoul island from a bird's-eye angle
  camera.position.set(0, 78, 92);

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

  // No big ground plane — Seoul is rendered as a floating island (extruded
  // boundary slab) by tileRenderer, sitting on the sky-blue background.

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = false;
  controls.minDistance = 4;   // allow close-up "street-level" zoom
  controls.maxDistance = 220;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.45;
  controls.target.set(0, 0, 0);
  controls.update();

  return { scene, camera, renderer, controls };
}

import { START_MONEY } from './constants.js';

// 게임 전역에서 공유되는 가변 참조들을 한 곳에 모아 둡니다.
// 각 모듈은 ctx 의 프로퍼티를 읽고 쓰는 방식으로 상태를 공유합니다.
export const ctx = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  groundPlane: null,

  tiles: [],
  stations: [],
  labelSprites: [],
  lineMeshes: [],

  buildingGroup: null,
  plateGroup: null,
  decoGroup: null,
  subwayGroup: null,

  currentTool: 'road',
  speed: 1,
};

export const state = { day: 1, pop: 0, money: START_MONEY, emp: 0, hap: 75, bld: 0 };

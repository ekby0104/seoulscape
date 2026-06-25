// 격자 / 시뮬레이션 기본 상수와 좌표 유틸리티

export const GRID = 30;
export const TILE = 1;
export const RIVER_ROWS = [13, 14, 15];
export const TICK_SECONDS = 1.2;
export const START_MONEY = 50000;

export const TYPES = {
  empty:  { c: 0x000000, nm: '',       price: 0,   maint: 0 },
  road:   { c: 0x3a3f47, nm: '도로',   price: 10,  maint: 1 },
  res:    { c: 0x4ec9b0, nm: '주거',   price: 100, maint: 2 },
  com:    { c: 0xff9d54, nm: '상업',   price: 120, maint: 2 },
  off:    { c: 0x539bf5, nm: '업무',   price: 200, maint: 3 },
  park:   { c: 0x57c057, nm: '공원',   price: 60,  maint: 1 },
  subway: { c: 0x37b24d, nm: '지하철', price: 300, maint: 4 },
  water:  { c: 0x2d6cb0, nm: '한강',   price: 0,   maint: 0 },
};

/* ===== 자치구 ===== */
export const DISTRICTS = [
  { name: '마포구' }, { name: '종로구' }, { name: '성동구' },   // 강북 0,1,2
  { name: '영등포구' }, { name: '강남구' }, { name: '송파구' },  // 강남 3,4,5
];
export const DCENTER = [ [5, 6], [15, 6], [25, 6], [5, 22], [15, 22], [25, 22] ];

export function districtIndex(i, j) {
  if (j >= 13 && j <= 15) return -1;
  const band = i < 10 ? 0 : i < 20 ? 1 : 2;
  const side = j < 13 ? 0 : 1;
  return side * 3 + band;
}

export function tileToWorld(i, j) {
  return { x: (i - GRID / 2 + 0.5) * TILE, z: (j - GRID / 2 + 0.5) * TILE };
}
export function worldToTile(x, z) {
  return { i: Math.floor(x / TILE + GRID / 2), j: Math.floor(z / TILE + GRID / 2) };
}
export function inBounds(i, j) {
  return i >= 0 && j >= 0 && i < GRID && j < GRID;
}
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

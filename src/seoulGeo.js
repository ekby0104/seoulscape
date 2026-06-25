// Seoul WGS-84 bounding box
export const BBOX = { S: 37.4133, W: 126.7342, N: 37.7151, E: 127.1832 };

// Grid dimensions: columns (W→E) × rows (N→S) — 2× resolution
export const GW = 180;
export const GH = 132;

// Half TILE keeps the world the same physical size as the 90×66 grid
export const TILE = 0.5;

// Convert longitude/latitude → floating-point grid position (for scanline rasterizer)
export function lonLatToGrid(lon, lat) {
  return {
    col: ((lon - BBOX.W) / (BBOX.E - BBOX.W)) * GW,
    row: ((BBOX.N - lat) / (BBOX.N - BBOX.S)) * GH,
  };
}

// Integer grid cell → geographic center (for labels / debug)
export function cellCenter(col, row) {
  return {
    lon: BBOX.W + ((col + 0.5) / GW) * (BBOX.E - BBOX.W),
    lat: BBOX.N - ((row + 0.5) / GH) * (BBOX.N - BBOX.S),
  };
}

// Grid cell → Three.js world position (grid is centered on origin)
export function toWorld(col, row) {
  return {
    x: (col - GW / 2 + 0.5) * TILE,
    z: (row - GH / 2 + 0.5) * TILE,
  };
}

// Continuous geo coord → Three.js world position (for boundary polygon, roads, etc.)
export function geoToWorld(lon, lat) {
  const col = ((lon - BBOX.W) / (BBOX.E - BBOX.W)) * GW;
  const row = ((BBOX.N - lat) / (BBOX.N - BBOX.S)) * GH;
  return {
    x: (col - GW / 2) * TILE,
    z: (row - GH / 2) * TILE,
  };
}

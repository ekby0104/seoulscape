import { GW, GH, lonLatToGrid } from './seoulGeo.js';

// type code → numeric priority (higher = wins)
const TYPE_CODE = { res: 1, com: 2, off: 3, park: 4, water: 5 };

// Fill a polygon into the grid using a scanline algorithm.
// Only writes to cells whose current value is lower priority than typeCode.
function rasterizePolygon(grid, typeCode, pts) {
  let minRow = GH, maxRow = 0;
  for (const p of pts) {
    if (p.row < minRow) minRow = p.row;
    if (p.row > maxRow) maxRow = p.row;
  }
  minRow = Math.max(0, Math.floor(minRow));
  maxRow = Math.min(GH - 1, Math.ceil(maxRow));

  for (let row = minRow; row <= maxRow; row++) {
    const xs = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const { col: x1, row: y1 } = pts[i];
      const { col: x2, row: y2 } = pts[i + 1];
      if ((y1 <= row && y2 > row) || (y2 <= row && y1 > row)) {
        xs.push(x1 + ((row - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);

    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c1 = Math.max(0, Math.ceil(xs[k]));
      const c2 = Math.min(GW - 1, Math.floor(xs[k + 1]));
      for (let col = c1; col <= c2; col++) {
        const idx = row * GW + col;
        if (grid[idx] < typeCode) grid[idx] = typeCode;
      }
    }
  }
}

// Rasterize all OSM polygons into a flat Uint8Array of length GW*GH.
// Values: 0=empty 1=res 2=com 3=off 4=park 5=water
export async function buildGrid(ways, onProgress) {
  const grid = new Uint8Array(GW * GH);
  const total = ways.length;

  for (let i = 0; i < total; i++) {
    // Yield to the UI every 200 polygons
    if (i % 200 === 0) {
      onProgress && onProgress(i / total);
      await new Promise(r => setTimeout(r, 0));
    }

    const { type, coords } = ways[i];
    const typeCode = TYPE_CODE[type];
    if (!typeCode) continue;

    // Convert geo coords to floating-point grid coords
    const pts = coords.map(c => lonLatToGrid(c.lon, c.lat));

    // Ensure polygon is closed
    const first = pts[0], last = pts[pts.length - 1];
    if (first.col !== last.col || first.row !== last.row) {
      pts.push({ ...first });
    }

    rasterizePolygon(grid, typeCode, pts);
  }

  return grid;
}

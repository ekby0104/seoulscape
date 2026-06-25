import { GW, GH, lonLatToGrid } from './seoulGeo.js';

const TYPE_CODE = { res: 1, com: 2, off: 3, park: 4, water: 5 };

// ── Han River stamp ───────────────────────────────────────────────────────────
// Paints a thick water stroke along a centerline so the river is always visible.
// Also sets the mask so the stamped cells render even if outside the boundary fill.
export function stampRiver(grid, mask, centerline, halfWidth = 1.7) {
  const pts = centerline.map(c => lonLatToGrid(c.lon, c.lat));
  const r = Math.ceil(halfWidth);
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s], b = pts[s + 1];
    const dist = Math.hypot(b.col - a.col, b.row - a.row);
    const steps = Math.max(1, Math.ceil(dist * 2));
    for (let t = 0; t <= steps; t++) {
      const cc = a.col + ((b.col - a.col) * t) / steps;
      const cr = a.row + ((b.row - a.row) * t) / steps;
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (dc * dc + dr * dr > halfWidth * halfWidth) continue;
          const col = Math.round(cc + dc), row = Math.round(cr + dr);
          if (col < 0 || col >= GW || row < 0 || row >= GH) continue;
          const idx = row * GW + col;
          grid[idx] = 5;       // water
          if (mask) mask[idx] = 1;
        }
      }
    }
  }
}

// ── Scanline polygon fill ─────────────────────────────────────────────────────
function scanFill(target, typeCode, pts, minValue = 0) {
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
        if (target[idx] > minValue) target[idx] = typeCode; // mask: overwrite any value > minValue
        else if (target[idx] < typeCode) target[idx] = typeCode; // grid: priority-based overwrite
      }
    }
  }
}

// ── Boundary mask ─────────────────────────────────────────────────────────────
// Returns Uint8Array: 1 = inside Seoul, 0 = outside.
export async function buildBoundaryMask(ring) {
  const mask = new Uint8Array(GW * GH);
  if (!ring || ring.length < 3) {
    mask.fill(1); // fallback: everything is "inside"
    return mask;
  }
  const pts = ring.map(c => lonLatToGrid(c.lon, c.lat));
  // Temporarily use 255 to mark inside, then normalise to 1
  const tmp = new Uint8Array(GW * GH);
  scanFillMask(tmp, 255, pts);
  for (let i = 0; i < tmp.length; i++) mask[i] = tmp[i] ? 1 : 0;
  return mask;
}

function scanFillMask(target, val, pts) {
  let minRow = GH, maxRow = 0;
  for (const p of pts) {
    if (p.row < minRow) minRow = p.row;
    if (p.row > maxRow) maxRow = p.row;
  }
  minRow = Math.max(0, Math.floor(minRow));
  maxRow = Math.min(GH - 1, Math.ceil(maxRow));
  const n = pts.length;
  for (let row = minRow; row <= maxRow; row++) {
    const xs = [];
    for (let i = 0; i < n - 1; i++) {
      const { col: x1, row: y1 } = pts[i];
      const { col: x2, row: y2 } = pts[i + 1];
      if ((y1 <= row && y2 > row) || (y2 <= row && y1 > row))
        xs.push(x1 + ((row - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c1 = Math.max(0, Math.ceil(xs[k]));
      const c2 = Math.min(GW - 1, Math.floor(xs[k + 1]));
      for (let col = c1; col <= c2; col++) target[row * GW + col] = val;
    }
  }
}

// ── Landuse grid rasterisation ────────────────────────────────────────────────
// Returns Uint8Array: 0=empty 1=res 2=com 3=off 4=park 5=water
export async function buildGrid(ways, onProgress) {
  const grid = new Uint8Array(GW * GH);
  const total = ways.length;

  for (let i = 0; i < total; i++) {
    if (i % 200 === 0) {
      onProgress && onProgress(i / total);
      await new Promise(r => setTimeout(r, 0));
    }
    const { type, coords } = ways[i];
    const typeCode = TYPE_CODE[type];
    if (!typeCode || !coords || coords.length < 3) continue;

    const pts = coords.map(c => lonLatToGrid(c.lon, c.lat));
    const first = pts[0], last = pts[pts.length - 1];
    if (first.col !== last.col || first.row !== last.row) pts.push({ ...first });

    rasterizePoly(grid, typeCode, pts);
  }
  return grid;
}

function rasterizePoly(grid, typeCode, pts) {
  let minRow = GH, maxRow = 0;
  for (const p of pts) {
    if (p.row < minRow) minRow = p.row;
    if (p.row > maxRow) maxRow = p.row;
  }
  minRow = Math.max(0, Math.floor(minRow));
  maxRow = Math.min(GH - 1, Math.ceil(maxRow));
  const n = pts.length;
  for (let row = minRow; row <= maxRow; row++) {
    const xs = [];
    for (let i = 0; i < n - 1; i++) {
      const { col: x1, row: y1 } = pts[i];
      const { col: x2, row: y2 } = pts[i + 1];
      if ((y1 <= row && y2 > row) || (y2 <= row && y1 > row))
        xs.push(x1 + ((row - y1) / (y2 - y1)) * (x2 - x1));
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

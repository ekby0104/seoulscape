import { ctx, state } from './context.js';
import { GRID, TYPES, districtIndex, inBounds } from './constants.js';
import { rebuildBuilding } from './buildings.js';
import { subwayNear } from './subway.js';
import { updateHUD } from './hud.js';

function nearRoad(i, j) {
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di,
      nj = j + dj;
    if (inBounds(ni, nj) && ctx.tiles[ni][nj].type === 'road') return true;
  }
  return false;
}
function parkNear(i, j) {
  for (let di = -2; di <= 2; di++)
    for (let dj = -2; dj <= 2; dj++) {
      const ni = i + di,
        nj = j + dj;
      if (inBounds(ni, nj) && ctx.tiles[ni][nj].type === 'park') return true;
    }
  return false;
}

export function tick() {
  const tiles = ctx.tiles;
  let housing = 0,
    jobs = 0,
    maint = 0,
    buildings = 0;
  let resTiles = [],
    comTiles = [],
    offTiles = [],
    parkBonus = 0,
    subwayResCount = 0;
  const dHousing = [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      const t = tiles[i][j];
      if (t.type === 'empty' || t.type === 'water') continue;
      maint += TYPES[t.type].maint;
      if (t.type !== 'road') buildings++;
      if (t.type === 'res') {
        const h = t.level * 55;
        housing += h;
        resTiles.push([i, j]);
        const d = districtIndex(i, j);
        if (d >= 0) dHousing[d] += h;
        if (parkNear(i, j)) parkBonus += 4;
        if (subwayNear(i, j)) subwayResCount++;
      }
      if (t.type === 'com') {
        jobs += t.level * 28;
        comTiles.push([i, j]);
      }
      if (t.type === 'off') {
        jobs += t.level * 40;
        offTiles.push([i, j]);
      }
    }
  // 지하철역 유지비
  maint += ctx.stations.length * TYPES.subway.maint;

  const needHousing = jobs * 1.4 > housing,
    needJobs = housing > jobs * 1.4;
  function grow(list, want) {
    for (const [i, j] of list) {
      const t = tiles[i][j];
      if (t.level >= 5 || !nearRoad(i, j)) continue;
      let p = want ? 0.35 : 0.1;
      if (subwayNear(i, j)) p += 0.18; // 역세권 성장 보너스
      if (Math.random() < p) {
        t.level++;
        rebuildBuilding(i, j);
      }
    }
  }
  grow(resTiles, needHousing);
  grow(comTiles, needJobs);
  grow(offTiles, needJobs);

  const targetPop = Math.min(housing, jobs / 0.5 + 80);
  state.pop += Math.round((targetPop - state.pop) * 0.25);
  if (state.pop < 0) state.pop = 0;
  const workers = state.pop * 0.55,
    employed = Math.min(workers, jobs);
  state.emp = workers > 0 ? Math.round((employed / workers) * 100) : 0;
  const tax = Math.round(state.pop * 0.45 + employed * 0.6);
  state.money += tax - maint;

  let hap = 60;
  hap += (state.emp - 70) * 0.4;
  hap += Math.min(parkBonus, 25);
  hap += Math.min(subwayResCount * 2, 20); // 역세권 행복 보너스
  if (state.money < 0) hap -= 25;
  if (jobs < housing * 0.4) hap -= 10;
  state.hap = Math.max(0, Math.min(100, Math.round(hap)));
  state.bld = buildings;
  state.day++;

  // 자치구 라벨 갱신
  const totalH = housing || 1;
  ctx.labelSprites.forEach((lab, idx) => {
    const p = Math.round((dHousing[idx] / totalH) * state.pop);
    lab.set(lab.name, p);
  });

  updateHUD();
}

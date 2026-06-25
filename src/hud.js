import { ctx, state } from './context.js';
import { TYPES } from './constants.js';

function fmt(n) {
  return n.toLocaleString('ko-KR');
}

export function updateHUD() {
  document.getElementById('s-day').textContent = state.day + '일차';
  document.getElementById('s-pop').textContent = fmt(Math.round(state.pop));
  document.getElementById('s-money').textContent = '₩' + fmt(Math.round(state.money));
  document.getElementById('s-emp').textContent = state.emp + '%';
  document.getElementById('s-hap').textContent = state.hap + '%';
  document.getElementById('s-bld').textContent = fmt(state.bld);
  document.getElementById('s-sta').textContent = ctx.stations.length;
  document.getElementById('s-money').style.color = state.money < 0 ? '#ff7b72' : '#7ee787';
}

export function flashMoney() {
  const el = document.getElementById('s-money');
  el.style.transition = 'none';
  el.style.color = '#ff7b72';
  setTimeout(() => {
    el.style.transition = 'color .5s';
    updateHUD();
  }, 120);
}

export function buildPalette() {
  const order = [
    ['road', '도로'],
    ['res', '주거'],
    ['com', '상업'],
    ['off', '업무'],
    ['park', '공원'],
    ['subway', '지하철'],
    ['empty', '철거'],
  ];
  const pal = document.getElementById('palette');
  order.forEach(([key, nm]) => {
    const t = document.createElement('div');
    t.className = 'tool' + (key === ctx.currentTool ? ' active' : '');
    const col = key === 'empty' ? '#8b949e' : '#' + TYPES[key].c.toString(16).padStart(6, '0');
    t.style.setProperty('--c', col);
    const price = key === 'empty' ? '철거' : '₩' + TYPES[key].price;
    t.innerHTML = `<div class="ic"></div><div class="nm">${nm}</div><div class="pr">${price}</div>`;
    t.onclick = () => {
      ctx.currentTool = key;
      document.querySelectorAll('.tool').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
    };
    pal.appendChild(t);
  });
}

export function setupSpeedButtons() {
  document.querySelectorAll('#speed button').forEach((b) => {
    b.onclick = () => {
      ctx.speed = parseInt(b.dataset.sp);
      document.querySelectorAll('#speed button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
  });
}

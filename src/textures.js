import * as THREE from 'three';

// 캔버스로 창문 패턴 텍스처를 생성합니다.
function windowTexture(bg, win) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, 32, 32);
  x.fillStyle = win;
  for (let yy = 4; yy < 32; yy += 8)
    for (let xx = 4; xx < 32; xx += 8) x.fillRect(xx, yy, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export const TEX = {
  res: windowTexture('#cdd3da', '#8794a3'),
  com: windowTexture('#e9b06b', '#b56b2e'),
  off: windowTexture('#26303d', '#6fa8e8'),
};

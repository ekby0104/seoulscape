// Simplified Seoul administrative boundary (~40 key waypoints, CCW winding).
// Used as fallback when Overpass boundary fetch fails.
export const SEOUL_FALLBACK_RING = [
  { lon: 126.7342, lat: 37.5060 },
  { lon: 126.7342, lat: 37.5600 },
  { lon: 126.7410, lat: 37.6100 },
  { lon: 126.7600, lat: 37.6500 },
  { lon: 126.7900, lat: 37.6750 },
  { lon: 126.8200, lat: 37.6900 },
  { lon: 126.8600, lat: 37.7051 },
  { lon: 126.9100, lat: 37.7151 },
  { lon: 126.9700, lat: 37.7100 },
  { lon: 127.0100, lat: 37.7050 },
  { lon: 127.0600, lat: 37.6850 },
  { lon: 127.0900, lat: 37.6600 },
  { lon: 127.1300, lat: 37.6400 },
  { lon: 127.1700, lat: 37.6150 },
  { lon: 127.1832, lat: 37.5800 },
  { lon: 127.1832, lat: 37.5400 },
  { lon: 127.1650, lat: 37.5050 },
  { lon: 127.1400, lat: 37.4800 },
  { lon: 127.1100, lat: 37.4650 },
  { lon: 127.0650, lat: 37.4450 },
  { lon: 127.0200, lat: 37.4280 },
  { lon: 126.9700, lat: 37.4133 },
  { lon: 126.9200, lat: 37.4180 },
  { lon: 126.8800, lat: 37.4350 },
  { lon: 126.8400, lat: 37.4400 },
  { lon: 126.8000, lat: 37.4550 },
  { lon: 126.7700, lat: 37.4750 },
  { lon: 126.7500, lat: 37.4900 },
  { lon: 126.7342, lat: 37.5060 },
];

// Han River centerline through Seoul (E → W). Rasterized as a thick water stroke
// so the river is always visible on first load, even if OSM water fetch is sparse.
export const HAN_RIVER = [
  { lon: 127.1832, lat: 37.5680 }, // east entry (Gangdong/Misa)
  { lon: 127.1400, lat: 37.5520 },
  { lon: 127.1050, lat: 37.5180 }, // Jamsil / Lotte Tower
  { lon: 127.0700, lat: 37.5240 }, // Ttukseom / Seoul Forest
  { lon: 127.0300, lat: 37.5230 },
  { lon: 127.0000, lat: 37.5160 }, // Banpo
  { lon: 126.9650, lat: 37.5170 }, // Yongsan
  { lon: 126.9350, lat: 37.5250 }, // Yeouido
  { lon: 126.9000, lat: 37.5470 }, // Mapo / Hapjeong (bend north)
  { lon: 126.8650, lat: 37.5660 }, // Gangseo
  { lon: 126.8200, lat: 37.5790 },
  { lon: 126.7700, lat: 37.5820 }, // west exit (Haengju)
];

// Key Seoul landmarks: [{name, lat, lon, color}]
export const LANDMARKS = [
  { name: 'N서울타워',    lat: 37.5511, lon: 126.9882, color: 0xffffff, h: 4.0 },
  { name: '경복궁',       lat: 37.5796, lon: 126.9770, color: 0xff4444, h: 1.5 },
  { name: '63빌딩',       lat: 37.5196, lon: 126.9401, color: 0xffd700, h: 3.5 },
  { name: '롯데월드타워', lat: 37.5126, lon: 127.1025, color: 0xffd700, h: 5.0 },
  { name: '코엑스',       lat: 37.5127, lon: 127.0590, color: 0x88aaff, h: 2.0 },
  { name: '여의도공원',   lat: 37.5245, lon: 126.9240, color: 0x44cc44, h: 1.2 },
];

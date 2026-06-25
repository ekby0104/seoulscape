# 서울 시티빌더 (Seoulscape)

Three.js 로 만든 모바일 친화적 3D 도시 건설 시뮬레이션입니다. 한강이 가로지르는 30×30 격자 위에 도로·주거·상업·업무·공원·지하철을 배치하며 6개 자치구를 키워 나갑니다. 🚇 역세권은 주변 건물의 성장과 시민 행복도를 높여 줍니다.

## 기능

- **6종 건설 도구** — 도로 / 주거 / 상업 / 업무 / 공원 / 지하철, 그리고 철거
- **자동 성장 시뮬레이션** — 주거·일자리 수급에 따라 건물이 레벨업하며 인구·고용·행복·자금이 변동
- **지하철 노선** — 역을 설치하면 자동으로 노선이 연결되고 역세권 성장/행복 보너스 적용
- **자치구 라벨** — 마포·종로·성동·영등포·강남·송파 구별 인구를 실시간 표시
- **OrbitControls 카메라** — 드래그 회전, 휠/핀치 확대, 두 손가락 패닝
- **속도 조절** — 일시정지 / 1× / 3× / 10×

## 조작법

| 입력 | 동작 |
| --- | --- |
| 드래그 | 시점 회전 |
| 휠 / 두 손가락 핀치 | 확대·축소 |
| 두 손가락 드래그 | 평행 이동(패닝) |
| 도구 선택 후 탭/클릭 | 해당 타일에 건설 |
| 철거 도구로 탭 | 건물·지하철역 제거 |

## 기술 스택

- [Vite](https://vitejs.dev/) — 개발 서버 & 번들러
- [Three.js](https://threejs.org/) — WebGL 렌더링 / OrbitControls

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드 (dist/)
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 프로젝트 구조

```
.
├── index.html              # Vite 진입 HTML
├── vite.config.js          # base: './' (GitHub Pages 하위 경로 대응)
├── src/
│   ├── main.js             # 초기화 + 애니메이션 루프
│   ├── style.css           # UI 스타일
│   ├── context.js          # 전역 공유 상태(ctx, state)
│   ├── constants.js        # 격자/타입/자치구 상수 & 좌표 유틸
│   ├── textures.js         # 캔버스 기반 창문 텍스처
│   ├── scene.js            # 씬·카메라·렌더러·조명·타일 초기화
│   ├── world.js            # 한강·랜드마크·경계선·자치구 라벨
│   ├── buildings.js        # 건물/플레이트 생성 및 타일 배치
│   ├── subway.js           # 지하철역·노선 로직
│   ├── simulation.js       # 매 tick 경제/성장 시뮬레이션
│   ├── hud.js              # HUD·팔레트·속도 버튼
│   └── controls.js         # OrbitControls + 탭 건설 입력
└── .github/workflows/
    └── deploy.yml          # GitHub Pages 자동 배포
```

## 배포 (GitHub Pages)

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml` 워크플로가 자동으로 빌드 후 GitHub Pages 에 배포합니다.

최초 1회 설정:

1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 변경
2. `main` 브랜치에 푸시(또는 Actions 탭에서 수동 실행)

`vite.config.js` 의 `base: './'` 덕분에 `https://<user>.github.io/seoulscape/` 같은 하위 경로에서도 자산이 정상 로드됩니다.

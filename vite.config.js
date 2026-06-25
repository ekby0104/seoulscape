import { defineConfig } from 'vite';

// 상대 경로(base: './') 를 사용해 GitHub Pages 의 프로젝트 하위 경로
// (예: https://<user>.github.io/seoulscape/) 에서도 자산이 올바르게 로드되도록 합니다.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});

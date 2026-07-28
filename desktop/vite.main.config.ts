import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // 번들하면 동작이 깨진다 — onnxruntime-node가 네이티브 바이너리 경로를
      // 자기 파일 구조 기준으로 해석하기 때문이다. 런타임에 node_modules에서
      // 로드되도록 external로 둔다. forge.config.ts의 asar unpack과 한 쌍이다.
      external: ['@huggingface/transformers', 'onnxruntime-node'],
    },
  },
});

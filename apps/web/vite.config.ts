import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // 不引入 @vitejs/plugin-react：v0.1 只需要 JSX 转换与完整刷新，
  // esbuild 的 automatic runtime 足够，少一个依赖就少一个装不上的风险。
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    // Windows 上编辑器的原子写会让原生 watcher 偶发 EBUSY；开发期用轮询更稳。
    watch: { usePolling: true, interval: 400 },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['@ziban/core'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});

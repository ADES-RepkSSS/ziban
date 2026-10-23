/**
 * 编译 Electron 主进程 / preload 为 CJS。
 *
 * 为什么不直接用 tsc 输出：
 * - 主进程要 bundle @ziban/core 和 pinyin-pro，tsc 不负责打包；
 * - preload 在 sandbox 里必须是单个 CJS 文件；
 * - esbuild 已经是 Vite 的依赖，不引入第二套构建工具。
 *
 * 产物：apps/desktop/dist-electron/main.cjs、preload.cjs
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outdir = path.join(root, 'apps', 'desktop', 'dist-electron');

await build({
  entryPoints: [
    path.join(root, 'apps', 'desktop', 'electron', 'main.ts'),
    path.join(root, 'apps', 'desktop', 'electron', 'preload.ts'),
  ],
  outdir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  // Electron 由运行时提供，不能打进去。
  external: ['electron'],
  logLevel: 'info',
});

console.log(`built desktop main/preload → ${outdir}`);

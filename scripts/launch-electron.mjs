/**
 * 启动 Electron 的小启动器。
 *
 * 为什么需要它：
 * - 某些开发环境（包括本仓库的 DSH 宿主）会全局设置 ELECTRON_RUN_AS_NODE=1；
 *   这时 electron.exe 会以纯 Node 方式运行，require('electron') 只返回一个路径，
 *   主进程第一行就会 `protocol is undefined`。
 * - 这里显式清掉这个变量，再直接启动 electron 二进制，避免污染用户环境。
 *
 * 用法：
 *   node scripts/launch-electron.mjs <app目录> [--ocr-smoke|--ui-smoke]
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const desktop = path.join(root, 'apps', 'desktop');
const requireFromDesktop = createRequire(path.join(desktop, 'package.json'));
const electronPath = requireFromDesktop('electron');

if (typeof electronPath !== 'string') {
  console.error('没有找到 Electron 二进制。请先运行 pnpm install。');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const child = spawn(electronPath, [desktop, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  env,
  windowsHide: false,
});

child.on('error', (error) => {
  console.error(`启动 Electron 失败：${error.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Electron 被信号结束：${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  });
}

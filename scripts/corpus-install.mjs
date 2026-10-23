#!/usr/bin/env node
/**
 * 把 corpus/release 的实验语料复制到字伴的 userData/corpus。
 *
 * 这是显式安装动作，不是自动发布：
 * - 只复制 7 个 release JSON，不复制 workbench/ 审计文件；
 * - 默认覆盖同名文件；应用运行中会 500ms 内热加载；
 * - 想先看路径：加 --dry-run。
 *
 * 用法：
 *   pnpm corpus:install
 *   pnpm corpus:install -- --dry-run
 *   pnpm corpus:install -- --user-data "D:\tmp\ziban-test"
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'corpus', 'release');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userDataArgIndex = args.indexOf('--user-data');
const userData =
  userDataArgIndex >= 0 && args[userDataArgIndex + 1]
    ? path.resolve(args[userDataArgIndex + 1])
    : defaultUserData();

function defaultUserData() {
  // Electron 的 userData 用 productName（字伴），不是包名 @ziban/desktop。
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '字伴');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', '字伴');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), '字伴');
}

if (!existsSync(sourceDir)) {
  console.error(`找不到语料目录：${sourceDir}`);
  process.exit(1);
}
const files = readdirSync(sourceDir).filter((name) => name.endsWith('.json'));
if (files.length === 0) {
  console.error(`语料目录里没有 JSON：${sourceDir}`);
  process.exit(1);
}
const targetDir = path.join(userData, 'corpus');
console.log(`源：${sourceDir}`);
console.log(`目标：${targetDir}`);
console.log(`文件：${files.length} 个`);
if (dryRun) {
  console.log('dry-run：没有写入任何文件。');
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  cpSync(path.join(sourceDir, file), path.join(targetDir, file));
  console.log(`  ✓ ${file}`);
}
console.log(`✓ 已安装 ${files.length} 个语料文件；字伴运行中会在 500ms 内热加载。`);
console.log('  这些是机器审校草稿，不是人工审校内容；小窗会显示“机器审校 · … · 不一定对”。');

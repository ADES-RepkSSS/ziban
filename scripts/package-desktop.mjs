#!/usr/bin/env node
/**
 * 把桌面版打成一个“绿色版”Windows 目录。
 *
 * 这是当前阶段的最小可用打包，不依赖 electron-builder：
 *   release/ziban-win32-x64/字伴.exe
 *   release/ziban-win32-x64/resources/app/...
 *
 * 为什么不用 electron-builder：
 * - 项目还没有签名/公证；先做一个能双击运行的目录，验证路径与资源是否完整；
 * - 正式分发仍应换 electron-builder（NSIS/DMG）+ 签名，见 docs/09。
 *
 * macOS 不能在 Windows 上可靠地“打包”：
 * - .app 的 Info.plist、代码签名、公证、TCC 权限都依赖 macOS；
 * - 在 Windows 上只能复制一个结构目录，无法验证，也不能签名；
 * - 所以本脚本在非 win32 平台直接报错，并给出在 Mac 上的命令。
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const desktop = path.join(root, 'apps', 'desktop');
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));

if (process.platform !== 'win32') {
  console.error(
    '这个脚本只支持在 Windows 上打 Windows 绿色版。macOS 的 .app/DMG 必须在 macOS 上做：\n' +
      '  pnpm install --frozen-lockfile\n' +
      '  pnpm desktop:build\n' +
      '  # 再使用 electron-builder / Xcode 签名与公证\n',
  );
  process.exit(1);
}

const electronPath = createRequire(path.join(desktop, 'package.json'))('electron');
const electronDist = path.dirname(electronPath);
const outRoot = path.join(root, 'release', `ziban-win32-x64`);
const appDir = path.join(outRoot, 'resources', 'app');

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
fs.cpSync(electronDist, outRoot, { recursive: true });

// Electron 默认的 default_app 会让 resources/app 不被当作入口；删掉它。
fs.rmSync(path.join(outRoot, 'resources', 'default_app.asar'), { force: true });

// 应用代码 + preload
fs.mkdirSync(appDir, { recursive: true });
fs.cpSync(path.join(desktop, 'dist-electron'), path.join(appDir, 'dist-electron'), {
  recursive: true,
});
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  `${JSON.stringify(
    {
      name: pkg.name,
      productName: pkg.productName ?? '字伴',
      version: pkg.version,
      description: pkg.description,
      main: 'dist-electron/main.cjs',
    },
    null,
    2,
  )}\n`,
  'utf8',
);

// 运行时资源：web、native、字卡、图标
for (const entry of fs.readdirSync(path.join(desktop, 'resources'))) {
  fs.cpSync(
    path.join(desktop, 'resources', entry),
    path.join(outRoot, 'resources', entry),
    { recursive: true },
  );
}

// 诊断用 OCR 测试图；让打包后的 `Ziban.exe --ocr-smoke` 也能跑。
fs.cpSync(
  path.join(desktop, 'fixtures'),
  path.join(outRoot, 'resources', 'fixtures'),
  { recursive: true },
);

// Electron 的 exe 改名；保留 DLL/资源目录不动。
const exeSource = path.join(outRoot, 'electron.exe');
const exeTarget = path.join(outRoot, '字伴.exe');
const asciiExe = path.join(outRoot, 'Ziban.exe');
fs.renameSync(exeSource, exeTarget);
// ASCII 文件名给 .cmd / 老工具链用；优先硬链接，失败再复制。
try {
  fs.linkSync(exeTarget, asciiExe);
} catch {
  fs.copyFileSync(exeTarget, asciiExe);
}

fs.writeFileSync(
  path.join(outRoot, '启动字伴.cmd'),
  '@echo off\r\ncd /d "%~dp0"\r\nset ELECTRON_RUN_AS_NODE=\r\nstart "" "Ziban.exe"\r\n',
  'utf8',
);
fs.writeFileSync(
  path.join(outRoot, 'README.txt'),
  [
    '字伴 Windows 绿色版（实验）',
    '',
    '双击 Ziban.exe（或 字伴.exe / 启动字伴.cmd）即可运行。',
    '不需要安装；出现 SmartScreen 提示是因为还没有代码签名。',
    '',
    '数据目录：%APPDATA%\\@ziban\\desktop\\',
    '屏幕取词需要 Windows 中文 OCR 语言包，不需要额外授权。',
    'macOS 版本请使用 macOS 机器构建；不能直接用这个 Windows 目录。',
    '',
  ].join('\r\n'),
  'utf8',
);

// 可选：生成 zip，方便拷贝给家人。失败不影响绿色版目录。
const zipPath = path.join(root, 'release', `ziban-win32-x64.zip`);
try {
  fs.rmSync(zipPath, { force: true });
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${path.join(outRoot, '*')}' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: 'inherit' },
  );
} catch (error) {
  console.warn(`zip 没生成（绿色版目录仍可用）：${String(error)}`);
}

console.log(`✓ Windows 绿色版：${outRoot}`);
console.log(`  双击：${asciiExe}`);
console.log(`  压缩包：${fs.existsSync(zipPath) ? zipPath : '（未生成）'}`);

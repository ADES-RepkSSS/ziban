/**
 * 把桌面版运行时需要、但不在 electron/ 源码目录里的资源复制到
 * apps/desktop/resources：
 *
 *   cards.generated.json   本机字卡（由 pnpm content:build 生成）
 *   native/                Windows PowerShell OCR / macOS Swift 源码
 *   web/                   生产构建后的 React 页面（可选，供打包用）
 *
 * 开发时主进程会直接读仓库里的源码路径；这些副本主要给打包/分发作准备，
 * 也让“资源缺失”在打包前就能被发现。
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const desktop = path.join(root, 'apps', 'desktop');
const resources = path.join(desktop, 'resources');

mkdirSync(resources, { recursive: true });

const deck = path.join(root, 'apps', 'web', 'src', 'content', 'cards.generated.json');
if (!existsSync(deck)) {
  console.error('缺少 cards.generated.json，请先运行 pnpm content:build');
  process.exit(1);
}
cpSync(deck, path.join(resources, 'cards.generated.json'));

const nativeSrc = path.join(desktop, 'electron', 'native');
const nativeDst = path.join(resources, 'native');
rmSync(nativeDst, { recursive: true, force: true });
cpSync(nativeSrc, nativeDst, { recursive: true });

// macOS 上如果已经编译过 Vision helper，一并放进 resources/bin，方便打包。
const macBinary = path.join(desktop, 'dist-native', 'ziban-vision-ocr');
if (existsSync(macBinary)) {
  mkdirSync(path.join(resources, 'bin'), { recursive: true });
  cpSync(macBinary, path.join(resources, 'bin', 'ziban-vision-ocr'));
}

const webDist = path.join(root, 'apps', 'web', 'dist');
if (existsSync(webDist)) {
  const webDst = path.join(resources, 'web');
  rmSync(webDst, { recursive: true, force: true });
  cpSync(webDist, webDst, { recursive: true });
}

// 图标（如果存在）也带上，Electron 打包时用。
const icon = path.join(desktop, 'assets', 'icon.png');
if (existsSync(icon)) {
  cpSync(icon, path.join(resources, 'icon.png'));
}

console.log(`desktop resources → ${resources}`);

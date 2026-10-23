# @ziban/desktop

字伴的 Electron 壳：**光标跟随屏幕取词**，不做框选。

- 主进程入口：`electron/main.ts`（esbuild 编译到 `dist-electron/main.cjs`）
- 小窗：`electron/overlay.ts` + `apps/web/src/features/lookup/`
- Windows OCR：`electron/native/windows/ocr-host.ps1`（常驻 PowerShell + WinRT）
- macOS OCR：`electron/native/macos/vision-ocr.swift`（Apple Vision）
- 知识管线：`electron/capabilities/knowledge/`（字卡/语料库/可选大模型）

## 跑起来

```bash
# 在仓库根目录
pnpm install --frozen-lockfile
pnpm desktop:build
pnpm desktop:start
```

**不要直接 `electron .`**：如果环境里有 `ELECTRON_RUN_AS_NODE=1`，Electron 会被当 Node 跑，
主进程第一行就会报 `protocol is undefined`。`scripts/launch-electron.mjs` 会清掉它。

## 冒烟

```bash
pnpm desktop:ocr-smoke     # 只测 OCR 测试图
pnpm desktop:lookup-smoke  # 真实截屏 + 取词
pnpm desktop:hover-smoke   # 光标跟随 + 小窗
pnpm desktop:ui-smoke      # 只渲染小窗
```

Windows 已实测；macOS 的权限、Retina、全屏/双屏验收清单见
[docs/08-screen-lookup.md](../../docs/08-screen-lookup.md)。

## 平台纪律

- 平台判断只在 `electron/capabilities/`；`hover.ts`/`overlay.ts`/UI 不写 `if (platform)`。
- 截图只截光标周围小区域，OCR 后立即删除；不做全屏录制。
- 大模型默认关闭；API Key 只在主进程；默认只发词，发当前行需用户勾选。

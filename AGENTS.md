# AGENTS.md — 给下一位 AI / 维护者

> 最后更新：2026-10-23。项目当前 **v0.1 实验版（Web）**，已开源到 GitHub，Pages 演示站已上线。
> 先读完这份，再按需要读 [docs/07-handoff.md](docs/07-handoff.md)（详细交接）。

## 0. 先读什么

1. **本文件**：操作入口、硬约束、已知坑。
2. [docs/07-handoff.md](docs/07-handoff.md)：完整状态、架构、决策、下一步。
3. [docs/05-experimental-v0.1.md](docs/05-experimental-v0.1.md)：这一版做了什么、没做什么。
4. [docs/00-charter.md](docs/00-charter.md)、[docs/01-ai-content-pipeline.md](docs/01-ai-content-pipeline.md)、[docs/02-corpus-compliance.md](docs/02-corpus-compliance.md)：产品与内容红线。

## 1. 项目一句话

**字伴（Ziban）**：帮不识字的老人用电脑——按一下念字，每天认三个字，看懂屏幕。

目标用户：65–85 岁、识字量 < 500、母语听说完全正常的中文使用者。

## 2. 当前状态（事实）

- 仓库：<https://github.com/ADES-RepkSSS/ziban>
- 演示站：<https://ades-repksss.github.io/ziban/>（GitHub Pages，已部署成功）
- 分支：`main`；远程：`origin` 已配置；Git Credential Manager 已能 push
- 50 张卡 / 8 场景 / 52 张手绘 SVG
- 39 个单元测试；`pnpm check` 全绿
- GitHub Actions：`CI`、`Deploy web demo to GitHub Pages` 均成功
- 内容全部 `status: draft`，未经人工审校，**禁止对外称为正式内容**
- 本地开发服务器当前可能没开；先 `pnpm dev`

## 3. 命令

```bash
cd D:\haness_agent\help_old
pnpm dev                 # http://127.0.0.1:4173
pnpm check               # 内容门禁 + tsc + 39 tests + build + GitHub 文件检查
pnpm content:validate
pnpm content:build
pnpm test
pnpm typecheck
pnpm screenshot          # 需要本机 Edge/Chrome + 已启动 dev server
```

Git：

```bash
git status
git log --oneline -5
git push origin main
```

## 4. 三条不可谈判原则

1. **老人不会被指责。** 文案禁止“错误 / 失败 / 你错了”；朗读失败只说“这次没念出来，再点一下”。
2. **默认不联网。** 不能新增默认 fetch/XHR、广告、账号、埋点、外链。语音默认本机中文声音；在线声音必须用户主动选且标注“在线”。
3. **没有广告、没有内购、没有第三方跳转。** 产品 UI 不放大模型网页/支付/外链。

改这三条要 2/3 维护者同意 + 14 天 RFC；见 [GOVERNANCE.md](GOVERNANCE.md)。

## 5. 代码地图

```text
apps/web/
  src/app/               Router（hash）、ProgressProvider、SpeechProvider、App
  src/capabilities/      SpeechEngine 实现、Explainer、OCR/Page/ASR 契约
  src/features/          welcome / home / learn / library / card / helper / reader / settings
  src/components/        BigButton、CardImage、WordText、Icon、PageHeader、ProgressDots
  src/content/           deck.ts + cards.generated.json（生成物，不手改）
  src/data/articles.ts   4 篇人工撰写示例文章
  src/styles/            tokens/base/components/分页面/responsive
packages/core/           纯函数：types、schedule、text、plainLanguage（+ tests）
content/                 level1.yaml、52 SVG、charset、README
scripts/                 content build/validate、screenshot
tools/                   图片生成、GitHub 素材、检查脚本
docs/                    00–07 设计/交接文档
.github/                 CI、Pages、Dependabot、issue/PR 模板
```

## 6. 关键不变量（改之前先看懂注释）

- **会话**：`packages/core/src/schedule.ts`。`ensureSession()` 同一天必须续上已有会话；已完成会话也保留给“今天认完了”；`completeCard()` 只记“见过”，不记对错；日期用本地日历。
- **语音队列**：`apps/web/src/app/SpeechProvider.tsx`。`generation + segmentToken + watchdog` 三层保护；中文 boundary 不可靠，靠 `buildCharTimings()` 时间轴；不要为了“简化”去掉 token，否则 watchdog 与迟到的 `onend` 会重复推进队列。
- **单卡自动朗读**：`apps/web/src/features/learn/useCardSpeech.ts`。进入 450ms 后念“词 + 释义”，**不自动念例句**；用户点任何字/释义/例句/图片都会取消未触发的自动朗读。
- **内容生成**：`content/cards/level1.yaml` → `scripts/build-content.mjs` → `apps/web/src/content/cards.generated.json`。不要手改生成 JSON；`imageUrl`/`order` 是构建注入字段。
- **路由**：`apps/web/src/app/router.ts` 用 hash，不用 BrowserRouter；为了 GitHub Pages 子路径与 Electron 自定义协议。
- **进度**：只写 `localStorage` key `ziban.progress.v1`；旧数据由 `normalizeProgress()` 兜底。
- **能力层**：平台判断只能在 `apps/web/src/capabilities/`；UI 不直接碰系统 API。
- **内容红线**：释义/例句必须有来源；没有把握的讲解返回 `plain: null`，UI 显示“只会念，还讲不好”，不许编。

## 7. 已知坑

- **PowerShell 控制台会把 UTF-8 中文显示成乱码**（例如 `Get-Content package.json`）。文件本身是 UTF-8；用 read 工具或 Node 验证，不要根据控制台乱码改文件。
- **pnpm 网络很慢**；不要随意 `pnpm add` 大包。`pnpm-workspace.yaml` 里有：
  - `verifyDepsBeforeRun: false`（避免每次 run 前联网检查）
  - `allowBuilds: esbuild: true`
  - `overrides: rollup: 4.64.12`（与 lockfile 一致，升级 Vite/rollup 时一起改）
  - `pnpm install --frozen-lockfile --offline` 已通过；CI 用 frozen lockfile。
- **Vite dev watcher 在 Windows 会偶发 EBUSY**；`vite.config.ts` 用了 polling，别删。
- **没有 `@vitejs/plugin-react`**：用 esbuild 的 automatic JSX；没有 Fast Refresh，改动整页刷新。加插件会引入 Babel 依赖，非必要。
- **`tsc` 排除了 `*.test.ts`**；测试类型由 Vitest 运行，不要以为 tsc 通过就等于测试通过。
- **截图素材**：`screenshots/` 被 gitignore；README 用的是 `docs/assets/*.png`。重生成：
  `pnpm dev` 后 `pnpm screenshot`，再 `python tools/make_github_assets.py`（Windows 字体路径写死，macOS 需改）。
- **Dependabot** 会自动开 action/npm 更新 PR；有些 update 任务会显示在 Actions 里，正常。

## 8. 下一步优先级

1. **真人可用性测试**：3–5 位老人，无指导试“第一次查字 / 再念一遍 / 粘贴一段字”，记录卡点；先修阻塞，不加功能。
2. **内容审校**：50 张卡走 C5 对抗审校 + 人工；补 `source_ref`；图片从手绘过渡到可授权实拍/检索图。
3. **语音质量**：系统 TTS 只是 v0.1 兜底；接 sherpa-onnx + 中文 VITS，保持 `SpeechEngine` 接口与逐字高亮。
4. **Electron + 屏幕 OCR**：热键 → 框选 → 系统 OCR → 朗读；把 `ScreenReader` 契约落地。注意 Electron 用自定义协议加载 `dist`，不要 `file://`。
5. **任意网页正文 / 跟读**：分别实现 `PageReader`、`PronunciationCoach`；跟读优先“回声 + 声调”，不要直接判“你读错了”。
6. **无障碍**：补 axe-core 自动检查；真机 1024×768 / 1280×800；确保 88×88、对比度 7:1。

## 9. 不要做

- 不要引入默认联网、广告、账号、支付、统计、第三方跳转。
- 不要把未审校内容标成 `published` 或“正式版”。
- 不要把 NC/许可不明的图片、模型、语音权重提交进主仓库。
- 不要在没有来源的情况下让模型“补”释义/例句/文章解释。
- 不要用“错误/失败/你错了/不对”指责用户。
- 不要为了好看降低字号/对比度/点击区域。
- 不要把 `node_modules`、`dist`、`screenshots`、`tools/output`、`.env` 提交。

## 10. 交接时

- 先 `git pull`，再 `pnpm install --frozen-lockfile`、`pnpm check`。
- 看 [docs/07-handoff.md](docs/07-handoff.md) 的“当前快照”和“已知问题”。
- 改完更新 [CHANGELOG.md](CHANGELOG.md) 的 `Unreleased`。
- 提交用 `git commit -s`（DCO）；推送后看 CI。
- 如果改了内容/能力边界，一起更新 `docs/05` 或 `docs/07`，别让文档撒谎。

## 11. 联系方式

- 仓库 Issues / Discussions：<https://github.com/ADES-RepkSSS/ziban/issues>
- 安全问题：按 [SECURITY.md](SECURITY.md) 私密报告，不要开公开 issue。

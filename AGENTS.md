# AGENTS.md — 给下一位 AI / 维护者

> 最后更新：2026-10-24。项目当前 **v0.2.1 桌面取词完整版（Windows 实测 / macOS CI 编译识别通过、真机待验收）**，
> 已开源到 GitHub，Pages 演示站已上线。
> 先读完这份，再按需要读 [docs/07-handoff.md](docs/07-handoff.md)（详细交接）。

## 0. 先读什么

1. **本文件**：操作入口、硬约束、已知坑。
2. [docs/07-handoff.md](docs/07-handoff.md)：完整状态、架构、决策、下一步。
3. [docs/08-screen-lookup.md](docs/08-screen-lookup.md)：光标跟随取词、Windows/macOS 实现、权限、真机清单。
4. [docs/05-experimental-v0.1.md](docs/05-experimental-v0.1.md)：Web v0.1 做了什么、没做什么。
5. [docs/00-charter.md](docs/00-charter.md)、[docs/01-ai-content-pipeline.md](docs/01-ai-content-pipeline.md)、[docs/02-corpus-compliance.md](docs/02-corpus-compliance.md)：产品与内容红线。
6. [docs/11-corpus-batch1-handoff.md](docs/11-corpus-batch1-handoff.md)：第一批 293 条语料的复盘、坑与下一批顺序。
7. [docs/12-cloud-tts.md](docs/12-cloud-tts.md)：可选云端 TTS（文字转语音）的 API Key、接口、隐私与验收。

## 1. 项目一句话

**字伴（Ziban）**：把查字典简化成“停一下”——老人看得懂屏幕，孩子在探索里认字。

当前从老人场景开始：65–85 岁、识字量 < 500、母语听说完全正常的中文使用者。
长期要验证“先使用、后识字”的学习范式，面向识字阶段儿童；**儿童场景是方向与假设，当前没有儿童专用功能，也不做课程/积分/排行榜/家长监控。**

## 2. 当前状态（事实）

- 仓库：<https://github.com/ADES-RepkSSS/ziban>
- 演示站：<https://ades-repksss.github.io/ziban/>（GitHub Pages，已部署成功）
- 分支：`main`；远程：`origin` 已配置；Git Credential Manager 已能 push
- 50 张卡 / 8 场景 / 52 张手绘 SVG
- 67 个单元测试；`pnpm check` 全绿（含语料硬 lint）
- 实验语料库第一批 293 条（7 个文件，全部 `source=auto-*`，**机器审校草稿，未人工审校**）；见 [corpus/RELEASE.md](corpus/RELEASE.md)
- 可选**云端文本转语音**：设置里填 OpenAI 兼容 `/audio/speech` 的 API Key；默认关，打开后文字才发到用户选的服务，音频不落盘；见 [docs/12](docs/12-cloud-tts.md)
- 桌面版 `apps/desktop`：Electron 40 + esbuild；Windows WinRT OCR 实测；macOS `screencapture` + Vision 待真机
- GitHub Actions：`CI`、`Deploy web demo to GitHub Pages`、`Desktop macOS OCR`（编译/识别测试图）
- 字卡 50 张、屏幕语料 293 条全部是 draft/机器审校草稿，**未经人工审校，禁止对外称为正式内容**
- 定位：当前以老人场景为重点；儿童识字场景是长期方向，未做真实验证，禁止对外说成“儿童产品”
- 本地开发服务器当前可能没开；先 `pnpm dev`

## 3. 命令

```bash
cd D:\haness_agent\help_old
pnpm dev                 # http://127.0.0.1:4173
pnpm check               # 内容门禁 + 语料 lint + tsc + 67 tests + build + GitHub 文件检查
pnpm content:validate
pnpm corpus:validate path/to/corpus.json  # 外部语料库格式检查
pnpm corpus:lint         # 语料硬 lint（corpus/release/*.json）
pnpm corpus:review       # 合并评审记录 → corpus/workbench/<batch>/review.jsonl
pnpm corpus:build        # 只把 final=release 写进 corpus/release
pnpm corpus:metrics      # 每批 metrics.md
pnpm corpus:install      # 把 7 个 release JSON 装到 userData/corpus（显式动作）
pnpm content:build
pnpm test
pnpm typecheck
pnpm screenshot          # 需要本机 Edge/Chrome + 已启动 dev server

# 桌面版（Windows 已实测；macOS 见 docs/08）
pnpm desktop:build       # Web + 主进程 + 资源
pnpm desktop:start       # 用 launch-electron.mjs 启动（会清 ELECTRON_RUN_AS_NODE）
pnpm desktop:package     # Windows 免安装绿色版（release/ziban-win32-x64）
pnpm desktop:ocr-smoke   # OCR 测试图
pnpm desktop:lookup-smoke# 真实截屏 + 取词
pnpm desktop:hover-smoke # 光标跟随 + 小窗
pnpm desktop:ui-smoke    # 只渲染小窗
```

Git：

```bash
git status
git log --oneline -5
git push origin main
```

## 4. 三条不可谈判原则

1. **老人不会被指责。** 文案禁止“错误 / 失败 / 你错了”；朗读失败只说“这次没念出来，再点一下”。
2. **默认不联网。** 默认例外只有 GitHub 公开版本检查（可在设置关闭）；不能新增其他默认 fetch/XHR、广告、账号、埋点、外链。语音默认本机中文声音；云端 TTS 必须用户自己填 API Key 并显式打开，才把要念的文字发到用户选的服务。
3. **没有广告、没有内购、没有第三方跳转。** 产品 UI 不放大模型网页/支付/外链。

改这三条要 2/3 维护者同意 + 14 天 RFC；见 [GOVERNANCE.md](GOVERNANCE.md)。

## 5. 代码地图

```text
apps/web/
  src/app/               Router（hash）、ProgressProvider、SpeechProvider、App
  src/capabilities/      SpeechEngine 实现、Explainer、OCR/Page/ASR 契约、desktop 桥探测
  src/features/          welcome / home / learn / library / card / helper / lookup / screen / update / reader / settings
  src/components/        BigButton、CardImage、WordText、Icon、PageHeader、ProgressDots
  src/content/           deck.ts + cards.generated.json（生成物，不手改）
  src/data/articles.ts   4 篇人工撰写示例文章
  src/styles/            tokens/base/components/分页面/responsive
apps/desktop/
  electron/main.ts       生命周期、窗口、托盘、快捷键、IPC、smoke
  electron/preload.ts    白名单 contextBridge
  electron/hover.ts      光标停稳/去重/错误退避
  electron/overlay.ts    小窗定位/显隐/内容保护
  electron/capabilities/screen/   ScreenEngine：Windows PowerShell / macOS Vision
  electron/capabilities/knowledge/ 字卡/语料库/LLM/缓存
  electron/capabilities/speech/ 云端 TTS 请求、超时、端点校验
  electron/native/       ocr-host.ps1、vision-ocr.swift
  fixtures/ocr-sample.png 跨平台 OCR 测试图
packages/core/           纯函数：types、schedule、text、plainLanguage、screen、desktop（+ tests）
content/                 level1.yaml、52 SVG、charset、README
scripts/                 content build/validate、screenshot、corpus lint/review/build/metrics
corpus/                  实验语料（release/ 运行时 JSON、workbench/ 审计、chars/ 用字表）
tools/                   图片生成、GitHub 素材、检查脚本
docs/                    00–12 设计/交接文档（08 = 屏幕取词，09 = 部署与使用，10 = 语料库格式，11 = 第一批语料复盘，12 = 云端 TTS）
.github/                 CI、Pages、Dependabot、issue/PR 模板
```

## 6. 关键不变量（改之前先看懂注释）

- **会话**：`packages/core/src/schedule.ts`。`ensureSession()` 同一天必须续上已有会话；已完成会话也保留给“今天认完了”；`completeCard()` 只记“见过”，不记对错；日期用本地日历。
- **语音队列**：`apps/web/src/app/SpeechProvider.tsx`。`generation + segmentToken + watchdog` 三层保护；中文 boundary 不可靠，靠 `buildCharTimings()` 时间轴；不要为了“简化”去掉 token，否则 watchdog 与迟到的 `onend` 会重复推进队列。
- **单卡自动朗读**：`apps/web/src/features/learn/useCardSpeech.ts`。进入 450ms 后念“词 + 释义”，**不自动念例句**；用户点任何字/释义/例句/图片都会取消未触发的自动朗读。
- **内容生成**：`content/cards/level1.yaml` → `scripts/build-content.mjs` → `apps/web/src/content/cards.generated.json`。不要手改生成 JSON；`imageUrl`/`order` 是构建注入字段。
- **路由**：`apps/web/src/app/router.ts` 用 hash，不用 BrowserRouter；为了 GitHub Pages 子路径与 Electron 自定义协议。
- **进度**：只写 `localStorage` key `ziban.progress.v1`；旧数据由 `normalizeProgress()` 兜底。
- **能力层**：平台判断只能在 `apps/web/src/capabilities/`；UI 不直接碰系统 API。桌面版同理，平台判断只在 `apps/desktop/electron/capabilities/`。
- **屏幕取词**：不做全屏录制/框选。`hover.ts` 光标停稳 380ms 才截自适应小区域（工作区宽约 26%，260–420 DIP）；OCR 后立即删图；小窗 `setContentProtection`；不要把轮询间隔改到 100ms 以下。
- **屏幕权限**：macOS 只需要“屏幕录制”（不需要辅助功能）；必须在用户点击的同一调用栈里触发；拒绝后只能引导去系统设置，不能静默重试刷屏。
- **知识优先级**：字卡 > `userData/corpus` > 本机词表 > 大模型补缺；模型不得覆盖人工释义；生成内容必须 `generated=true`，UI 标“不一定对”。
- **云端 TTS**：默认关；密钥只在主进程，渲染层只知道 `hasApiKey`；只把要念的文字发给用户配置的 https 服务；不落盘、不自动回退、不重试轰炸；打开后所有朗读（含屏幕取词自动念）都走云端。
- **默认不联网**：大模型默认关闭；没有密钥/开关时一个请求都不发；版本检查只读 GitHub 公共信息、可关、缓存 24h；API Key 只在主进程，渲染层只能看到 `hasApiKey`。
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
- **`ELECTRON_RUN_AS_NODE=1`**：本机 DSH 环境全局设了它；直接 `electron .` 会把 Electron 当 Node，`require('electron').protocol` 是 undefined。必须用 `pnpm desktop:start`（会清掉）。
- **Windows PowerShell 5.1 读无 BOM UTF-8 会按 GBK 解码**：`ocr-host.ps1` 由 Node 复制到临时目录并加 BOM 再执行；不要直接 `-File` 源文件。
- **macOS Vision helper 需要 Xcode CLI Tools**：首次运行 `xcrun swiftc` 编译；发布前要预编译 universal 二进制，见 docs/08。
- **屏幕截图不落盘**：临时 PNG 在 OCR 后立即删除；不要为了调试保留历史帧。
- **小窗高度**：带风险提示约 400×517 DIP；800×600 屏会内部滚动，尚未真人测试。

## 8. 下一步优先级

1. **真人可用性测试**：3–5 位老人，无指导试“第一次查字 / 再念一遍 / 粘贴一段字”，记录卡点；先修阻塞，不加功能。
2. **内容审校**：50 张卡走 C5 对抗审校 + 人工；补 `source_ref`；图片从手绘过渡到可授权实拍/检索图。
3. **语音质量**：系统 TTS 只是默认兜底；云端 TTS 已可作为可选引擎（自己填 Key），保持 `SpeechEngine` 接口与逐字高亮；以后可接本地 sherpa-onnx + 中文 VITS。
4. **macOS 真机验收屏幕取词**：按 [docs/08](docs/08-screen-lookup.md) 第 6.6 节跑 TCC/Retina/全屏/双屏；预编译 universal Vision helper；再做签名/公证。
5. **语料库审校**：第一批 293 条已产出（机器审校草稿），已 `corpus:install` 到真实 userData；下一步补三审、逐词 evidence、真人复核，并核对小窗来源标签/热加载。
6. **任意网页正文 / 跟读**：分别实现 `PageReader`、`PronunciationCoach`；跟读优先“回声 + 声调”，不要直接判“你读错了”。
7. **无障碍**：补 axe-core 自动检查；真机 1024×768 / 1280×800；确保 88×88、对比度 7:1。

## 9. 不要做

- 不要引入其他默认联网、广告、账号、支付、统计、第三方跳转；版本检查是唯一例外，必须可关。
- 不要把未审校内容标成 `published` 或“正式版”。
- 不要把 NC/许可不明的图片、模型、语音权重提交进主仓库。
- 不要在没有来源的情况下让模型“补”释义/例句/文章解释。
- 不要用“错误/失败/你错了/不对”指责用户。
- 不要为了好看降低字号/对比度/点击区域。
- 不要做全屏录屏/持续截图；只截光标周围小区域，OCR 后删图。
- 不要把儿童场景做成课程/积分/排行榜/打卡/家长监控；不要在孩子身上做未同意的测试。
- 不要把“孩子会因探索欲主动认字”当成已验证事实对外宣传；它是待验证假设。
- 不要把截图、API Key、`dist-electron`、`resources`、`dist-native` 提交。
- 不要把 `node_modules`、`dist`、`screenshots`、`tools/output`、`.env` 提交。

## 10. 交接时

- 先 `git pull`，再 `pnpm install --frozen-lockfile`、`pnpm check`。
- 看 [docs/07-handoff.md](docs/07-handoff.md) 的“当前快照”和“已知问题”；屏幕取词看 [docs/08](docs/08-screen-lookup.md)，部署/使用看 [docs/09](docs/09-deploy-and-use.md)。
- 改完更新 [CHANGELOG.md](CHANGELOG.md) 的 `Unreleased`。
- 提交用 `git commit -s`（DCO）；推送后看 CI。
- 如果改了内容/能力边界，一起更新 `docs/05` 或 `docs/07`，别让文档撒谎。

## 11. 联系方式

- 仓库 Issues / Discussions：<https://github.com/ADES-RepkSSS/ziban/issues>
- 安全问题：按 [SECURITY.md](SECURITY.md) 私密报告，不要开公开 issue。

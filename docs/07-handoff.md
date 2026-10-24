# 07 · 交接说明（给下一位 AI / 维护者）

> 写于 2026-10-24。项目当前是 **v0.2.1 桌面取词完整版**：网页演示已上线，Windows 绿色版已发布。
> `apps/desktop` 已有 Electron 壳与“光标跟随取词”（不做框选）。
> Windows 已实测；macOS CI 已编译 Vision helper 并识别测试图，**真机 TCC/Retina 仍待验收**。屏幕取词的完整方案、权限、
> 真机清单见 [docs/08-screen-lookup.md](08-screen-lookup.md)；部署与使用见
> [docs/09-deploy-and-use.md](09-deploy-and-use.md)；本文件第 1/2/4/5/6/8/9 节已同步。
> 操作速查见根目录 [AGENTS.md](../AGENTS.md)。

## 1. 当前快照

| 项 | 值 |
|---|---|
| 项目 | 字伴（Ziban） |
| 仓库 | <https://github.com/ADES-RepkSSS/ziban> |
| 演示站 | <https://ades-repksss.github.io/ziban/>（已验证 HTTP 200） |
| 分支 | `main`，`origin` 已配置 |
| 最近提交（交接前） | `49351fb fix: track corpus/release runtime JSON`；云端 TTS 改动见本次提交 |
| 本次变更 | 2026-10-24 工作区：桌面 0.2 光标取词 + 整词切分 + 自适应截图 + 首页工具图 + docs/08/09；语料第一批 293 条 + docs/10/11；可选云端 TTS + docs/12；67 tests |
| 本地路径 | `D:\haness_agent\help_old` |
| 包管理 | pnpm 11.21.0（`packageManager` 已锁定） |
| Node | 本机 24；CI 用 22；`engines` 要求 >=20 |
| 测试 | 67 个 Vitest 测试（新增 21 个屏幕取词纯函数测试 + 4 个语料加载/管线测试 + 3 个云端 TTS 端点测试） |
| 构建 | `pnpm check` 全绿；Web 生产构建约 320 KB JS / 64 KB CSS |
| 桌面版 | `apps/desktop`（Electron 40 + esbuild + PowerShell WinRT / macOS Vision） |
| 版本检查 | 启动 3 秒后只读 GitHub 公共版本信息；可在“设置 → 版本”关闭；只提示链接，不自动更新 |
| Windows 绿色版 | `pnpm desktop:package` → `release/ziban-win32-x64/Ziban.exe` + zip；未签名 |
| 屏幕取词 | Windows 11 本机实测通过（整词取词 + 自适应截图）；macOS 待真机；浏览器仍走粘贴文字 |
| 云端语音 | 可选桌面 TTS：OpenAI 兼容 `/audio/speech`，用户自填 API Key；默认关，音频不落盘；本地 mock 端到端通过，真实服务商 Key 待用户试听 |
| CI | GitHub Actions `CI` 成功（checkout@v7、setup-node@v7、pnpm/action-setup@v6、ubuntu-24.04） |
| Pages | `Deploy web demo to GitHub Pages` 成功；`https://ades-repksss.github.io/ziban/` 可访问 |
| 内容 | 50 张卡、8 场景、52 张 SVG（含 2 张文章图）；全部 `draft`，未审校 |
| 语料库 | 第一批 293 条（7 个文件，`auto-*` 机器审校草稿），未人工审校；见 [docs/11](11-corpus-batch1-handoff.md) |
| 定位 | 当前以老人场景为重点；长期验证“先使用、后识字”的儿童场景（未验证，不对外称儿童产品） |
| 本地 server | 交接时未运行；`pnpm dev` 启动到 `http://127.0.0.1:4173` |
| 用户数据 | Windows `%APPDATA%\字伴\`；macOS `~/Library/Application Support/字伴/` |

> 注意：`https://api.github.com/repos/.../pages` 在未认证请求下曾返回 404，但页面和 Actions 都成功；以实际 URL 与部署 run 为准。

## 2. 这一版到底做了什么

### 基础功能（可用）

- 50 张识字卡：药、医院、挂号、医生、缴费、预约、医保；取钱、存钱、密码、卡、余额、转账、确认、取消；公交、站、地铁、上车、下车、扫码；开、关、大、小、温度、声音；微信、电话、语音、视频、发、红包、消息；身份证、社保、办理、窗口、提交；付款、多少钱、打折、买；验证码、中奖、免费、警察、银行、不要、挂断。
- 图片、大字、口语释义、例句；拼音默认隐藏，仅家人参考，不用于教学。
- 进入卡片自动念“词 + 释义”；点单字只念该字；点释义/例句/图片分别朗读；读词时逐字高亮。
- “慢一点 / 快一点”一键调速；进度点；完成页；可“再认三个”。
- 每天 3 张新卡 + 最多 3 张到期复习；1/3/7/14/30/60 天温和排期；不记对错。
- 首页（看屏幕第一入口 + 三张工具图）/ 字库（按场景、看图找字）/ 设置（语速、声音、拼音、字号、清除记录）；
  首次打开直接进首页，三步欢迎改为底部“怎么用”。
- 本地 `localStorage`；无账号、无广告、无内购、无外链；无默认网络请求（版本检查除外，可关）。

### 附加功能（文本路径可用）

- 粘贴文字逐句朗读 + 当前句高亮；点句只听一句。
- 离线“讲一讲”：词表覆盖验证码、冻结账户、逾期、挂号、诊室、窗口、提交等；没把握返回 `plain: null`，UI 明说“只会念，还讲不好”。
- 风险提示：转账/链接/冻结账户/验证码等组合；剂量描述提醒问医生。
- 4 篇人工文章：医院流程、银行诈骗短信、社区量血压、微信位置权限；每句人工解释 + 三句话摘要。
- 设置页明确标出“能用 / 实验 / 还没做”。

### 桌面版新增：光标跟随取词（0.2 实验）

- 不做“框选 → 截图 → OCR”。打开“看屏幕”后，光标停稳 380ms，只截光标周围自适应小区域（工作区宽约 26%，260–420 DIP）。
- 取词优先整词：词表最长匹配 → `Intl.Segmenter` 中文分词 → 最后才单字；
  “今天很暖和”取“暖和”，不会只取“暖”；OCR smoke 会断言这一点。
- Windows：常驻 PowerShell + `System.Drawing` 截屏 + WinRT `Windows.Media.Ocr` 中文 OCR；
  实测截屏+OCR 20–60ms，整条链路 44–438ms。
- macOS：`/usr/sbin/screencapture -R` + Apple Vision（Swift helper，stdin/stdout）；
  只需要“屏幕录制”权限，不需要辅助功能；helper 首次运行用 Xcode CLT 编译。
- 小窗 400px 宽，显示词/拼音/释义/例句/来源/风险；`setContentProtection` 避免 OCR 自己；
  `showInactive` 不抢焦点。
- 知识优先级：字卡 > 语料库 JSON > 本机词表 > 大模型补缺；语料库目录 `userData/corpus`，
  为后续爬虫留好稳定格式。
- 大模型：OpenAI 兼容、默认关闭、密钥 safeStorage、默认只发词、可选发当前行；7 天缓存。

### 语料库第一批（2026-10-23）

- 7 个主题、293 条屏幕高频词，每条一句口语释义 + 一句生活例句；全部 `source=auto-*`，
  UI 显示“机器审校 · … · 不一定对”，不冒充人工内容。
- 新增 `corpus:lint` / `corpus:review` / `corpus:build` / `corpus:metrics` / `corpus:install` 与 4 条加载/管线测试；
  `CorpusStore` 不再静默截断超 8 字的词。
- **R1 三审没跑完**（C/D 超时），没有人工审校/老人测试；下一批第一件事是补评审。
- 详细交接：[docs/11-corpus-batch1-handoff.md](11-corpus-batch1-handoff.md)。
- 云端 TTS：[docs/12-cloud-tts.md](12-cloud-tts.md)。

### 明确没做

- 任意网址正文抽取、跟读评分。
- macOS DMG / Windows NSIS 安装包 / 自动更新 / 公证（Windows 已有未签名绿色版）。
- 本地大模型；sherpa-onnx / VITS；真人录音。
- PWA / Service Worker 离线缓存。
- 真人可用性测试、正式内容审校、金标准回归集。

## 3. 架构与数据流

```text
content/cards/level1.yaml
  → scripts/build-content.mjs (Zod + 业务门禁 + 复制图片)
  → apps/web/src/content/cards.generated.json + apps/web/public/images
  → apps/web/src/content/deck.ts
  → features/learn · library · card
```

```text
ui speak()
  → SpeechProvider queue (generation + segmentToken + watchdog)
  → capabilities/speech/webSpeech.ts (SpeechSynthesis)
  → boundary 事件校正 / buildCharTimings 时间轴
  → activeSegment + charIndex → WordText / 高亮
```

```text
ProgressProvider
  → localStorage ziban.progress.v1
  → packages/core/schedule.ts (ensureSession / completeCard / startAnotherSession)
```

```text
HelperPage
  → cleanForSpeech / splitForSpeech (core/text)
  → capabilities/explainer (offline glossary)
  → assessRisk / medicalCaution (core/plainLanguage)
  → articles (人工数据)
```

```text
桌面取词（Cursor → 小窗）
  光标停稳 380ms
  → ScreenEngine.captureAtCursor(自适应 260–420 DIP 宽)
      Windows: PowerShell WinRT / macOS: screencapture -R
  → normalizeOcrPage / lookupAtPoint (core/screen.ts)
  → KnowledgeService.localLookup（字卡/语料库/本机词表，立即弹窗）
  → 可选 LLM enrich（只补空缺，标“电脑生成”）
  → IPC → LookupPage（Web Speech 朗读）
```

## 4. 关键文件与职责

| 文件 | 职责 | 改动注意 |
|---|---|---|
| `packages/core/src/schedule.ts` | 会话、间隔、进度归一化 | 纯函数；不要引入 DOM/网络；同一天续会话 |
| `packages/core/src/text.ts` | 切句、TTS 分块、字时长、选中文声音 | `buildCharTimings` 是逐字高亮兜底 |
| `packages/core/src/plainLanguage.ts` | 离线词表、解释、风险/医疗提示 | 不允许编；风险词优先解释 |
| `apps/web/src/app/SpeechProvider.tsx` | 全局语音队列/高亮 | 三层 token 保护，别简化 |
| `apps/web/src/features/learn/useCardSpeech.ts` | 单卡自动朗读/单字/例句 | 用户点击要取消未触发的自动朗读 |
| `apps/web/src/features/learn/LearnPage.tsx` | 会话创建、当前卡、完成 | 不要在 render 里创建会话 |
| `apps/web/src/features/learn/SessionComplete.tsx` | 完成页、再认三个 | 再认三个 = `startAnotherSession` |
| `apps/web/src/app/ProgressProvider.tsx` | localStorage 唯一入口 | update 时立即写盘 |
| `apps/web/src/app/router.ts` | hash 路由 | Pages 子路径 / Electron 自定义协议 |
| `apps/web/src/capabilities/contracts.ts` | OCR/Page/ASR/Explainer 契约 | 新能力先实现契约，不污染 UI |
| `apps/web/src/capabilities/explainer.ts` | 离线讲解实现 | 将来换本地模型只换这里 |
| `apps/web/src/data/articles.ts` | 4 篇人工文章/解释 | 不要模型生成 summary/plain |
| `packages/core/src/screen.ts` | OCR 归一化、光标找字、词表匹配、知识合并 | 纯函数；坐标约定左上角像素 |
| `packages/core/src/desktop.ts` | 主进程 ↔ 渲染层 IPC 类型 | 三处共用，改字段要一起改 |
| `apps/desktop/electron/main.ts` | 桌面生命周期、窗口、托盘、快捷键、IPC、smoke | 平台判断只允许在 capabilities/ |
| `apps/desktop/electron/hover.ts` | 光标停稳/去重/错误退避 | 不要改成高频全屏截图 |
| `apps/desktop/electron/overlay.ts` | 小窗定位/显隐/内容保护 | 不要删 setContentProtection |
| `apps/desktop/electron/capabilities/screen/` | Windows/macOS 截图与 OCR | 新平台实现 ScreenEngine |
| `apps/desktop/electron/capabilities/knowledge/` | 字卡/语料库/LLM/缓存 | 优先级：字卡 > 语料库 > 词表 > LLM |
| `apps/desktop/electron/native/windows/ocr-host.ps1` | 常驻 PowerShell + WinRT OCR | 必须让 Node 复制成 UTF-8 BOM 再执行 |
| `apps/desktop/electron/native/macos/vision-ocr.swift` | Apple Vision OCR helper | 只读 PNG，不碰屏幕权限 |
| `scripts/lib/content.mjs` | 内容构建管线 | 生成 JSON 不手改；图片文件名防穿越 |
| `tools/check-github-files.cjs` | GitHub YAML/内链检查 | 已纳入 `pnpm check` |
| `.github/workflows/ci.yml` | CI | checkout@v7/setup-node@v7/pnpm@v6/ubuntu-24.04 |
| `.github/workflows/pages.yml` | Pages 部署 | configure@v6/upload@v5/deploy@v5 |

## 5. 运行/验证

```bash
cd D:\haness_agent\help_old
pnpm install --frozen-lockfile
pnpm dev
# 浏览器 http://127.0.0.1:4173
```

```bash
pnpm check
# = content:validate + tsc + vitest 60 + build + GitHub 文件检查
```

单独：

```bash
pnpm content:validate
pnpm content:build
pnpm test
pnpm typecheck
pnpm check:github
pnpm screenshot     # 需 dev server + 本机 Edge/Chrome

# 桌面版（Windows 已实测；macOS 见 docs/08）
pnpm desktop:build
pnpm desktop:start
pnpm desktop:ocr-smoke     # OCR 测试图
pnpm desktop:lookup-smoke  # 真实截屏 + 取词
pnpm desktop:hover-smoke   # 光标跟随 + 小窗截图
pnpm desktop:ui-smoke      # 只渲染小窗
```

截图/README 素材：

```bash
pnpm screenshot
python tools/make_github_assets.py
# 生成 docs/assets/*.png 与 social-preview.png
```

> `tools/make_github_assets.py` 里字体路径写死 Windows `C:/Windows/Fonts/msyh*.ttc`；macOS 需改 `FONT_BOLD/FONT_REGULAR`。

## 6. 环境坑（重要）

1. **PowerShell 的 `Get-Content` 会把 UTF-8 中文显示成乱码**（如 package.json 的 description）。文件本身没问题；用 read 工具或 Node 验证。不要按控制台乱码“修”文件。
2. **pnpm 安装很慢**（本机网络）。不要随手 `pnpm add` 大包；装之前先看是否已有替代实现。
3. `pnpm-workspace.yaml` 的配置不要乱删：
   - `verifyDepsBeforeRun: false`：否则 `pnpm run` 可能先联网 install；
   - `allowBuilds: esbuild: true`：Vite 需要 esbuild；
   - `overrides: rollup: 4.64.12`：与锁文件一致；升级 Vite 时一起更新锁文件，否则 `--frozen-lockfile` 会失败。
4. **Vite watcher** 在 Windows 上遇到过 EBUSY；`vite.config.ts` 已用 `usePolling`，别为了性能删掉。
5. **没有 `@vitejs/plugin-react`**：Vite 配置用 esbuild automatic JSX；因此没有 Fast Refresh，改完整页刷新。加插件会带来 Babel 依赖，非必要。
6. **`tsc` 排除了 `*.test.ts`**；Vitest 才能跑测试，别只看 typecheck。
7. **GitHub Actions** 已升级到 Node 24 兼容版本，并固定 `ubuntu-24.04`；不要降回 `ubuntu-latest` 或 v4 action，否则会重新出现 Node20 警告/未来 Ubuntu 26 漂移。
8. **Pages**：Source 必须是 GitHub Actions；仓库里已有 `pages.yml`，不要点 Jekyll/Static HTML 模板。
9. **Dependabot** 会自动开 PR 和 `github_actions ... Update` 任务；正常，不是被攻击。
10. `private: true`，不发布 npm 包；`repository/homepage/bugs` 已指向 GitHub。
11. **`ELECTRON_RUN_AS_NODE=1` 是 Electron 主进程第一号坑**：本机 DSH 环境全局设了它，
    直接 `electron .` 会把 Electron 当 Node 跑，`require('electron').protocol` 是 undefined。
    必须用 `pnpm desktop:start`（`scripts/launch-electron.mjs` 会清掉这个变量）。
12. **Windows PowerShell 5.1 读无 BOM UTF-8 会按 GBK 解码**：`ocr-host.ps1` 源文件保持无 BOM，
    Node 在启动时复制到临时目录并加 BOM；不要改成“直接 -File 源文件”。
13. **macOS Vision helper 需要 Xcode CLI Tools**：首次运行 `xcrun swiftc` 编译；
    发布前要预编译 universal 二进制，见 docs/08 第 12 节。
14. **屏幕截图不保存**：只写 `%TEMP%`/userData tmp，OCR 后立即删；不要为了调试把历史帧留在磁盘。

## 7. 设计决策记录（为什么是这样）

- **Web 优先，不先做 Electron**：docs/00 明确 `apps/web` 是产品本体，桌面壳只注入能力；本轮在 Windows 环境，先保证基础功能与附加文本路径。Electron 兼容点已留：hash 路由、`base: './'`、相对资源、严格 CSP。
- **系统 TTS 先兜底**：Web Speech 在本机 Edge 的 Microsoft Huihui 能出声，逐字高亮可用；正式版计划 sherpa-onnx + VITS，通过 `SpeechEngine` 替换。
- **不用大模型讲解**：为了不编造，v0.1 只做离线词表；没有把握就明说。接本地模型时必须保持“无来源不生成”的约束。
- **手写 50 张卡，不伪装来源**：全部 `dict: self` / `corpus: self`，`draft`；没有冒充维基词典或真实语料。
- **手绘 SVG，不用文生图**：许可干净、可控、图内不出现答案文字；正式版再走“检索 + 排序 + 人选”。
- **不装 `@vitejs/plugin-react`**：减少安装失败面；esbuild JSX 足够 v0.1。
- **不用 BrowserRouter**：Pages 子路径与 Electron 自定义协议下 hash 最稳。
- **不做自动发音评分**：老人方言口音重，容易误判；下一版先做回声跟读 + 声调。
- **内容许可 CC BY-SA 4.0**：与 Wiktionary/CC-CEDICT 兼容；代码 Apache-2.0 带专利授权；贡献用 DCO，不用 CLA。

## 8. 已知问题 / 风险

- **没有真人测试**：所有 UI 判断来自设计约束与截图，不是老人实测。P0 是找 3–5 位老人做无指导测试。
- **内容未审校**：50 张卡都可能存在“听懂但不够准确”的问题；不能对外称正式。
- **系统 TTS 不一致**：不同 Windows/macOS 机器音质/声音不同；设置页会标注在线/离线，但未做自动降级提示。
- **`SpeechProvider` 复杂度**：token/watchdog 逻辑必要但容易改坏；新增语音功能前先读注释与测试。
- **`SessionComplete` 自动朗读**：依赖用户点击后的手势；直接刷新完成页可能被浏览器拦截，当前不阻塞 UI。
- **StrictMode**：开发环境 effect 双调用；会话创建放在 effect 且做了日期判断，语音可能双启动后互相取消；生产不受影响。
- **无 axe-core 自动检查**：只人工核了主要对比度/尺寸。
- **移动端**：响应式 CSS 有，但未在真机老人场景测。
- **PWA/离线**：无 service worker；从 Pages 打开仍依赖网络加载静态资源。Electron 打包后才是真正离线。
- **Pages API 未认证查询**：偶尔 404，但页面/部署 run 正常；不要据此判断失败。
- **依赖更新**：Dependabot 会开 PR；合并前跑 `pnpm check`，不要盲目升 major。
- **macOS 未真机验收**：Vision 编译、TCC 弹框、Retina 坐标、全屏/双屏都还没在 Mac 上跑过；
  这是当前最高优先级的验证项。见 docs/08 第 6.6 节。
- **Windows OCR 依赖中文语言包**：没有 `zh-Hans-CN` 时功能不可用，UI 会引导安装；不要在
  没有语言包的机器上把它说成“坏了”。
- **屏幕取词的风险提示对 OCR 错字敏感**：例如“告诉”识别成“告讣”可能漏掉验证码风险；
  下一步用“目标词 + 行文本”双通道判断。
- **小窗高度**：带风险提示时约 400×517 DIP；800×600 屏幕会内部滚动，尚未做真人测试。
- **大模型内容未审校**：必须保持“电脑生成 · 不一定对”，不能当正式词典。
- **没有安装包/签名/公证**：当前只能从源码跑；macOS DMG / Windows NSIS 还没做。

## 9. 下一步建议（按优先级）

### P0（先做，别加功能）

1. **老人可用性测试**：3–5 位 65–80 岁、识字量 < 500。任务：
   - 第一次打开查一个字的念法（目标 ≤60s，≥8/10）；
   - 听到“再念一遍”并重播（≥9/10）；
   - 粘贴一段微信/短信文字并朗读（≤45s，≥7/10）。
   记录“点还是犹豫、出错后是否再试、是否叫子女”，不要只问“好不好”。
2. **内容审校**：50 张卡走 C5（扮 70 岁农村老人）+ 人工；补来源；优先多音字、近义词、医疗/金融风险词。
3. **修可用性阻塞**：根据测试改文案/按钮/首屏，不加新模块。

### P1

4. **macOS 真机验收屏幕取词**：按 docs/08 第 6.6 节跑完；修 TCC/Retina/全屏问题；预编译
   universal Vision helper；再做签名/公证。
5. **sherpa-onnx + 中文 VITS**：保持 `SpeechEngine` 接口；验证逐字时间戳、安装包体积、离线。
6. **语料库审校**：第一批 293 条已产出（机器审校草稿）；先补 R1 三审与逐词 evidence，再人工复核、装 canary。
7. **任意网页正文**：实现 `PageReader`（Readability/扩展/桌面壳）；先做“粘贴正文”已有路径的迁移。

### P2

8. **跟读**：`PronunciationCoach`；先回声跟读，最多评声调/节奏，不显示“你读错了”。
9. **PWA/离线**：Service Worker + 缓存；或直接走 Electron。
10. **无障碍**：axe-core、键盘全流程、1024×768/1280×800、对比度回归。
11. **内容扩到 300 词**：按 docs/01 分批，跑金标准回归。

## 10. 如何安全地加一个附加功能

1. 先在 `apps/web/src/capabilities/contracts.ts` 定接口（输入/输出/失败语义）。
2. 实现放 `capabilities/` 或独立包；UI 只依赖接口。
3. 永远保留“失败/不确定”的返回（如 `plain: null`、`isAvailable() === false`），设置页标“还没做”。
4. 新增默认网络请求 = 违反三原则；唯一例外是 GitHub 版本检查（可关、只读公共信息）；其他联网必须用户主动点击，并更新 PRIVACY/SECURITY。
5. 加测试：纯函数单测；UI 用 1024×768/1280×800 截图；更新 docs/05、docs/07、CHANGELOG。

## 11. 交接检查清单

- [ ] `git pull`，确认 HEAD 与 remote 一致
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm check`
- [ ] `pnpm dev`，手点一遍：首页（看屏幕/工具图）→ 怎么用 → 欢迎三步 → 3 张卡 → 完成 → 首页 → 字库 → 卡片 → 帮我看屏幕 → 文章 → 设置
- [ ] 试“再念一遍”、点单字、点释义/例句/图片
- [ ] 设置切换语速/声音/拼音，刷新看是否保留
- [ ] 看 GitHub Actions 最新 `CI` 与 `Pages`
- [ ] 读本文件第 8、9 节，确认今天要做的优先级
- [ ] 改动后 `git commit -s`，push，等 CI
- [ ] 更新 CHANGELOG 的 Unreleased
- [ ] 部署/使用步骤有变化时更新 [docs/09](09-deploy-and-use.md)

## 12. 一句话交接

**Windows 上“光标停在字上，小窗告诉你意思/读音/例句”已经能用；下一步最值钱的是
把 macOS 权限与 Retina 坐标在真机上跑通，再找 3–5 位老人试“停一下就能查”——不要先加更多功能。
儿童场景是长期假设（“先使用、后识字”），先做有家长同意的真实观察，不要先做课程/积分/家长监控。
语料第一批 293 条已产出，但只过了机器审校（R1 三审未完成）：先补评审与人工复核，别当正式内容。**

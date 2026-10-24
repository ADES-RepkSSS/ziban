# 更新记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号遵循 SemVer，0.x 阶段不保证兼容。

## [Unreleased]

### Added

- **可选云端文本转语音（TTS）**：设置里可选 OpenAI 兼容 `/audio/speech` 或阿里云百炼 Qwen-TTS，填网址、模型、音色和 API Key；
  默认关闭，打开后字卡/例句/屏幕讲解的朗读改走云端；桌面版密钥只在主进程加密保存，网页版密钥存当前浏览器 localStorage（需服务支持 CORS）；音频不落盘。
  新增 `docs/12-cloud-tts.md`、3 个端点校验测试；本地 mock 端到端通过，真实服务商 Key 需用户自己试听。
- **实验语料库第一批（293 词）**：医院 51、银行 52、政务 44、手机 43、出行 35、防骗 43、购物 25；
  每条含一句口语释义和一句生活例句，source 统一 `auto-*`，运行时显示“机器审校 · … · 不一定对”。
  全部为**机器审校草稿**，未经人工审校，也不是老人验证内容；说明见 [corpus/README.md](corpus/README.md)、
  [corpus/RELEASE.md](corpus/RELEASE.md)。
- 语料流水线脚本：`corpus:lint`（schema/字数/去重/用字覆盖/安全/拼音硬 lint）、
  `corpus:review`（合并 Judge A/B/C 与硬 lint → review.jsonl）、`corpus:build`（只发布 final=release）、
  `corpus:metrics`（每批 metrics.md）；`corpus/chars/common2000.txt` 作为释义用字预算。
- 语料库加载器测试 4 条：auto- 前缀降级为机器审校、非 auto 仍为高可信、超长词/空释义被丢弃，
  以及 release 目录 7 文件/293 条全量加载 + `KnowledgeService.localLookup('候诊')` 管线验证。
- `pnpm corpus:install`：显式把 `corpus/release/*.json` 复制到真实 `userData/corpus`；
  默认不自动安装、不复制 workbench。
- 修正文档里的 userData 路径：实际是 `%APPDATA%\字伴` /
  `~/Library/Application Support/字伴`，不是 `@ziban/desktop`。

### Changed

- `CorpusStore` 不再把超过 8 字的词静默截断成另一个词，而是整条丢弃（lint 仍会提前拒绝）。
- `auto-` 前缀的语料条目标记为 `generated=true`、`confidence=medium`，不再冒充人工 `high`。
- 语料相关文档统一标注“机器审校草稿，未人工审校”；说明**屏幕语料不需要 SVG 插图**，
  现有 50 卡 + 52 SVG 不变。重写 [docs/10](docs/10-corpus-handoff.md)、[docs/11](docs/11-corpus-batch1-handoff.md)。

## [0.2.1] - 2026-10-23

### Added

- Windows 免安装绿色版作为 GitHub Release 附件：`ziban-win32-x64.zip`（解压后双击 `Ziban.exe`）。

### Changed

- 网页演示首页明确标注 **“网页演示版 · 没有屏幕取词”**；演示站只能粘贴文字，不读取其他软件。
- 版本号统一为 `0.2.1`；发布说明见 [docs/releases/v0.2.1.md](docs/releases/v0.2.1.md)。

## [0.2.0] - 2026-10-23

### Added

- **桌面版 0.2：光标跟随屏幕取词**（不做框选）。Electron 壳、小窗、全局快捷键、托盘。
- Windows：常驻 PowerShell + `System.Drawing` 截屏 + WinRT `Windows.Media.Ocr` 中文 OCR；
  只截光标周围自适应小区域（260–420 DIP，随分辨率/缩放变化），实测截屏+OCR 20–60ms。
- macOS：`/usr/sbin/screencapture -R` + Apple Vision（Swift helper）；只需“屏幕录制”权限，
  不需要辅助功能；首次运行用 Xcode CLI Tools 编译 helper。
- 知识管线：50 张字卡 + 约 120 条离线词表 + `pinyin-pro`；语料库 JSON 热加载；
  可选 OpenAI 兼容大模型补缺；7 天 JSON 缓存。
- 小窗展示词/拼音/释义/例句/来源/风险；`setContentProtection` 防止 OCR 自己；
  `showInactive` 不抢焦点；自动念“词 + 释义”。
- 设置页“看屏幕上的字”与首页入口；macOS 权限图文引导与系统设置深链。
- `packages/core/src/screen.ts` + 21 个纯函数测试（OCR 归一化、光标找字、整词切分、自适应区域、知识合并）。
- 桌面冒烟：`desktop:ocr-smoke` / `lookup-smoke` / `hover-smoke` / `ui-smoke`。
- GitHub Actions `Desktop macOS OCR`：编译 Vision helper 并识别跨平台测试图。
- 交接文档 [docs/08-screen-lookup.md](docs/08-screen-lookup.md)。
- **取词单位改为整词**：词表最长匹配 → `Intl.Segmenter` 中文分词 → 最后才单字；
  “今天很暖和”会取“暖和”，而不是“暖”；“我的/这个/因为”等语法组合跳过。
- 截图区域**按显示器工作区/缩放自适应**（宽约 26%，260–420 DIP；高约 52%，140–230 DIP），不再写死 340×180。
- 首页重做为**看图找工具**：第一张大卡是“看屏幕上的字”，下面按图列出每天三个字、看图找字、帮我看屏幕；
  每项有特征图，方便不识字老人按图识别；浏览器版明确降级为“粘贴文字”。
- 修复小窗“念”按钮：鼠标进入小窗时先激活窗口，避免 Windows 首次点击只激活；
  播放时按钮显示“正在念”，语音错误显示可读提示。
- 新增**版本检查**：启动 3 秒后只读 GitHub 公共版本信息，发现新版在首页提示并给 GitHub 链接；
  不做软件内下载/安装；默认开、可在设置关闭，缓存 24h，`ZIBAN_DISABLE_UPDATE_CHECK=1` 可完全关闭。
- 新增 **Windows 免安装绿色版**：`pnpm desktop:package` → `release/ziban-win32-x64/Ziban.exe` + zip。
- 新增 [docs/10-corpus-handoff.md](docs/10-corpus-handoff.md) 与 `pnpm corpus:validate`：给下一位 AI 的语料库格式、提示词、审校与验收。
- 新增 [docs/09-deploy-and-use.md](docs/09-deploy-and-use.md)：网页/桌面部署、GitHub Pages、macOS 权限、数据目录、使用与排错。

### Changed

- **重写项目介绍**：从“帮不识字的老人用电脑”扩展为“把查字典简化成一次停留——老人看得懂屏幕，孩子在探索里认字”。
  明确当前以老人场景为重点；长期验证“先使用、后识字”的儿童识字范式，儿童场景是未验证假设，不做课程/积分/排行榜/家长监控。
- **首次打开直接进工具首页**，不再强制看完三步欢迎；欢迎页保留在首页底部“怎么用”，需要时再看。
- 能力清单新增 `desktop-only` 状态；“框选屏幕取词”改为“光标取词（看屏幕）”。
- `pnpm check` 的测试数从 39 增至 60；Web 构建约 316 KB JS / 62 KB CSS。
- README、PRIVACY、SECURITY、NOTICE、AGENTS、docs/00/03/04/05/06/07/08 同步桌面取词边界、整词取词与自适应截图。
- 更新 GitHub About / 短版简介文案（docs/06），供仓库主页 About 直接粘贴。

### Security

- 屏幕截图不落盘（OCR 后立即删除）；小窗内容保护；只截光标周围小区域。
- 大模型默认关闭；API Key 只在主进程，safeStorage 加密；默认只发词，发当前行需显式勾选。
- 生产 CSP、`app://ziban/` 自定义协议、白名单 IPC、`contextIsolation`/`sandbox`。

### Docs

- 增加 [AGENTS.md](AGENTS.md) 与 [docs/07-handoff.md](docs/07-handoff.md)：交接快照、关键不变量、已知坑、下一步优先级。
- 给语音队列、每日会话、内容构建、路由、进度存储等关键模块补充源码注释。
- 新增 [docs/09-deploy-and-use.md](docs/09-deploy-and-use.md)：从“怎么启动”到 GitHub Pages/静态托管、
  Windows/macOS 源码运行、macOS 权限、数据目录、大模型/语料库配置和排错。

### Planned

- **macOS 真机验收**：TCC 弹框、Retina 坐标、全屏/双屏；预编译 universal Vision helper；签名/公证。
- 老人可用性测试（3–5 位）与卡点修复
- sherpa-onnx + 中文 VITS 语音适配
- 语料库/爬虫 200–500 个屏幕高频词 + 人工审校
- 内容 C5 对抗审校与金标准回归
- 回声跟读 / 声调优先的发音练习

## [0.1.0] - 2026-10-22

### Added

- 50 张识字卡，覆盖看病、取钱、出门、家里、联系、办事、买东西、防骗 8 个场景。
- 52 张手绘 SVG 配图（50 卡片 + 2 文章），不用文生图。
- 识字卡：图片、大字、口语释义、例句、拼音内部数据；自动朗读、逐字高亮、单字重播、图片描述朗读。
- 三步欢迎引导、首页、字库、设置、完成页。
- 每天三个字 + 最多 3 张到期复习；1/3/7/14/30/60 天温和间隔。
- 本地 `localStorage` 进度；无账号、无联网、无广告、无内购、无外链。
- “帮我看屏幕”：粘贴文字逐句朗读、离线词表讲解、转账/验证码/冻结账户风险提示、医疗剂量提示。
- 4 篇自带示例文章：医院流程、银行诈骗短信、社区免费量血压、微信位置权限提示。
- 能力层契约：`SpeechEngine`、`Explainer`、`ScreenReader`、`PageReader`、`PronunciationCoach`。
- 设置页明确标出“能用 / 实验 / 还没做”，不把未实现能力说成可用。
- 39 个单元测试；内容 schema + 用字/图片/长度门禁；CI 与 GitHub Pages 工作流。
- Apache-2.0 代码许可；CC BY-SA 4.0 内容许可；手绘配图可再分发。

### Security

- 生产 HTML 无内联脚本/样式，便于严格 CSP。
- 用户内容按纯文本渲染，不使用 `dangerouslySetInnerHTML`。
- 学习记录仅本机保存；设置页提供清除入口。

### Notes

- 50 张卡全部为 `status: draft`，释义/例句为手写原型，未经正式审校，禁止直接对外发布。
- 屏幕 OCR、任意网址正文抽取、跟读评分尚未接入；当前以粘贴文字/自带文章验证交互。
- 系统中文语音音质依赖操作系统语音包，实测 Windows Microsoft Huihui 可用；正式版计划换 sherpa-onnx。

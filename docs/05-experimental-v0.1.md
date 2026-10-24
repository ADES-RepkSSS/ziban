# 05 · v0.1 实验版说明

> 这一版的目标不是“功能齐全”，而是把**基础功能做成真的能用**，同时把附加功能的接口留对。
> Web 优先：同一个 `apps/web` 既是浏览器产品，也是将来 Electron 壳里的渲染层。
>
> **2026-10 后续更新**：`apps/desktop` 已加 Electron 壳与**光标跟随取词**（不做框选）：
> Windows 已实测，macOS 代码/CI 已写、待真机验收。详见
> [docs/08-screen-lookup.md](08-screen-lookup.md)。下面 v0.1 的能力表保留为历史快照，
> 其中“框选屏幕 OCR 未接入”指 **浏览器版**；桌面版现在是“光标停在哪就查哪”。
>
> **定位补充**：当前版本以老人场景为重点；长期验证“先使用、后识字”的儿童识字场景。
> 儿童场景是方向与假设，当前没有儿童专用功能，也不做课程/积分/家长监控。

## 1. 现在能做什么

### 基础功能（本次重点，已可用）

- **50 张识字卡**，覆盖 8 个场景：看病买药 7、取钱转账 8、出门坐车 6、家里使用 6、联系家人 7、办事 5、买东西 4、防骗 7。
- 每张卡：大图（手绘 SVG）、大字、口语释义、例句、拼音（默认隐藏，只给家人看）。
- **朗读**：进入卡片自动念“词 + 释义”；点“再念一遍”重复；点单个字只念那个字；点释义/例句分别朗读；点图片会念图片描述。
- **逐字高亮**：读词时按字高亮。Web Speech 的 `boundary` 事件在中文下不可靠，因此有一层基于字时长的兜底时间轴，并用 boundary 事件校正。
- **“慢一点”**：学习页右上角一键在慢速/常规之间切换，切换后会重念当前卡。
- **每天三个字**：新卡按场景顺序取 3 张，再附加最多 3 张到期复习；不做对错考试，只记录“见过”，按 1/3/7/14/30/60 天温和排期。
- **三步欢迎引导**：会念字 → 每天三个字 → 卡住了点“帮我看屏幕”；每一步都能点示例卡片/按钮听到声音。
  0.2 起不再强制首次进入，默认先看到“看图找工具”的首页；需要教程时点首页底部“怎么用”。
- **首页**：第一张大卡是“看屏幕上的字”，下面按图列出每天三个字、看图找字、帮我看屏幕；已认字在底部回顾。
- **字库**：按场景筛选、看图找字，不需要打字；已认过的卡有绿色对勾。
- **设置**：语速三档、中文声音选择与试听、拼音开关、字号放大、清除学习记录、能力边界说明。
- **本地优先**：学习记录只在 `localStorage`（`ziban.progress.v1`），没有账号、没有联网请求、没有广告/内购/外链。

### 附加功能（本次做到“兼容 + 可用的文本路径”）

- **粘贴文字朗读**：把屏幕/短信/通知文字粘贴进来，逐句朗读并高亮当前句；点任意一句只听那一句。
- **讲一讲**：离线词表把办事/银行/手机里的书面词换成口语（验证码、冻结、逾期、挂号、诊室、窗口、提交等）。词表里没有的句子会明确说“只会念，还讲不好”，**不编**。
- **风险提示**：识别“转账 + 链接 + 冻结账户”“验证码告诉别人”等组合，给出“先别急着按”；识别剂量描述时提示“吃药要问医生”。
- **4 篇自带示例文章**：医院流程、银行诈骗短信、社区免费量血压、微信位置权限提示；每句有人工写的解释，整篇有“三句话讲明白”和逐句朗读。
- **能力清单**：设置页明确写出哪些能用、哪些是实验、哪些还没做，避免让老人猜。

## 2. 怎么跑

环境：Node.js 20+、pnpm 11（本轮在 Windows 10/11 + Edge 上实测）。

```bash
pnpm install
pnpm content:build   # YAML → cards.generated.json，并把 SVG 复制到 apps/web/public/images
pnpm dev             # http://127.0.0.1:4173
```

其他命令：

```bash
pnpm content:validate  # 只校验，不写文件
pnpm test              # 核心调度、文本、解释、文章、路由
pnpm typecheck         # packages/core + apps/web
pnpm build             # 生产构建到 apps/web/dist
pnpm check             # 校验 + 类型 + 测试 + 构建
```

> 首次 `pnpm install` 需要下载依赖；本轮网络环境下 npmmirror 的 tarball 速度很慢，安装耗时较长，不是代码问题。

## 3. 工程结构

```
apps/web/                     React + Vite + TS，产品本体
  src/app/                    路由、进度、语音 Provider
  src/capabilities/           语音适配器 + 附加功能能力清单
  src/components/             大按钮、图卡、字、页头、图标
  src/features/               welcome / home / learn / library / card / helper / reader / settings
  src/content/                cards.generated.json（构建产物）
  src/data/articles.ts        自带文章（人工解释）
  src/styles/                 设计 token 与分页面样式
packages/core/                纯函数：类型、调度、文本时间轴、口语词表
content/
  cards/level1.yaml           50 张卡片源文件
  images/*.svg                52 张手绘配图（50 卡片 + 2 文章）
  charset.level1.txt          原型字表 + 释义口语白名单
schema/card.schema.json       内容卡结构（沿用设计文档）
scripts/                      内容构建/校验
tools/                        配图生成器、联络表（人工目检）
```

设计约束的落点：

- **平台判断只在能力层**：`apps/web/src/capabilities/` 目前只有浏览器语音实现；将来 `sherpa-onnx`、系统 OCR、AX 都实现同一套接口。
- **UI 与桌面能力解耦**：路由用 hash、静态资源用相对路径（`base: './'`），可以原样塞进 Electron 的渲染层。**Electron 里请用自定义协议（如 `app://ziban/`）加载 `dist`，不要用 `file://`**——Chromium 会以 CORS 拦掉 `file://` 下的 ES module。自定义协议的 origin 固定，`localStorage` 也能稳定保留。
- **CSP 友好**：生产 HTML 没有内联脚本/样式，`default-src 'self'; img-src 'self' data:` 即可跑；开发期 Vite 的 HMR 注入样式，需要单独放宽 `style-src`，不要把这个放宽带进生产。
- **失败不指责**：没有“错误/失败/你错了”；朗读失败是“这次没念出来，再点一下‘再念一遍’”。
- **不联网做默认动作**：没有 fetch/XHR；声音默认挑本机中文语音；文章和词表全部打包。\n  桌面 0.2 的唯一例外是 GitHub 版本检查（可在设置关闭，只读公共信息）。

## 4. 内容状态（必须说清楚）

- 50 张卡片均为 `status: draft`。
- 释义/例句是项目组按日常口语手写的原型内容（`dict: self`, `corpus: self`），**没有**冒充维基词典或真实语料。
- 配图是手绘 SVG，不是文生图，也不是实拍；`lib: self`, `CC-BY-SA-4.0`。
- 拼音由 `pypinyin` 交叉核对过，仅作内部数据和家人参考，不用于教学。
- 没有经过 docs/01 的 C5 对抗审校与人工审校，**禁止直接对外发布**。`level1.sample.yaml` 保留为结构样例，不参与构建。
- 内容维护说明见 [content/README.md](../content/README.md)。

内容门禁（`pnpm content:validate`）当前检查：

- Zod schema（字段、枚举、id 格式、长度）；
- `text === chars.join('')`；
- 拼音数量 = 字数；
- 释义 ≤20 字，不含英文/数字/括号；
- 释义用字 ⊆ `charset.level1.txt`（50 字已学字 + 释义口语白名单）；
- 图片文件存在、alt 存在、例句有来源字段、id 不重复。

## 5. 已知边界与下一步

### 本版明确不做

| 能力 | 现状 | 原因 / 下一步 |
|---|---|---|
| 屏幕取词 | 桌面版 0.2 已接入（Windows 实测；macOS 待实机） | 不做框选：光标停稳后截自适应小区域（260–420 DIP 宽，随分辨率/缩放变化）→ 系统 OCR（Windows WinRT / macOS Vision）→ 小窗。浏览器版仍走“粘贴文字”。见 [docs/08](08-screen-lookup.md) |
| 任意网页正文 | 未接入 | 跨域与正文抽取需要扩展/桌面壳；当前用自带文章 + 粘贴正文验证交互 |
| 跟读评分 | 未接入 | 老人方言口音重，自动评分容易误判；先不做“你读错了”，下一版做回声跟读 + 声调优先 |
| 本地大模型讲解 | 未接入 | 当前只用离线词表，讲不了就明说；下一步接本地小模型，保持 `Explainer` 接口与“无来源不生成” |
| 真人录音/专业配音 | 未接入 | 当前用系统 TTS；音频质量依赖系统语音包，正式版换 sherpa-onnx + 中文 VITS |
| 实拍图片 | 未接入 | 原型用 SVG 保证许可干净；正式版按 docs/01 走“检索 + 排序 + 人选” |

### 兼容性接口（附加功能不被基础功能绑死）

```ts
// 语音：Web Speech 现在可用；换本地 TTS 只改实现
interface SpeechEngine {
  isAvailable(): boolean;
  listVoices(): VoiceInfo[];
  speak(options: SpeakOptions): SpeechHandle;
  cancel(): void;
}

// 屏幕：浏览器版先不实现；Electron 版在 main process 实现
interface ScreenReader {
  capture(): Promise<ScreenFrame>;
  ocr(frame: ScreenFrame): Promise<OcrBlock[]>;
}

// 讲解：离线词表现为唯一实现；本地模型以后实现同一签名
interface Explainer {
  explain(text: string): Promise<Explanation>;
}
```

Web 版没有假装这些接口已经能用：`src/capabilities/index.ts` 把它们标成 `planned`，设置页对用户可见。

### 下一轮优先级

1. **真人可用性测试**（docs/04 的 4.2）：找 3–5 位老人，观察“第一次打开查一个字”和“再念一遍”，先修“看不懂下一步”而不是加功能。
2. **语音质量**：在目标机器上确认中文离线语音；若系统 TTS 太机械，接 sherpa-onnx VITS，复用 `SpeechEngine`。
3. **屏幕取词**：Electron 壳 + 光标跟随 + 系统 OCR 已落地；Windows 把“停稳 → 出声”控制在 1s 内，macOS 需真机验证权限与 Retina 坐标。见 [docs/08](08-screen-lookup.md)。
4. **内容**：按 docs/01 把 50 张卡送 C5 对抗审校；补真实语料来源；图片从 SVG 过渡到“检索 + 人选”的实拍/授权图。
5. **跟读**：只评声调/节奏，提供“回声跟读”作为无评分兜底，绝不显示“你读错了”。

## 6. 验收自测（本轮）

- `pnpm content:validate`：50 张卡全部通过。
- `pnpm test`：67 个测试，覆盖核心调度、文本切分/时间轴、语音选择、口语解释、风险提示、文章、路由、旧数据修复，以及 21 个屏幕取词纯函数、4 个语料加载/管线、3 个云端 TTS 端点测试。
- `pnpm typecheck`：两个包 strict TS 通过。
- `pnpm build`：生产构建通过。
- 浏览器实测：Edge 1280×800 与 1024×768 走通首页 → 怎么用 → 欢迎三步 → 认字 3 张 → 完成 → 首页 → 字库 → 卡片 → 帮我看屏幕 → 粘贴/文章 → 设置；系统中文语音（Microsoft Huihui）实测能出声并逐字高亮。截图见 `screenshots/`（不提交，可重建）。

## 7. 一句话

**先把“按一下，字会念”做到没有歧义；附加功能只做不会伤害这条主线的那部分。**

---

开源发布、GitHub Pages、社区治理与许可证选择的完整步骤见 [docs/06-github-community.md](06-github-community.md)。

项目当前快照、架构不变量、已知问题与下一步优先级见 [docs/07-handoff.md](07-handoff.md)；给下一位 AI 的速查见 [AGENTS.md](../AGENTS.md)。

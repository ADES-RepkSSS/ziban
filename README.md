# 字伴 Ziban

> **帮不识字的老人用电脑：按一下念字，每天认三个字，看懂屏幕。**

<p>
  <img alt="status" src="https://img.shields.io/badge/status-v0.1%20experimental-orange?style=flat-square" />
  <a href="LICENSE"><img alt="code license" src="https://img.shields.io/badge/code-Apache--2.0-blue?style=flat-square" /></a>
  <a href="content/LICENSE.md"><img alt="content license" src="https://img.shields.io/badge/content-CC%20BY--SA%204.0-green?style=flat-square" /></a>
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img alt="platform" src="https://img.shields.io/badge/platform-Web%20%7C%20Electron%20planned-informational?style=flat-square" />
  <a href="https://github.com/ADES-RepkSSS/ziban/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ADES-RepkSSS/ziban/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://ades-repksss.github.io/ziban/"><img alt="在线演示" src="https://img.shields.io/badge/demo-GitHub%20Pages-0b5a53?style=flat-square" /></a>
</p>

字伴是一个**公益、开源、离线优先**的中文桌面伴随工具。目标用户是 **65–85 岁、识字量 < 500、母语听说完全正常**的老人：

- 手边有字不认识：**不用打字**，看图找字，或让家里人把屏幕文字粘进来，按一下就能听；
- 想学认字：**每天三个字**，有图、有声音、不考试、不催；
- 用电脑卡住：把通知、短信、网页文字放进来，**念给你听，再用大白话讲一讲**。

我们不做“儿童识字 App 的老年皮肤”，也不做面向视障者的完整屏幕阅读器。缺口是：**面向“文盲但听说正常”的成年人、中文优先、桌面级、伴随式辅助。**

> 当前是 **v0.1 实验版**。内容和能力边界都写在 [docs/05-experimental-v0.1.md](docs/05-experimental-v0.1.md) 里，不把没做的功能说成能用。

## 界面

<p align="center">
  <img src="docs/assets/study.png" width="78%" alt="识字卡：药，图片、大字、释义、例句，读词时逐字高亮" />
</p>

<p align="center">
  <img src="docs/assets/library.png" width="49%" alt="字库：按看病、取钱、出门等场景看图找字" />
  <img src="docs/assets/helper.png" width="49%" alt="帮我看屏幕：粘贴文字、朗读与风险提醒" />
</p>

## 现在能做什么

### 基础功能（已可用）

| 功能 | 说明 |
|---|---|
| 50 张识字卡 | 看病、取钱、出门、家里、联系、办事、买东西、防骗 8 个场景 |
| 图片配字 | 52 张手绘 SVG；点图片会念图片描述，不把“答案”画成文字 |
| 朗读 | 自动念“词 + 释义”；点单字只念这个字；点释义/例句分别朗读 |
| 逐字高亮 | 读词时按字高亮；TTS boundary 不可靠时有字时长兜底 |
| 每天三个字 | 新卡 3 张 + 最多 3 张到期复习；1/3/7/14/30/60 天温和排期 |
| 不指责 | 没有“错误/失败/你错了”；朗读失败只说“这次没念出来，再点一下” |
| 大按钮 | 主要操作 ≥ 88×88，字号大，对比度高，键盘 focus 可见 |
| 本地优先 | 学习记录只在 `localStorage`；无账号、无广告、无内购、无埋点 |

### 附加功能（文本路径可用，原生能力待接）

| 功能 | 现状 |
|---|---|
| 粘贴文字朗读 | ✅ 逐句朗读并高亮；点任意一句只听那句 |
| 离线“讲一讲” | ✅ 词表把验证码、冻结账户、逾期、挂号、窗口等换成口语；没把握就明说“只会念” |
| 风险提示 | ✅ “转账 + 链接 + 冻结账户”“验证码给别人”等组合提醒；剂量描述提醒问医生 |
| 示例文章 | ✅ 医院流程、银行诈骗短信、社区免费量血压、微信位置权限；每句有人工解释 |
| 框选屏幕 OCR | ⏳ 需要 Electron 壳；接口已预留 |
| 任意网址正文抽取 | ⏳ 需要扩展/桌面壳；当前用自带文章 + 粘贴文本验证交互 |
| 跟读/发音评分 | ⏳ v0.1 不做自动评分，避免方言被误判 |

## 快速开始

要求：Node.js 20+、pnpm 11。

```bash
git clone https://github.com/ADES-RepkSSS/ziban.git
cd ziban
pnpm install
pnpm dev
# 打开 http://127.0.0.1:4173
```

验证：

```bash
pnpm check      # 内容门禁 + strict 类型 + 39 个测试 + 生产构建
pnpm screenshot # 可选：用本机 Edge/Chrome 跑关键路径并生成截图
```

> 第一次 `pnpm install` 需要下载依赖；如果网络慢，不是代码卡死。

## 技术结构

```text
apps/web/                 React + Vite + TypeScript，产品本体
  src/app/                路由、学习进度、语音队列
  src/capabilities/       语音适配器、Explainer、OCR/网页/ASR 契约
  src/components/         大按钮、图卡、字、页头、图标
  src/features/           welcome / home / learn / library / card / helper / reader / settings
  src/content/            cards.generated.json（构建产物）
  src/data/articles.ts    自带文章 + 人工解释
packages/core/            纯函数：类型、间隔调度、文本时间轴、口语词表
content/                  50 张卡片 YAML、52 张 SVG、字表
scripts/                  内容构建/校验/截图
docs/                     立项、内容流水线、合规、Electron、路线图、实验版说明
```

设计纪律：

- **平台判断只在能力层。** UI 不直接碰系统 API；将来换 sherpa-onnx、系统 OCR、AX，不改学习卡。
- **UI 与桌面能力解耦。** hash 路由 + 相对资源，Electron 用自定义协议加载即可。
- **生产无内联脚本/样式。** 方便严格 CSP；默认不发网络请求。
- **失败不指责。** 所有文案遵守三原则。

能力契约见 [apps/web/src/capabilities/contracts.ts](apps/web/src/capabilities/contracts.ts)。

## 内容状态（重要）

- 50 张卡片全部是 **`status: draft`**；
- 释义/例句是项目组按日常口语手写的原型（`dict: self`, `corpus: self`），**没有冒充词典或真实语料**；
- 配图是手绘 SVG（CC BY-SA 4.0），**不是文生图**；
- 拼音仅作内部数据与家人参考，**不用于教学**；
- **没有经过 C5 对抗审校与人工审校，禁止直接对外发布。**

内容流程与加卡方式见 [content/README.md](content/README.md)；AI 流水线约束见 [docs/01-ai-content-pipeline.md](docs/01-ai-content-pipeline.md)。

## 路线图

| 版本 | 目标 |
|---|---|
| v0.1（当前） | Web 识字卡 + 粘贴文字朗读/解释 + 本地进度 |
| v0.1.x | 老人可用性测试、语音质量、内容审校、自动化回归 |
| v0.2 | Electron 壳 + 框选屏幕 OCR（热键 → 框选 → 出声 < 1.5s） |
| v0.3 | 300 词内容流水线 + 金标准回归 + 更稳的复习 |
| v0.4 | Windows 构建与 WinRT OCR；双平台对齐 |
| v1.0 | 网页阅读器 + 三句话摘要 + 生字本；留存 5/10 |

完整优先级与风险见 [docs/04-roadmap.md](docs/04-roadmap.md)。

## 参与贡献

不需要会写代码也能帮：

- **内容**：审校释义/例句、补来源、挑图片；
- **老人测试**：观察老人第一次打开、卡在哪、原话是什么；
- **无障碍**：大字、对比度、键盘、屏幕阅读器；
- **开发**：React/TS、Electron、系统 OCR、语音；
- **设计/文档/翻译**。

先读 [CONTRIBUTING.md](CONTRIBUTING.md)。提交 PR 时请用 `git commit -s` 表示同意 DCO；我们不用 CLA。行为规范见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

第一次建仓、设置 About/Topics、GitHub Pages、社交预览和许可证选择的完整步骤见 **[docs/06-github-community.md](docs/06-github-community.md)**。

## 安全与隐私

- 不建账号、不做统计、不把学习记录上传；
- 默认不联网；没有广告、内购、第三方跳转；
- 用户内容按纯文本渲染，不使用 `dangerouslySetInnerHTML`；
- 安全问题请走私密报告，不要开公开 issue。

详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/00-charter.md](docs/00-charter.md) | 立项书：用户、范围、方案对比、决策 |
| [docs/01-ai-content-pipeline.md](docs/01-ai-content-pipeline.md) | 内容流水线、质量门禁、金标准回归 |
| [docs/02-corpus-compliance.md](docs/02-corpus-compliance.md) | 语料合规与提示词注入防御 |
| [docs/03-macos-electron.md](docs/03-macos-electron.md) | Electron/系统能力工程要点 |
| [docs/04-roadmap.md](docs/04-roadmap.md) | 路线图、验收、风险登记 |
| [docs/05-experimental-v0.1.md](docs/05-experimental-v0.1.md) | **本版功能、结构、边界、自测** |
| [docs/06-github-community.md](docs/06-github-community.md) | **建仓、Pages、社区化、许可证** |
| [content/README.md](content/README.md) | 卡片/图片/字表维护 |
| [CHANGELOG.md](CHANGELOG.md) | 版本记录 |
| [GOVERNANCE.md](GOVERNANCE.md) | 角色、决策、发布、资金 |

## 许可

- 代码：**Apache-2.0**，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)；
- 内容（词表、释义、例句、手绘配图）：**CC BY-SA 4.0**，见 [content/LICENSE.md](content/LICENSE.md)；
- 第三方素材/模型：按来源单独分发，不把许可不明的模型或 NC 素材放进主仓库；见 [docs/02-corpus-compliance.md](docs/02-corpus-compliance.md)。

## 免责声明

字伴不是医疗、法律、金融或政务建议工具。屏幕文字可能识别错，离线解释只覆盖词表内的词，风险提示是启发式提醒。涉及吃药、转账、密码、验证码、证件办理时，请以医生、银行、官方窗口和家里人的意见为准。

## English

Ziban is an open-source, offline-first learning companion for elderly Chinese users with low literacy. Tap a character or word to hear it, learn three words a day with pictures, and paste screen text to have it read aloud and explained in plain language. The v0.1 experimental app is a React/Vite web UI; system OCR, arbitrary web-page extraction and pronunciation scoring are planned behind capability interfaces. Code is Apache-2.0, content is CC BY-SA 4.0. Start with [docs/05-experimental-v0.1.md](docs/05-experimental-v0.1.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

---

<sub>字伴（Ziban）· 为不识字的老人做，公益开源。没有广告，没有内购，没有账号。</sub>

<sub>维护者：[@ADES-RepkSSS](https://github.com/ADES-RepkSSS) · 演示：[ades-repksss.github.io/ziban](https://ades-repksss.github.io/ziban/)</sub>

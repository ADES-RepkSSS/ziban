# 更新记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号遵循 SemVer，0.x 阶段不保证兼容。

## [Unreleased]

### Docs

- 增加 [AGENTS.md](AGENTS.md) 与 [docs/07-handoff.md](docs/07-handoff.md)：交接快照、关键不变量、已知坑、下一步优先级。
- 给语音队列、每日会话、内容构建、路由、进度存储等关键模块补充源码注释。

### Planned

- 老人可用性测试（3–5 位）与卡点修复
- sherpa-onnx + 中文 VITS 语音适配
- Electron 壳 + 框选屏幕 OCR（macOS / Windows）
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

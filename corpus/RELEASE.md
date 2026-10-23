# 语料 release · 2026-11-a

> **状态：机器审校草稿（experimental）。没有人工审校，没有老人测试。**
> 不能对外称“正式内容”“人工审校”“老人验证”。
> 完整复盘、踩坑与下一批顺序见 [docs/11-corpus-batch1-handoff.md](../docs/11-corpus-batch1-handoff.md)。

- release_id：`ziban-corpus-2026-11-a`（2026-10-23 生成；批次号按计划发布月命名）
- 生成模型：`deepseek-flash`；提示词版本 `corpus-gen@1.0`
- 来源：项目组自写口语解释（self），不抄词典/论坛/公众号原文
- 许可：CC-BY-SA-4.0

## 文件清单

| 文件 | 条数 | 风险层 | name |
|---|---:|---|---|
| `corpus/release/hospital.json` | 51 | R1 | 医院办事词表 |
| `corpus/release/bank.json` | 52 | R1 | 银行办事词表 |
| `corpus/release/gov.json` | 44 | R1 | 政务办事词表 |
| `corpus/release/phone.json` | 43 | R2 | 手机屏幕词表 |
| `corpus/release/transit.json` | 35 | R3 | 出行乘车词表 |
| `corpus/release/fraud.json` | 43 | R1 | 防骗安全词表 |
| `corpus/release/shopping.json` | 25 | R3 | 买东西词表 |
| **合计** | **293** | | |

每条只有 `word/definition/example/source` 四个字段；`source` 全部 `auto-*`；
`pinyin` 一律省略（运行时用本机 `pinyin-pro` 兜底，避免多音字误标）。

## 怎么跑出来的

```bash
pnpm corpus:lint -- --drafts     # 305 条候选 → 预筛/改稿
pnpm corpus:review               # 合并 Judge A/B + 真实 lint → review.jsonl
pnpm corpus:build                # 只发布 final=release
pnpm corpus:metrics              # 每批 metrics.md
pnpm corpus:lint                 # 发布文件：0 hard fail / 0 warning
node scripts/validate-corpus.mjs corpus/release/hospital.json ...（7 个文件）
```

## 评审情况（重要）

| 评审 | 覆盖 | 结果 |
|---|---|---|
| Judge A（偏准确/安全） | hospital/bank/gov/fraud 共 200 条 | 0 reject；16 条 revise，已逐条改或删 |
| Judge B（偏口语/语气/必要） | phone/transit/shopping 共 105 条 | 2 reject（短信、二维码与本机 PLAIN_TERMS 重复，已删）；8 条 revise，已改 |
| Judge C / D（三审） | — | **超时未产出**，没有结果 |

- 评审是子代理按 rubric 打分，不是人工审校。
- 评审运行时 drafts 还在改；部分结论针对旧文本。每条处理结果写在
  `corpus/workbench/resolutions.json` 和 `review.jsonl` 的 `resolution` 字段里。
- 因此 **R1 没有满足“三审全过且 safety=5”**；这是本批最大的流程缺口，下一批必须补。
- 305→293 的差额（12 条）：7 条与 PLAIN_TERMS（药房/冻结/账户/社区/短信/二维码/链接）重复，
  5 条近义重复（病床/复查/病区/额度/恐吓），全部记录在 `corpus/workbench/dropped.jsonl`。

## 验收结果

| 项 | 结果 |
|---|---|
| `node scripts/corpus-lint.mjs`（release 模式） | ✓ 293 条，0 hard fail，0 提醒 |
| `node scripts/validate-corpus.mjs`（7 文件） | ✓ 通过 |
| 字卡重复 / 本机词重复 / 跨文件重复 | 0 / 0 / 0 |
| 2–4 字词占比 | 100% |
| 释义用字覆盖率 | 平均 100%（目标 ≥95%） |
| 释义/例句长度 | 释义 10–19 字（均值 12.2）；例句 10–18 字（均值 11.4） |
| PII / 网址 / HTML / 危险操作示范 | 0 |
| `pnpm test` | 64 条通过（含 4 条语料加载器测试） |
| `pnpm typecheck` | 通过 |
| 真实用户数据目录安装 | 已安装到 `%APPDATA%\字伴\corpus`（7 文件）；应用启动日志确认“语料库加载：293 条（7 个文件）”；release 全量加载 + 知识管线测试通过；小窗 OCR 待解锁桌面复验 |

## 已知问题（下一批必须处理）

1. **没有三审**：C/D 超时；R1 只有 A 一审。不要把本批当“已过审”。
2. **没有跑“每词 3 稿 + 共识”**：本批是一稿 + 多轮改稿，与手册 Step 3 不同。
3. **evidence 是模板**：manifest 里每条的 evidence 都是主题级场景句，不是逐词屏幕证据。
4. **评审与改稿并发**：评审读到过旧文本；`resolutions.json` 只能证明“改过”，不能证明“复评通过”。
5. **例句偏短**：本批把 8–9 字的例句补到 ≥10 字，但整体仍偏简短；需要真人读一遍。
6. **没有真人/老人测试**；医疗、金融、政务、防骗四类仍需逐条人工复核。

## 回滚

```text
删除 <userData>/corpus/ 下对应的 7 个文件即可；不删旧文件也可以按文件名覆盖回去。
```

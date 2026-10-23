# 11 · 第一批屏幕语料交接（2026-10-23）

> 给下一位接手语料的人 / AI：这份文件记录第一批 293 条实验语料是怎么做出来的、哪些地方没做到、
> 下一批先修什么。**这批内容是机器审校草稿，不是人工审校，也没有老人验证。**
> 语料格式先看 [docs/10](10-corpus-handoff.md)；批处理规则看
> [交接手册](字伴-语料批处理与自动审核-交接手册.md)；本批 release 记录见
> [corpus/RELEASE.md](../corpus/RELEASE.md)。

## 0. 一句话

按 7 个主题产出 **293 条**屏幕高频词（每条一句口语释义 + 一句生活例句），
全部 `source=auto-*`，通过硬 lint 与 schema 校验；**R1 三审没有跑完**，发布前必须人工复核。

## 1. 这次交付了什么

| 产出 | 位置 | 说明 |
|---|---|---|
| 运行时 JSON | [corpus/release/](../corpus/release/) | 7 个文件，293 条；只有 word/definition/example/source |
| 批次审计 | [corpus/workbench/](../corpus/workbench/) | manifest / drafts / review / metrics / dropped |
| 用字表 | [corpus/chars/common2000.txt](../corpus/chars/common2000.txt) | 2000 常用字，释义用字预算 |
| 说明 | [corpus/README.md](../corpus/README.md)、[RELEASE.md](../corpus/RELEASE.md)、[SOURCES.md](../corpus/SOURCES.md) | 用法、来源、已知问题 |
| 脚本 | [scripts/corpus-lint.mjs](../scripts/corpus-lint.mjs)、[corpus-review.mjs](../scripts/corpus-review.mjs)、[corpus-build.mjs](../scripts/corpus-build.mjs)、[corpus-metrics.mjs](../scripts/corpus-metrics.mjs) | lint → review → build → metrics |
| 代码改动 | [corpus.ts](../apps/desktop/electron/capabilities/knowledge/corpus.ts) | auto- 标记机器审校；超 8 字不再静默截断 |
| 测试 | [corpus.test.ts](../apps/desktop/electron/capabilities/knowledge/corpus.test.ts) | 4 条加载/管线测试；测试总数 60 → 64 |

主题与条数：医院 51、银行 52、政务 44、手机 43、出行 35、防骗 43、购物 25。

## 2. 数据长什么样

```json
{
  "version": 1,
  "name": "医院办事词表",
  "license": "CC-BY-SA-4.0",
  "entries": [
    {
      "word": "候诊",
      "definition": "挂完号，坐着等医生叫你。",
      "example": "请在候诊区坐着等叫号。",
      "source": "auto-hospital-2026-11"
    }
  ]
}
```

约定：

- **不写 pinyin**。语料里的拼音会覆盖本机 `pinyin-pro`；本批 293 条全部省略，运行时仍有兜底拼音。
- **只有 schema 四个字段**（`pinyin` 可选）；多一个字段 `corpus:lint` 就报 hard fail。
- `source` 以 `auto-` 开头：UI 显示“机器审校 · … · 不一定对”，`generated=true`、`confidence=medium`。
- 同一 `word` 在 7 个文件里唯一；`readdir` 顺序跨平台不稳定，不能靠后写覆盖去重。

## 3. 流水线

```bash
pnpm corpus:lint -- --drafts   # 1. 硬 lint：schema/字数/去重/用字覆盖/安全/拼音
pnpm corpus:review             # 2. 合并 Judge 记录 + lint → <batch>/review.jsonl
pnpm corpus:build              # 3. 只把 final=release 写进 corpus/release/
pnpm corpus:metrics            # 4. 生成每批 metrics.md
pnpm corpus:lint               # 5. 发布文件复检
node scripts/validate-corpus.mjs corpus/release/bank.json ...   # 6. 原 schema 校验
```

数据流：

```text
manifest.json（冻结词表 + evidence + source_ref）
  → drafts.jsonl（一稿一条，带 batch_id/draft_id/source_ref）
  → 硬 lint（确定性规则，不投票）
  → reviews/judgeX.jsonl（子代理评审，只判断不改写）
  → review.jsonl（每条：lint、judges、resolution、final）
  → corpus/release/<theme>.json
```

`resolution` 是本批新增的字段：评审可能针对改稿前的文本，
凡是“按意见改过”或“确认误判”的词，必须在
[corpus/workbench/resolutions.json](../corpus/workbench/resolutions.json) 里留一条说明，才允许 release。

## 4. 质量门禁（已通过）

| 项 | 结果 |
|---|---|
| `corpus:lint` release 模式 | 293 条，0 hard fail，0 提醒 |
| `validate-corpus.mjs`（7 文件） | 通过 |
| 字卡重复 / 本机词重复 / 跨文件重复 | 0 / 0 / 0 |
| 2–4 字词占比 | 100% |
| 释义用字覆盖率 | 平均 100%（目标 ≥95%） |
| 释义 / 例句汉字数 | 平均 12.1 / 11.3（目标 12–40 / 10–40） |
| PII / 网址 / HTML / 危险操作示范 | 0 |
| `pnpm check` | 全绿（内容门禁 + 语料 lint + tsc + 64 tests + build + 链接检查） |

硬 lint 规则（[scripts/corpus-lint.mjs](../scripts/corpus-lint.mjs)）：
schema 字段白名单、word 2–8 纯汉字、字卡/本机/跨文件去重、
释义 ≥6 且 ≤60 个汉字、例句 ≥6 且 ≤40、ASCII/URL/HTML/括号/控制字符、指责性词语、
循环释义、用字覆盖率 <90% hard / <95% warn、风险词操作句、PII、拼音音节数与声调。

## 5. 评审：做了什么、没做到什么

| 评审 | 覆盖 | 结果 |
|---|---|---|
| Judge A（准确/安全） | hospital/bank/gov/fraud 200 条 | 0 reject；16 条 revise |
| Judge B（口语/语气/必要） | phone/transit/shopping 105 条 | 2 reject；8 条 revise |
| Judge C / D（三审） | 计划全量 | **超时，未产出** |

- 16 + 8 条 revise 全部改稿或删除，19 条有 resolution；另外 12 条在 Step 0/近义去重阶段删掉
  （[dropped.jsonl](../corpus/workbench/dropped.jsonl)）：
  - 与 `PLAIN_TERMS` 重复 7 条：药房、冻结、账户、社区、短信、二维码、链接；
  - 近义重复 5 条：病床/复查/病区（让床位/复诊/病房留下）、额度（保留限额）、恐吓（保留威胁）。
- **没有满足手册的 R1 三审全过 + safety=5**。R1 实际只有 A 一审；C/D 跑太久被停掉。
- 评审与改稿是并发的：评审读到过旧文本，`resolutions.json` 只能证明“改过”，不能证明“复评通过”。
- 没有人工审校，没有真人/老人测试。

## 6. 与手册的已知差异（下一批必须补）

1. **没有“每词 3 稿 + 共识”**：本批是单稿 + 多轮改稿；Step 5 的语义去重/共识没跑。
2. **没有三审**：R1 只有 A；C/D 超时。下一批要么提高评审超时/分批，要么换更快的评审模型。
3. **evidence 是模板**：manifest 每条 evidence 都是主题级场景句（如“医院叫号屏/自助机/收费单”），
   不是逐词截图或界面文案；Step 1 没真正满足。
4. **真实安装冒烟**：已用 `pnpm corpus:install` 安装到 `%APPDATA%\字伴\corpus`（7 个文件），
   并新增 release 全量 293 条 + `KnowledgeService.localLookup` 测试；应用启动日志已确认“语料库加载：293 条（7 个文件）”。小窗 OCR 因锁屏未跑，
   热加载/小窗显示/来源标签仍要在解锁桌面再验。
5. **拼音全省略**：这是有意的保守选择，不是遗漏；如果下一批要补拼音，必须逐条核对多音字。
6. **批号是 2026-11-a，生成于 2026-10-23**：按“计划发布月”命名，不是造假日期；
   如果要严格按生成月，改名时记得同步 manifest/source/source_ref 和评审记录的 batch_id。

## 7. 踩过的坑（下一位别再踩）

1. **本机词有两处**：`localLexicon.ts` 的 `SCREEN_TERMS`（105 条）**和**
   `packages/core/src/plainLanguage.ts` 的 `PLAIN_TERMS`（40 条）。
   只读前者会漏掉短信/二维码/社区/账户/冻结/链接/药房。lint 现在两处都读。
2. **运行时会静默截断超过 8 字的 word**（`slice(0,8)`）。本批同时修了运行时：先判长度再决定，
   超长整条丢弃；lint 仍提前拒绝。
3. **评审子代理会并发读正在改的文件**。这次 305→293 的过程中评审读到了旧稿；
   下一批要么冻结 drafts 后再评审，要么在评审记录里存文本 hash。
4. **子代理批量评审很慢**：260 条单批给了两个子代理，25 分钟没写完；A/B 也是分批才出来。
   大批量要拆成 50–80 条/评审，或先规则 lint 再让模型只看被标记的条目。
5. **PowerShell 控制台中文乱码**：用 read/write 工具或 Node 检查，不要根据控制台输出改 UTF-8 文件。
6. **生成脚本不要用 `inspect.py`**（会遮蔽标准库）。

## 8. 下一批建议顺序

1. 先补**评审器**：把评审拆成 50–80 条/批、加超时与重试；R1 必须拿到 3 份独立评审。
2. 再补**逐词 evidence**：至少一条界面文案/单据字段/FAQ 片段；没有就丢弃。
3. 用现有 293 条做 **30 条 canary**：装进 `userData/corpus` 自用 3 天，看小窗换行、
   来源标签、热加载、风险提示；再决定是否扩到 500 条。
4. **人工复核**：R1 四类（医疗/金融/政务/防骗）100% 人工看；抽 10 条给真实老人读，
   记录“听不懂/不想看”的原话。
5. 如果继续自动生成：**先跑 40 条锚点集 + 红队集**，坏样本检出率 ≥90% 再上量。

## 9. 安装与回滚

```text
Windows: %APPDATA%\字伴\corpus（`pnpm corpus:install`）
macOS:   ~/Library/Application Support/字伴/corpus
```

先备份旧 `*.json`，再复制 `corpus/release/*.json`；运行中 500ms 热加载。
回滚：删掉这 7 个文件，或把备份复制回去。不要把 `workbench/` 放进语料目录——
目录里任何 `.json` 都会被当成语料读取。

## 10. 交接检查清单

- [x] 7 个 release 文件、293 条、schema 通过、跨文件 0 重复
- [x] `source=auto-*`、UI 会标“机器审校 · 不一定对”
- [x] `pnpm corpus:lint` 0 hard fail / 0 warning
- [x] `pnpm check` 全绿（64 tests）
- [x] review.jsonl 每条有 judge 记录或 resolution；dropped.jsonl 有 12 条原因
- [x] CHANGELOG / docs/10 / AGENTS 已更新
- [ ] R1 三审（未完成，下一批第一件事）
- [ ] 人工审校 / 老人测试（未做）
- [x] 真实 userData 安装（7 文件；小窗 OCR 待解锁桌面复验）
- [ ] 逐词 evidence（现在是模板）

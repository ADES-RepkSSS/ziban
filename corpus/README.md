# 字伴语料库（实验批次）

> **状态：机器审校草稿。未经过人工审校，也没有做过老人可用性测试。**
> 只能叫“实验语料 / 机器审校草稿”，不能对外说“正式内容”“人工审校”“老人验证”。

这里放的是字卡之外的第二层知识：医院、银行、政务、手机、出行、防骗、购物七类屏幕高频词。
第一批 **293 条**，全部 `source=auto-*`，**机器审校草稿，未人工审校**。
运行时字伴只读本地 JSON，不联网抓取；文件改动 500ms 自动重载。

## 目录

```text
corpus/
  chars/common2000.txt    释义用字预算（1–2000 常用字）
  chars/README.md         字表来源与 Tier C 规则
  release/<theme>.json    运行时 JSON（7 个文件，source=auto-*）
  workbench/<batch>/      manifest / drafts / review / metrics（审计用，不进 userData）
  workbench/reviews/      Judge A/B/C 的原始评分
  workbench/additions/    子代理补充词条（合并前）
  SOURCES.md              来源类型、许可、source_ref 索引
  RELEASE.md              本批 release_id、清单、已知问题
```

## 流水线

```bash
pnpm corpus:lint          # 硬 lint：schema、字数、去重、用字覆盖、安全、拼音
pnpm corpus:lint -- --drafts   # 检查 workbench 里的草稿
pnpm corpus:review        # 合并 Judge A/B/C + lint → <batch>/review.jsonl
pnpm corpus:build         # 只把 final=release 的词条写进 corpus/release/
pnpm corpus:validate corpus/release/*.json   # 原 schema 校验（PowerShell 用 Get-ChildItem 逐个传）
```

流程：manifest（冻结词表）→ drafts.jsonl（生成稿）→ 硬 lint → Judge A/B（R1 加三审）
→ review.jsonl（每条的分数与理由）→ build → validate → 安装到 `<userData>/corpus`。

## 与运行时的兼容契约

`apps/desktop/electron/capabilities/knowledge/corpus.ts` 的要求，改动数据前先看：

- `version` 必须是 `1`；顶层只允许 `version/name/license/entries`。
- 每条只允许 `word/pinyin/definition/example/source`；多一个字段就是 schema 违规。
- `word` 1–8 字；超过 8 字现在会被**整条丢弃**（不再静默截断），lint 会提前拒绝。
- `definition` 必填，运行时清洗/截到 120 字；空释义整条丢弃。
- `pinyin` 可选；省略时由 `pinyin-pro` 本机兜底。本批全部省略拼音，避免多音字误标。
- `source` 以 `auto-` 开头时，UI 显示“机器审校 · … · 不一定对”，置信度降为 medium。
- 同一 `word` 在所有 release 文件里必须唯一：运行时 Map 是后写覆盖，readdir 顺序跨平台不稳定。

## 安装（可选，需本人操作）

Windows：`%APPDATA%\字伴\corpus`；macOS：`~/Library/Application Support/字伴/corpus`。

```bash
pnpm corpus:install                 # 复制 7 个 release JSON
pnpm corpus:install -- --dry-run    # 只看路径
```

先备份旧文件；应用运行中会在 500ms 内热加载。不要复制 `workbench/`。
不安装也能验收：`pnpm corpus:lint` + `pnpm corpus:validate` 已覆盖格式与内容门槛；
程序内加载由 67 个测试里的 4 个语料测试覆盖。

## 不要做

- 不要把 `workbench/` 里的 manifest/review 放进 userData/corpus（任何 .json 都会被当语料读）。
- 不要把机器审校说成人工审校，也不要用这批内容对外宣称“老人已验证”。
- 不要为了凑数降低通过线；R1 词没有三审就留在 workbench，不发布。

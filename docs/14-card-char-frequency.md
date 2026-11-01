# 14 · 词卡单字频率统计

> 状态：2026-10-28 新增的本地小工具；只读工作区文件，不联网。
> 目的：给“生词 AI”和内容同学一张**现有词卡的用字频率表**，在扩词/写新卡时避开已经反复出现的字，降低一批卡里来回只有“电、证、卡、车”几个字的拥挤感。
>
> 这不是查重工具，也不判断词好不好；它只回答一个问题：**现有词卡的目标词里，每个汉字出现了多少次？**

## 1. 为什么需要它

550 张卡里，“电”出现在 17 张卡的目标词里，“证”15 张，“车”14 张，“卡”13 张。单张卡没有问题，但扩量时如果继续选“电话、电视、电梯、电费、电线……”，新一批卡会继续围绕同一个字，老人看到的字形重复度就会过高。

这个工具把现有卡片的单字频次摊开，供下一批选词时参考：

- 哪些字已经出现很多次，应该缓一缓；
- 哪些字还没出现过，可以优先选；
- 某个候选词的全部字是否都已经被反复使用。

它**不**替代 `pnpm content:validate`、语料 lint 或人工审校；它只是选词阶段的一张参考表。

## 2. 快速开始

```bash
# 在仓库根目录
pnpm cards:chars

# 等价于
node scripts/card-char-frequency.mjs
```

默认统计 `content/cards/level1.yaml` + `level2.yaml`，也就是当前 550 张卡的目标词（50 张基线 + 500 张扩量），只统计汉字。

输出（`text` 格式，`单字<TAB>出现次数`，按次数从多到少）：

```text
药	10
费	10
卡	10
站	10
车	10
电	10
证	10
机	10
票	10
号	9
...
```

摘要写到 stderr，不污染 stdout：

```text
✓ 550 张卡 · 526 个单字 · 1209 次出现 · 字段 text · 只计汉字
```

只看前 30：

```bash
pnpm cards:chars -- --top 30
```

> Windows 控制台如果显示乱码，先 `chcp 65001`。另外，PowerShell 5.1 的 `Get-Content` 会把**无 BOM 的 UTF-8** 当成 GBK，看到乱码不代表文件坏了；请用 VS Code、浏览器或 `read` 工具打开文件，不要用 `Get-Content` 的结果判断编码。

## 3. 统计口径（先看这一节）

| 项 | 默认规则 | 说明 |
|---|---|---|
| 卡片来源 | `content/cards/level1.yaml`、`level2.yaml` | 共 550 张，是 App 构建的源文件；不是 `work/` 里的副本 |
| 统计字段 | 目标词 `text` | 批次草稿文件用 `word`；释义/例句默认不计 |
| 字符范围 | 汉字（Unicode `Script=Han`） | 标点、字母、数字默认跳过；见 `--include-non-han` |
| 计数单位 | 出现次数 | 一个字在目标词里出现两次就算 2 次 |
| 卡数 | 包含该字的卡片张数 | 同一张卡里出现两次，卡数仍只加 1 |
| 排序 | 次数降序 → 卡数降序 → 首次出现顺序 → 码点 | 同频时先看卡数，再看谁先出现；结果稳定 |
| 去重 | 按 `id` + 目标词 | 同一张卡的副本只算一次；同 id 不同词直接报错 |
| 简繁 | 不转换 | “电”和“電”算两个不同的字 |
| 拼音 | 不统计 | 只看字形，不看读音 |

### 3.1 为什么默认只统计目标词

“避免同一个字反复在词卡中出现”，指的是**选词层面**的重复：新卡的目标词最好不要再围绕已经出现 10 次以上的字。

如果连释义和例句一起统计，“的、一、是、不”这类功能字会立刻排到最前面（实测 `text+meaning` 时“的”出现 386 次），把真正需要关注的选词信号淹没。因此：

- 默认 `--field text`：只回答“目标词用了哪些字、各多少次”；
- 需要看释义/例句用字时，显式加 `--field meaning`、`--field sentence` 或 `--field all`；
- 多字段的合计**不能**和默认表直接比较，它是“整张卡面文本”的用字量，不是选词重复度。

### 3.2 次数和卡数的区别

当前 550 张卡没有“爸爸、天天”这类词内叠字，所以大多数条目的次数 = 卡数。但工具仍然区分两者：

```text
天	2	1
```

表示“天”在目标词里出现 2 次，但只在 1 张卡里出现。选词时更该看**卡数**；`次数`保留原始出现频次，便于和“所有单字”的字面要求对齐。

### 3.3 去重规则

- 同 `id`、同目标词：视为同一张卡的副本，只统计先读到的一张，摘要显示“跳过重复卡 N”。
- 同 `id`、不同目标词：报错并指出两个来源，避免把两个版本混在一起算。
- 没有 `id` 的临时卡片：每一条都独立统计；如果确实要连有 `id` 的副本一起统计，用 `--no-dedupe`。

典型场景：`work/cards500/cards.yaml` 和 `work/cards500/cards.json` 是同一批 500 张卡的两种格式；把整个目录传给工具时，会先读 YAML 源、再按 id 去重，不会算成 1000 张。默认输入只读 `content/cards`，本来就不会碰到这些副本。

### 3.4 目录里会读哪些文件

`--input` 传目录时**不递归**，只读以下文件名：

- `level*.yaml` / `level*.yml`（`level1.sample.yaml` 不算）；
- `cards.yaml` / `cards.yml` / `cards.json`；
- `*.out.json`（内容批次的输出）。

这样 `content/cards/` 只会读两张正式卡表；`work/cards500/` 只会读 `cards.yaml` 和 `cards.json`（自动去重）；`work/cards500/batches/` 只会读 `*.out.json`，不会把输入批次和 `visuals.json`、`seed.json` 一起误读。

其他文件名（例如 `my-cards.json`）请直接传文件路径。CSV 不支持；需要时先从 `cards.csv` 导出 JSON，或直接用 YAML/JSON 源。

## 4. 常用命令

| 目的 | 命令 |
|---|---|
| 默认 550 张、全部单字 | `pnpm cards:chars` |
| 只看前 30 | `pnpm cards:chars -- --top 30` |
| 只看出现 ≥ 5 次的字 | `pnpm cards:chars -- --min 5` |
| 输出 JSON（给程序/AI 读） | `node scripts/card-char-frequency.mjs --format json --output work/char-stats/cards-550.json` |
| 输出 Markdown 报告 | `node scripts/card-char-frequency.mjs --format markdown --output work/char-stats/cards-550.md` |
| 输出 CSV（Excel） | `node scripts/card-char-frequency.mjs --format csv --output work/char-stats/cards-550.csv` |
| 只看 500 张扩量卡 | `node scripts/card-char-frequency.mjs --input content/cards/level2.yaml` |
| 只看某一批草稿 | `node scripts/card-char-frequency.mjs --input work/cards500/batches/batch-01.out.json` |
| 选词时同时看目标词 + 释义 | `node scripts/card-char-frequency.mjs --field text --field meaning --top 50` |
| 把现有卡和一批新草稿合起来预估 | `node scripts/card-char-frequency.mjs --input content/cards --input work/cards500/batches/batch-01.out.json` |

最后一条会把已有卡和新草稿中**新 id** 的卡一起统计；相同 id 且同词的副本会去重。它适合回答“如果这批加进去，某个字会到多少次”，不适合代替合并后的正式重建。

### 4.1 常用选项

```text
-i, --input <路径>      卡片文件或目录，可重复；目录规则见 3.4
-f, --field <字段>      text | meaning | sentence | alt | all，可重复；默认 text
-t, --top <n>           只输出前 n 个；0 = 全部（默认）
-m, --min <n>           只输出出现次数 >= n 的字；默认 1
    --format <格式>     text | tsv | csv | json | markdown；默认 text
-o, --output <路径>     写入 UTF-8 文件；默认输出到 stdout
    --include-non-han   非汉字也计数（默认只计汉字；空白始终不算）
    --no-dedupe         不按卡片 id 去重（默认去重）
-q, --quiet             不打印摘要
-h, --help              帮助
```

`--field all` 等价于 `text + meaning + sentence + alt`；`alt` 取 `image.alt`，批次草稿取 `image_alt`。`--field` 可以重复，顺序不影响总数，只影响同频时的“首次出现”顺序。

## 5. 输出格式

### 5.1 `text`（默认）

每行两列，制表符分隔，**没有表头**，方便 `awk`、Excel 导入或直接看：

```text
电	17
证	15
```

摘要只在 stderr。适合“我只要单字和次数”的场景。

### 5.2 `tsv` / `csv`

带表头 `单字、次数、卡数`：

```text
单字	次数	卡数
电	17	17
证	15	15
```

写 CSV **文件**时会加 UTF-8 BOM，Excel 直接打开中文不乱码；输出到 stdout 时不加 BOM。CSV 字段会按标准规则转义（`--include-non-han` 时可能出现逗号、引号）。

### 5.3 `json`

给程序或 AI 读取的稳定结构：

```json
{
  "schemaVersion": 1,
  "fields": ["text"],
  "includeNonHan": false,
  "inputs": ["content/cards/level1.yaml", "content/cards/level2.yaml"],
  "cards": 550,
  "uniqueChars": 526,
  "totalOccurrences": 1209,
  "skippedNonHan": 0,
  "duplicateCards": 0,
  "shown": 526,
  "filters": { "min": 1, "top": 0 },
  "counts": [
    { "char": "药", "count": 10, "cardCount": 10, "firstCard": "药" }
  ]
}
```

- `counts` 已按排序规则排好；
- `shown` 是当前 `--top` / `--min` 后的条数；
- `uniqueChars` / `totalOccurrences` 始终是过滤前的全量；
- `firstCard` 是这个字第一次出现的那张卡的目标词，便于人工回查；
- 没有时间戳，同样的输入会得到同样的 JSON，方便 diff。

### 5.4 `markdown`

生成可直接贴进交接文档的表格：卡片数、不同单字、总次数、跳过非汉字、去重数，以及完整的“排名 / 单字 / 次数 / 卡数”表。适合发给内容同学，不适合程序解析。

### 5.5 `--top` 与 `--min`

两者只影响输出条数，不影响摘要里的总数和 JSON 的全量统计字段：

```bash
# 只看前 10 个
pnpm cards:chars -- --top 10

# 只看出现 5 次以上的字
pnpm cards:chars -- --min 5
```

## 6. 给“生词 AI”的推荐用法

1. **先取基线**：跑一次 JSON，保存为 `work/char-stats/cards-550.json`。
2. **给候选词打分**：一个候选词的分值可以简单定义为它每个字的现有 `count` 之和；同时记录“有几个字已经出现 ≥ 3 次”。
3. **优先新字**：候选词里全是 0–1 次字 → 优先；有 2 次字 → 可以接受；有 2 个以上 ≥ 3 次的字 → 除非这个词是老人必须会的，否则换词。
4. **不要把高频字当禁用字**：“电、证、卡、钱”本身就是老年生活高频词，不能为了降频把“电话、身份证、银行卡”全部换掉。目标是**降低同一批卡的字形拥挤**，不是把频次清零。
5. **和查重分开**：本工具只数单字，不检查词是否重复、释义是否合格、图片是否存在；合并前仍要跑 `pnpm content:validate` 和对应批次检查。
6. **合并后重跑**：新卡进入 `content/cards` 后再跑一次，记录新的 Top 20；不要手改历史报告。

一个最小的手工检查方式（不需要额外依赖）：

```js
const { counts } = JSON.parse(
  require('node:fs').readFileSync('work/char-stats/cards-550.json', 'utf8'),
);
const freq = new Map(counts.map(({ char, count }) => [char, count]));
for (const word of ['电梯', '空调', '燃气']) {
  const detail = [...word].map((ch) => `${ch}:${freq.get(ch) ?? 0}`).join(' ');
  const total = [...word].reduce((sum, ch) => sum + (freq.get(ch) ?? 0), 0);
  console.log(word, detail, '合计', total);
}
```

这段只用于说明打分口径，不是项目的一部分；实际选词时按批次规模、场景和风险词再判断。

## 7. 当前基线（2026-10-28 快照）

```bash
pnpm cards:chars
```

| 指标 | 值 |
|---|---:|
| 卡片 | 550 |
| 不同单字 | 526 |
| 总出现次数 | 1209 |
| 只出现 1 次 | 265 个字 |
| 出现 ≥ 2 次 | 261 个字 |

Top 10：

| 排名 | 单字 | 出现次数 | 卡数 |
|---:|---|---:|---:|
| 1 | 药 | 10 | 10 |
| 2 | 费 | 10 | 10 |
| 3 | 卡 | 10 | 10 |
| 4 | 站 | 10 | 10 |
| 5 | 车 | 10 | 10 |
| 6 | 电 | 10 | 10 |
| 7 | 证 | 10 | 10 |
| 8 | 机 | 10 | 10 |
| 9 | 票 | 10 | 10 |
| 10 | 号 | 9 | 9 |

对照：

- 2026-11-01 做过一次词卡重排（删 28 张低价值/重复卡、换 3 张、补 28 张），把最高频字从 17 降到 10、1 次字从 282 降到 265；重排记录见 `work/char-audit/rebalance-map.json`。
- 只算 500 张扩量卡：重排前是 `500 张 / 517 个不同单字 / 1130 次出现`（与 `work/cards500/stats-final.json` 的 `uniqueTargetChars: 517` 一致）；重排后以 `pnpm cards:chars --input content/cards/level2.yaml` 为准。

> 这些数字会随内容更新变化；以当场运行结果为准，不要把它当永久事实。

## 8. 实现与维护

```text
scripts/card-char-frequency.mjs        CLI：读文件、解析参数、格式化输出
scripts/lib/card-char-frequency.mjs    纯函数：拆字、计数、去重、排序
docs/14-card-char-frequency.md         本文
work/char-stats/                       可选的生成报告（不参与构建）
```

- 不新增依赖：YAML 使用仓库已有的 `yaml`；Node >= 20。
- 默认只读；只有 `--output` 会写文件。不会调用网络、不会写 `content/`。
- 新增统计字段时，在 `scripts/lib/card-char-frequency.mjs` 的 `SUPPORTED_FIELDS` / `FIELD_ALIASES` / `fieldValue()` 三处同步，并更新本文第 3、4 节。
- 目录扫描规则集中在 `scripts/card-char-frequency.mjs` 的 `CARD_FILE_PATTERN` / `BATCH_FILE_PATTERN`；扩大规则时注意不要误读 `visuals.json`、`seed.json`、预览 HTML 或生成 JSON。
- 本工具目前没有加入 `pnpm test` 的 67 个测试（避免为一个离线小工具改动既有测试基线）；可用 `--help`、`--top`、单文件/目录输入和下面的命令手工验收。

### 8.1 手工验收

```bash
# 1. 默认 550 张
pnpm cards:chars -- --top 3

# 2. 500 张扩量卡
node scripts/card-char-frequency.mjs --input content/cards/level2.yaml --top 3

# 3. 一批草稿（word 字段）
node scripts/card-char-frequency.mjs --input work/cards500/batches/batch-01.out.json --top 3

# 4. 目录输入自动去重（work/cards500 同时有 cards.yaml 和 cards.json）
node scripts/card-char-frequency.mjs --input work/cards500 --top 3

# 5. JSON 可解析、字段齐全
node scripts/card-char-frequency.mjs --format json --quiet | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); if(j.cards!==550||j.uniqueChars!==526) process.exit(1); console.log('json ok')})"
```

预期：第 1 步 `药 10 / 费 10 / 卡 10`；第 2 步以 500 张扩量卡的实际输出为准（重排后已变化）；第 4 步摘要出现“跳过重复卡 500”。

### 8.2 生成当前报告

```bash
node scripts/card-char-frequency.mjs --format markdown --output work/char-stats/cards-550.md
node scripts/card-char-frequency.mjs --format json --output work/char-stats/cards-550.json
node scripts/card-char-frequency.mjs --format csv --output work/char-stats/cards-550.csv
node scripts/card-char-frequency.mjs --output work/char-stats/cards-550.txt
```

当前快照：[cards-550.md](../work/char-stats/cards-550.md) ·
[cards-550.json](../work/char-stats/cards-550.json) ·
[cards-550.csv](../work/char-stats/cards-550.csv) ·
[cards-550.txt](../work/char-stats/cards-550.txt)。

报告是生成物，卡片变化后重跑即可，不要手改。

## 9. 限制与非目标

- 不判断词义是否合适、是否重复、是否在 common2000 内、图片是否存在；这些仍由 `pnpm content:validate` / 语料 lint / 人工审校负责。
- 不做分词；只按 Unicode 码点拆单字，所以“银行卡”会拆成 `银 / 行 / 卡`，不会把“行”读成多音字。
- 不合并简繁、异体字；“电”和“電”、“台”和“臺”分别统计。
- 不统计拼音、图片、SVG；`alt` 只有显式 `--field alt` 才统计。
- 多字段合计是“卡面文本用字”，不能当成“目标词重复度”；看选词信号时请保持默认 `text`。
- 目录扫描不递归，也不读 CSV；特殊文件名请直接传文件。
- 默认跳过非汉字；如果目标词里混有字母/数字，摘要会显示跳过了多少个，确认是否需要 `--include-non-han`。
- 报告不自动刷新；卡片更新后以重跑结果为准。

## 10. 相关文档

- [AGENTS.md](../AGENTS.md)：项目硬约束、命令与交接规则。
- [docs/01-ai-content-pipeline.md](01-ai-content-pipeline.md)：C1 选词与内容流水线。
- [docs/10-corpus-handoff.md](10-corpus-handoff.md)：语料库格式与批次生成提示词。
- [content/README.md](../content/README.md)：卡片、图片、字表维护。
- [schema/card.schema.json](../schema/card.schema.json)：卡片字段定义。
- `work/cards500/README.md`：500 张扩量卡的交付说明与已知限制（原始生成包，本地保留，不随仓库提交）。
- `work/cards500/HANDOFF.md`：500 张卡的生成/校验流水线（原始生成包，本地保留，不随仓库提交）。

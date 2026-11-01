# 词卡替换整合风险评估（20–35 张，总数 550 / 8 场景配额不变）

> 性质：**只读分析**，没有改动 `content/`。
> 依据：2026-10-28 仓库现状（实测，不是假设）。所有脚本名、路径、行号都来自当前工作区。
> 一句话结论：**改 `content/cards/level2.yaml`（少数动 `level1.yaml`）+ 把新图放进 `content/images/`；
> `pnpm content:validate` 只看结构与「释义用字」，`pnpm check` 才会碰到语料 lint / 测试 / 文档链接；
> `pnpm content:build` 重生成 `apps/web/src/content/cards.generated.json` 与 `apps/web/public/images/`，这两个是生成物，永远不要手改。
> 550 总数、场景配额、level 配额在代码里没有任何断言，靠「同 id / 同 scene / 同 level / 同位置的原位替换」保证。**

---

## 0. 现状事实（先对齐基线）

| 项 | 实测值 | 来源 |
|---|---|---|
| 卡片总数 | **550** = `level1.yaml` 50 + `level2.yaml` 500 | `content/cards/*.yaml` |
| 场景分布 | health 82 · money 78 · travel 66 · home 86 · contact 67 · gov 60 · shopping 54 · safety 57 | 逐卡统计 |
| level 分布 | L1 208 · L2 248 · L3 94 | 逐卡统计 |
| 词长 | 1 字 9 · 2 字 424 · 3 字 101 · 4 字 16 | 逐卡统计 |
| id 族 | `level1` 用 `c_*`（gen.model=`human`，prompt_ver=`seed@1`）；`level2` 用 `w_*`（`deepseek-flash` / `cards500@1.0`） | YAML |
| 图片 | `content/images/` **552 张 SVG** = 52 张语义名（`atm.svg`、`hospital.svg`…）+ 500 张 `cards500-001.svg`…`cards500-500.svg`；550 张卡各引用 1 张、**无共用**；另有 2 张只给文章用：`community.svg`、`phone-permission.svg` | 目录 + 引用统计 |
| 字表 | `content/charset.level1.txt` **191 字**；`content/charset.level2.txt` **2000 字**，与 `corpus/chars/common2000.txt` **字节完全相同**（SHA256 `0FB049AC…D9EBE`） | 实测 |
| 生成物（被 git 跟踪） | `apps/web/src/content/cards.generated.json`（542,295 B）、`apps/web/public/images/*`（552 个） | `git ls-files` |
| 生成物（gitignore） | `apps/desktop/resources/`（含 `cards.generated.json`） | `.gitignore` |
| 当前门禁状态 | `node scripts/validate-content.mjs` → `✓ 550 张卡片全部通过 schema 与内容门禁`，**0 条警告**，退出码 0 | 实跑 |
| 工作区状态 | **不干净**：6 个已修改文件 + 9 个未跟踪路径（含 `work/cards500/`、`work/char-stats/`、`docs/14`、`scripts/card-char-frequency.mjs`） | `git status --porcelain` |
| 测试 | 项目内只有 3 个测试文件（`schedule.test.ts`、`text.test.ts`、`articles.test.ts`），**没有任何一个断言 550 或场景数** | `glob **/*.test.ts` |

⚠️ 两条容易误判的事实：

1. **`schema/card.schema.json` 不被任何脚本读取**。`scripts/lib/content.mjs:29` 只是把路径导出成 `SCHEMA_FILE`，全仓库没有第二处使用。真正生效的是同文件里的 **Zod schema（:31–103）**。改 JSON Schema 不会改变任何门禁；两边的字段必须人工保持同步。
2. **`work/cards500/*.mjs` 是本地工具，全部未跟踪**（`git ls-files work/cards500` = 0）。其中 `merge-cards.mjs`、`validate-cards.mjs` 都**硬性假设 500 条**且只读写 `work/cards500/`，不参与 `pnpm check`。不要为了让它们通过而去改 `content/`。

---

## 1. 替换一张卡时必须同步的字段 / 文件

### 1.1 单卡字段清单

真实门禁在 `scripts/lib/content.mjs` 的 `loadCards()`；表里的「级别」是它的行为，不是文档说法。

| 字段 | 替换时 | 门禁 / 后果 |
|---|---|---|
| `id` | **默认保留** | 重复 → error（:151）。它是进度的主键，见 1.2 |
| `text` | **必改** | ≤6 字；必须 `=== chars.join('')`（:157）；重复词条只 warning（:154） |
| `chars` | **必改** | 每项 1 个字符的数组；顺序即 `text` 的拆字顺序，拼音按这个下标对齐 |
| `pinyin` | **必改** | 数量必须 `=== chars.length`（:160）；**值本身不校验**（不查声调符号、不查多音字） |
| `level` | 原位替换**不动** | 1/2/3；影响 `learningOrder()` 的排序（`packages/core/src/schedule.ts:60-70`） |
| `scene` | 原位替换**不动** | 8 枚举之一；决定学习分组与「场景配额」 |
| `meaning` | 视情况改 | ≤20 字；**不得含英文/数字/括号**（:163，error）；`。！？` 只 warning（:166）；汉字必须 ⊆ 本文件字表（:185–199，error） |
| `meaning_source.dict` | 保持 `self` | 只能是 `zhwiktionary` / `cc-cedict` / `self` |
| `meaning_source.entry` | **必改成新词** | **没有任何交叉校验**，最容易留旧词残影 |
| `meaning_source.rev` | 建议改成批次号（如 `replace-2026-10`） | 不校验 |
| `sentence` | 建议改 | ≤30 字；**不做用字检查**（`level2.yaml` 现有 49 张例句本来就有表外字） |
| `sentence_source` | 有 `sentence` 就保留/更新 | 有例句却没 source → warning（:178） |
| `image.file` | 复用或新增 | **必须存在于 `content/images/`**，否则 error（:169）；文件名规则见 §3 |
| `image.alt` | **必改**（图变了 alt 必须变） | 缺了只 warning（:175），但它是无障碍文案 + 「看图」朗读词（`LearnPage.tsx:108`、`CardImage.tsx:23-45`） |
| `image.lib` / `license` | 不动 | `lib` 只能 `self/arasaac/openmoji/mulberry/openverse`；`license` 非空 |
| `confusables` | **改或删** | 只要求「≥1 个非空字符串」；**不校验单字、不校验与 text 无关**。替换后留着旧词形近字是最常见的残影 |
| `status` | 保持 `draft` | 政策（docs/13）禁止标 `human_ok`/`published` 来暗示人工审校 |
| `gen.model` / `prompt_ver` / `hash` | **必改**，标记替换批次 | 三个都必填非空（:95–101）；**hash 不与内容比对**，只是批次标签（HANDOFF §8 也说它只是 16 位前缀） |
| `review` | 一般不动 | 可选；`redteam` / `human` 结构是 strict 的 |

**禁止写进 YAML 的字段**（Zod 是 `.strict()`，多一个就报错）：`imageUrl`、`order`（构建注入）、`visual`、`word`、`image_alt`、`entry`、`source_ref` 等任何 schema 外键。
> 特别提醒：`content/cards/level2.yaml` 的字段叫 `text`；`work/cards500/batches/*.out.json` 和批次脚本用的是 `word` / `image_alt` / `visual`。**把批次 JSON 的条目直接粘进 YAML 会立刻 strict 报错**。

### 1.2 id 到底保不保留

| 方案 | 好处 | 代价 |
|---|---|---|
| **保留 id（推荐）** | 550 总数、`order`、场景/level 配额、学习顺序 100% 不变；老用户进度连续（`localStorage` key `ziban.progress.v1` 按 id 记 `seen/due`） | id 不再与词一一对应，必须靠 `work/char-audit/` 的替换记录 + git 历史追溯；已学过旧词的用户**不会**把新词当「新卡」再学一遍，只会按 1/3/7/14/30 天复习节奏出现 |
| 换新 id（`w_501` 起） | 学习端会把新词当全新卡 | 旧 id 的进度变孤儿：`learnedCards()` 仍统计它（`HomePage.tsx:185`「你已经认了 N 个字」会虚高）；`dueCount()` 这类按 progress 统计的函数也会把孤儿算进去（目前 UI 没用到它，将来接「今日到期」会偏大）；`pickSessionCards` 的复习队列只从当前 deck 取，所以不会翻出已删卡；图片名/id 约定要一起改；`cards:chars` 若同时读到「同 id 不同词」会**直接抛错**（`scripts/lib/card-char-frequency.mjs:144-149`） |

**建议：保 id。** 这一批是 draft 原型内容，进度连续性比「让 20–35 个词重新进新卡队列」更重要。

### 1.3 跨文件同步清单（一次替换批要动的全部文件）

| 文件 | 动作 | 是否必须 |
|---|---|---|
| `content/cards/level1.yaml` / `level2.yaml` | 改卡片条目（保持键顺序与 2 空格缩进，见 §6 坑 1） | **必须** |
| `content/images/<新图>.svg` | 新增（或复用旧图则不动） | 换图时 |
| `content/charset.level1.txt` | 只有动 `level1` 的 text/meaning 时才涉及；它是**派生快照**（见 §2.3） | 建议，非门禁 |
| `content/charset.level2.txt` | 只有「释义必须用表外字」时才动 | 极少，且有副作用 |
| `apps/web/src/content/cards.generated.json` | `pnpm content:build` 自动重写；**提交** | 必须（生成） |
| `apps/web/public/images/*` | `pnpm content:build` 先清空再全量复制；**提交** | 必须（生成） |
| `apps/desktop/resources/cards.generated.json` | 打桌面版时由 `pnpm desktop:prepare` 复制；gitignore | 仅桌面 |
| `work/char-audit/<批次>-replacements.md` | **建议新建**：旧 id/旧词 → 新词、谁改的、为什么 | 建议 |
| `work/char-stats/cards-550.{md,json,csv,txt}` | 若重跑 `cards:chars`，**保持同名覆盖**（`docs/14:327-330` 链接这四个文件） | 可选 |
| `CHANGELOG.md` | `Unreleased` 记一条 | 建议 |
| `AGENTS.md` / `content/README.md` / `docs/05` | **只在图片总数或卡片总数变化时**改（本批不变就不用动） | 条件 |

---

## 2. 新词用字不在 charset 怎么办 / `pnpm content:validate` 到底查什么

### 2.1 门禁的真实语义（`scripts/lib/content.mjs`）

| 检查 | 位置 | 失败级别 |
|---|---|---|
| 只读 `content/cards/level*.yaml`（`level1.sample.yaml` 不匹配，**不参与构建**） | :110–113 | — |
| 顶层必须是数组 | :133 | error |
| Zod 结构：必填字段、类型、枚举、`text ≤6`、`meaning ≤20`、`sentence ≤30`、**多余字段报错** | :31–103 | error |
| `id` 全局唯一 | :148–152 | error |
| `text === chars.join('')` | :157 | error |
| `pinyin.length === chars.length` | :160 | error |
| `meaning` 不含 `A-Za-z0-9()[\]{}<>《》【】` | :163 | error |
| `meaning` 含 `。！？` | :166 | warning |
| 图片存在：`content/images/<image.file>` | :169 | error |
| 缺 `image.alt` | :175 | warning |
| 有 `sentence` 却没 `sentence_source` | :178 | warning |
| 重复 `text` | :154 | warning |
| **`meaning` 的汉字 ⊆ 本文件字表** | :185–199 | error |

字表映射写死在 `:185–188`：`level1.yaml → charset.level1.txt`，`level2.yaml → charset.level2.txt`；其他文件名回落到 level1 字表。

**它明确不检查**（这些都得靠别的手段）：

- `text` / `chars` / `sentence` 的用字是否在 charset / common2000；
- 总数 550、场景配额、level 配额、每个场景至少几张；
- `image.file` 是否被多张卡共用、图片尺寸/格式/内容；
- `pinyin` 是否正确（只数个数）；
- `confusables` 是否单字、是否与 `text` 相关；
- `meaning_source.entry` 是否等于 `text`、`gen.hash` 是否与内容匹配；
- YAML 的缩进/风格（但 `corpus-lint` 依赖它，见 §6 坑 1）；
- `status`（draft 不拦）。

### 2.2 三种「表外字」情形，处理方式完全不同

| 情形 | 门禁会不会红 | 要不要改 charset | 建议 |
|---|---|---|---|
| **A. 新词的 `text` 里有表外字** | **不会**（`text` 根本不查） | 不需要 | level2 换词：`work/cards500/HANDOFF.md` §5.3 承诺「目标词 100% 落在 common2000」，`work/cards500/validate-cards.mjs:73-75` 也只对批次做这条检查；新词表外字会让承诺悄悄失效。**注意 level1 不适用这条**：level1 走自己的 191 字「已学字表」，实测 `转账`（「账」）和 `视频`（「频」）里的这两个字都不在 common2000，属于允许 |
| **B. 新 `meaning` 里有表外字** | **会红**：`[error] w_123: 释义用了字表外的字「X」：「…」` | 二选一：改写释义（首选）或加字到对应字表 | **优先改写**。level2 的目标是 2000 字内；level1 只有 **191 字**（见 2.3），几乎必然要重写措辞 |
| **C. 新 `sentence` 里有表外字** | **不会**（例句不查） | 不需要 | 现状就有 49 张 level2 例句含表外字；保持口语自然即可，别为门禁牺牲句子 |

**一句话**：`text` / `sentence` 的用字**不必**动 charset；只有 **`meaning` 的表外字**必须处理（优先改写、其次加字）；动过 `level1` 的 text/meaning 之后，建议**手工**同步那 191 字的「已学字」表以保持语义一致（它不是门禁，但它是给人看的约束）。

### 2.3 level1 的字表是「派生快照」，别拿它放水

实测：`content/charset.level1.txt` 的 191 个字 **恰好等于** `level1.yaml` 里全部 `text` + `meaning` 的汉字并集（79 个目标词字 + 112 个释义补充字）。

```bash
# 这不是巧合，是 tools/build_charset.py 的产物：
#   它读 content/cards/level1.yaml，收集 chars:[…] 里的字 + 每行 meaning 里的字，排序后按 24 字/行写出
python tools/build_charset.py   # ← 会覆盖 content/charset.level1.txt 并重写文件头注释
```

推论：

- 只要改动 `level1.yaml` 的 **text 或 meaning**，这个文件就已经「不描述现状」了（哪怕门禁不红）。
- **不要**在替换批里顺手跑 `tools/build_charset.py`：它会让白名单自动吸收所有新用法，门禁从「已学字约束」退化成「当前 50 张卡用过什么字」——自我证明，挡不住任何东西。该脚本只读 `level1.yaml`（`docs/12` 里说「现在会读 `level*.yaml`」是过期说法）。
- 正确做法：**手工往 `charset.level1.txt` 里补/删那几个字**（任意空白分隔都能被 `loadCharset()` 读到；但它是按码点排序、24 字/行生成的，手改后与生成器输出不一致，要在提交说明里写清楚）。
- `charset.level2.txt` 是另一回事：它与 `corpus/chars/common2000.txt` **字节相同**，是外部字频表的产物，文件头写着「请勿手改排序」。往这里加字会造成两个文件分叉，而 `corpus-lint` 用的是 `common2000.txt`（覆盖率阈值 <90% 直接 error）——所以**别加**。

### 2.4 `pnpm content:validate` 之外还有一道会炸的闸：`corpus-lint`

`scripts/corpus-lint.mjs:137`：

```js
if (ctx.cards.has(word)) bad('dup-card', '与字卡重复：' + word);
```

- `ctx.cards` 来自 **只读 `content/cards/level1.yaml`** 的 `^ {2}text:\s*(\S+)/gm`（:51–52）。
- 也就是说：**如果你把某张 level1 卡换成 `corpus/release/*.json` 里已经存在的词，`pnpm corpus:lint`（`pnpm check` 的第二步）会红**，而 `content:validate` 完全不会提示。
- 反方向没人管：`level2.yaml` 里约 280 个与语料重名的词一直是允许的（`content/README.md` 的统计；lint 只读 level1）。
- `corpus-lint` 目前是绿的，说明现在 50 张 level1 的词与 `corpus/release` 没有重叠；只要「新词不在 `corpus/release/` 里」就安全。批量选词时先搜一遍 `corpus/release/`。

---

## 3. 图片：命名、生成、复制；apps/web 要不要改

### 3.1 命名规则（硬规则，来自 Zod）

```
image.file  ^[A-Za-z0-9][A-Za-z0-9._-]*\.(svg|png|jpe?g|webp)$
```

- **只能是文件名**，不能带 `/`、`\`；不能中文、不能空格（`scripts/lib/content.mjs:61-65`）。
- 现存两族：52 张语义名（`atm.svg`、`medicine-box.svg`、`hospital.svg`…）+ 500 张 `cards500-NNN.svg`（NNN 与 `id` 的 seed 编号对应，YAML 顺序里并不连续）。
- 现有 550 张卡 **没有任何两张共用同一张图**（`content:validate` 不查这条，但 `work/cards500/validate-cards.mjs:86` 查；维持一卡一图更稳）。

### 3.2 三种做法

| 做法 | 什么时候用 | 操作 | 风险 |
|---|---|---|---|
| **复用现有 SVG** | 新词与旧词是同一类物件（药→药片、卡→卡） | `image.file` 保持不变，只改 `image.alt` | alt 忘记改 → 朗读说错图；最省事但容易偷懒 |
| **新画 / 新拷一张** | 20–35 张里真正换了物件的那些 | 复制一张同族 SVG 改成新路径重画，存 `content/images/<ascii-name>.svg`，YAML 写新文件名 | 必须真在 `content/images/` 里存在，否则 error |
| 走 500 张生成器 | **不推荐**（≤35 张不值当） | `python work/cards500/generate_svgs.py --cards <json> --visuals … --out …` | 见下 |

生成器细节（`work/cards500/generate_svgs.py`）：

- 默认读 `work/cards500/cards.json` + `visuals.json`，默认写 `work/cards500/images/`；`--cards/--visuals/--out` 可改，**但绝不会写 `content/images/`**，要自己拷过去。
- `work/cards500/custom-svgs/<image.file>` 存在时会**原样采用**该文件（现在有 83 张重画图走这条路）。
- 未在 `visuals.json` 登记的 id 会**静默回落**到 `{icon:"document", props:[], accent:"teal"}`（:1381-1382）——新词很容易拿到一张「通用文档」图，而且不会报错。
- **不要跑 `node work/cards500/merge-cards.mjs`**：它硬性要求 10×50=500 条，会重写 `work/cards500/cards.yaml`/`cards.json`/`visuals.json`，和你直接改 `content/cards/level2.yaml` 的替换结果互相覆盖。

### 3.3 构建时发生了什么（`pnpm content:build` → `scripts/build-content.mjs` → `writeOutputs()`）

1. 先跑**和 `content:validate` 完全同一套** `loadCards()` 门禁；失败就 `throw`，**一个文件都不写**（`build-content.mjs:4-5` 先 `loadCards` 再 `writeOutputs`）。
2. `fs.rmSync(apps/web/public/images, {recursive, force})` 然后 `mkdir` —— **整目录清空重建**（`content.mjs:242-243`）。
3. 把 `content/images/` 里**所有文件**（含 2 张只给文章用的图）全量复制到 `apps/web/public/images/`（:246-251）。
4. 写 `apps/web/src/content/cards.generated.json`：`{version:1, builtAt:<每次构建都会变的时间戳>, cards:[…]}`，每张卡注入 `order`（数组下标）和 `imageUrl: "./images/<file>"`（:225-234, :256）。
5. 打印：卡片数、引用图片数、复制图片数/体积、**场景分布**、警告数（`build-content.mjs:10-18`）。

所以：

- **需要改 apps/web 的生成物吗？不需要手改。** 跑一次 `content:build` 即可；`cards.generated.json` 和 `public/images/` 都被 git 跟踪，所以**要提交**生成后的结果。
- **也不需要改 `apps/web/src/` 的任何源码**：卡片的 text/meaning/sentence/image 全是数据，模板早就按字段渲染。只有「加字段/改字段结构」才要三处一起改：`packages/core/src/types.ts` 的 `Card`、`scripts/lib/content.mjs` 的 Zod、`schema/card.schema.json`（后者只是文档，但别让它撒谎）。
- `pnpm dev` 和 `pnpm build` 都会先跑 `content:build`，所以本地起服务/打包时会自动带上新卡；单独跑 `vite` 不会。
- `builtAt` 每次都变 → `cards.generated.json` 的 diff 里永远有一条时间戳噪音，不能靠哈希判断「是否已同步」。
- `apps/desktop/resources/cards.generated.json` 被 gitignore，只在 `pnpm desktop:build`（内部 `desktop:prepare`）时复制；换卡后要出桌面版必须重跑，否则桌面取词用的还是旧卡。
- 删图后果：`content/images` 少一张 → `apps/web/public/images` 少一张 → 552 这个数字在 `AGENTS.md`、`content/README.md` 里过期（没有脚本会提醒你）。
- ⚠️ **不要删 `community.svg` 和 `phone-permission.svg`**：`apps/web/src/data/articles.ts` 里的 4 篇内置文章引用了 4 张图，其中这 2 张只有文章在用；`apps/web/src/data/articles.test.ts:22-27` 会检查它们在 `content/images/` 里存在，删了 `pnpm test` 直接红。

---

## 4. 场景配额 / level 配额会不会变

### 4.1 结论：代码里没有任何配额断言

- `content:validate`：**不提场景、不提总数**。
- `content:build`：只 `console.log` 一行 `场景：health 82 · money 78 · …`（`build-content.mjs:7,16`），不比较、不失败。
- `pnpm test`：3 个测试文件都不读 `content/cards`；`schedule.test.ts` 用的是自造 deck。
- 唯一硬编码 500 和场景 JSON 的是 `work/cards500/validate-cards.mjs:41,104` —— 它读的是 `work/cards500/cards.yaml`，**和 `content/` 无关**。

也就是说：**总数变成 549 或 551，`pnpm check` 一样全绿**。这是本任务最大的隐形风险，只能靠「原位替换 + 自查」保证。

### 4.2 会真实改变的运行时行为

`packages/core/src/schedule.ts:60-70`：

```ts
sceneRank(SCENE_ORDER) → level 升序 → order(YAML 下标)
```

- 改 `scene`：那张卡会跳到另一个场景区块，「每天三个字」的先后顺序会变；第一次打开是否还是 health 也会变。
- 改 `level`：同场景内前后位置会变（level 越小越靠前），难度曲线变。
- 改 id / 增删条目：`order` 由数组下标重算（`buildDeck`），后面所有卡的 `order` 整体平移；学习顺序跟着变（内容本身没变，但「今天该学哪三张」会变）。

### 4.3 怎么保证配额不动（推荐做法）

1. **同 id、同 scene、同 level、同数组位置**地替换（只改 text/chars/pinyin/meaning/sentence/image/confusables/gen）。
2. 如果非换 scene 不可：**成对交换**——A 卡从健康场景换出去，同时把 B 卡换进来，`health` 计数不变；一次替换批结束后用 §7 的快照命令对比 8 个数字。
3. level 同理：只换文案不动 level；确需调级就同 level 内两两互换。
4. 每次替换前后各存一份快照（`work/char-audit/baseline-quota.json` / `after-quota.json`），`diff` 必须为空。

---

## 5. 最安全的操作顺序

### 阶段 0 · 冻结现场（当前工作区是脏的，必须先处理）

现状：15 个未提交路径，其中 `work/cards500/`、`work/char-stats/`、`docs/14`、`scripts/card-char-frequency.mjs` 都**未跟踪**。这意味着：

- **禁止** `git checkout -- .`、`git reset --hard`、`git clean -fd`（不带路径）——会连这批未提交的文档/工具/500 张工作目录一起删掉。
- 回滚只能用**路径级** `git restore -- <具体路径>`（见阶段 8）。

建议：先建分支，并把 `content/` 的 4 个源文件拷一份到 `work/char-audit/backup-<日期>/`，同时记录当前 `HEAD` 和图片清单。
> 注意：`docs/14-card-char-frequency.md` 里有 6 个链接指向未跟踪目录（`../work/char-stats/cards-550.*`、`../work/cards500/README.md`、`../work/cards500/HANDOFF.md`）。它现在没进 git 所以 CI 不检查；**但如果这次提交把 `docs/14` 一起提交，`pnpm check` 的 `check:github` 会在 CI 上因为 6 个断链变红**（本地因为文件存在不会红）。要么把它留到下一批、连同那 4 个报告一起提交，要么先别提交它。

### 阶段 1 · 采基线（只读）

`pnpm content:validate`（应绿、0 警告）+ `pnpm cards:chars -- --top 30` + 保存 JSON 快照（见 §7 命令 1.3/1.4）。

### 阶段 2 · 写替换稿（不直接改正式文件）

把 20–35 条新卡先写成 `work/char-audit/replacements.yaml`（结构照 `content/cards/level2.yaml`），逐条过一遍：

- 目标词用字：`level2` 看是否都在 `corpus/chars/common2000.txt`；`level1` 看是否都在 `content/charset.level1.txt`（两套口径，别混）；
- `meaning` 汉字是否都在**对应**字表（level2 2000 / level1 191）；
- `pinyin` 个数 = 字数，多音字人工定（§6 坑 3）；
- `image.file` 用复用还是新图；新图先放进 `content/images/`（放进去不影响构建，未被引用只是多一张）；
- `confusables` 重写或删掉；
- `id` 沿用旧卡 id（推荐），`scene`/`level` 沿用。
- 若动 level1：先搜 `corpus/release/` 有没有同名词（否则 `corpus-lint` 的 `dup-card` 会红）。

### 阶段 3 · 落到正式 YAML

把替换稿的字段填回 `content/cards/level2.yaml` 对应位置（保 id、保位置、保 2 空格缩进）。

### 阶段 4 · 快速校验（写文件前唯一的低成本关卡）

```powershell
pnpm content:validate      # 结构 + 释义用字 + 图片存在
pnpm corpus:lint           # 只有动 level1 才一定要先跑（dup-card/dup-local）
pnpm cards:chars -- --top 30   # 看用字拥挤度有没有反向恶化
```

`content:validate` 失败时**什么都还没写**（它不写文件，`content:build` 也是先校验后写），修 YAML 再来即可。

### 阶段 5 · 全量门禁

```powershell
pnpm check
```

顺序是 `content:validate → corpus:lint → typecheck → test → build(content:build + vite build) → check:github`。从输出能直接判断哪一关红：

| 红在哪 | 大概率原因 | 处理 |
|---|---|---|
| `content:validate` | 字段/长度/`text≠chars`/拼音数量/释义用字/图片不存在 | 按 `[error] <id>: …` 改 YAML |
| `corpus:lint` | 动过 level1，新词与 `corpus/release` 重复 | 换词，或按 docs/12 §4 去重流程处理 |
| `typecheck` | 一般不是内容问题（卡 JSON 的类型很宽） | 单独排查 |
| `test` | 删了文章图（`community.svg`/`phone-permission.svg`） | 恢复图片 |
| `build` | 同 `content:validate`（build 会再校验一次） | 同上 |
| `check:github` | 改了 docs 里的本地链接却指向不存在的文件 | 修链接或补文件 |

### 阶段 6 · 重建 + 检查生成物

`pnpm check` 里的 build 已经重生成过；想单独看场景汇总可以再跑 `pnpm content:build`。然后确认：

- `apps/web/src/content/cards.generated.json` 里 `cards.length === 550`；
- `apps/web/public/images` 与 `content/images` 数量一致（本批应仍是 552）；
- `git status` 里生成物已更新、没有别的意外改动。

### 阶段 7 · 提交

`content/cards/*.yaml` + `content/images/*`（新增/删除）+ 两个生成物 + `CHANGELOG.md`（+ 必要时 docs）。按 AGENTS.md 用 `git commit -s`。

### 阶段 8 · 失败怎么回滚

| 失败点 | 现场状态 | 回滚动作 |
|---|---|---|
| 阶段 4 校验红 | 只改了 YAML/图片，**没写生成物** | 改回来即可；或 `git restore --source=HEAD -- content/cards/level2.yaml` |
| 阶段 5 任一关红 | 生成物可能已重写（build 跑过） | 先修源；要整体放弃见下 |
| 想整体放弃（未提交） | — | 见 §7 命令 8.1（路径级 restore + 重建 + 先 dry-run 的 clean） |
| 已经提交 | — | `git revert <sha>`，再 `pnpm content:build` 重建生成物 |

**单卡回滚**：从 `work/char-audit/backup-<日期>/level2.yaml` 里把那一整条（`- id:` 到 `gen:` 行）粘回去，再跑 `pnpm content:build`。

---

## 6. 最容易踩的 5 个坑

### 坑 1 · 以为 `pnpm content:validate` 绿了就没事

它只覆盖 §2.1 那张表。真实翻车过或最容易翻车的盲区：

- **level1 新词撞 `corpus/release`** → `pnpm corpus:lint` 的 `dup-card` 报错（`corpus-lint.mjs:137`），validate 一声不响。
- **YAML 缩进/写法**：`corpus-lint.mjs:51-52` 用 `^ {2}text:\s*(\S+)/gm` 数 level1 的卡；如果你把条目写成 4 空格缩进、或改成 `- {id: …, text: …}` 流式写法，它只读到 <50 条 → `process.exit(2)`「从 content/cards/level1.yaml 只读到 N 张字卡」。**它数的是格式，不是内容。**
- **`text`/`sentence` 用字完全不查**：新词带生僻字也能过。
- **图片重复引用**不查（两张卡同一张图也过）。
- **`pinyin` 只数个数**，写错音、写 `yao4`、少声调都过。
- **`confusables` 只要求非空字符串**，旧词的形近字原样留着也过。

### 坑 2 · charset 三段论：text 不管、meaning 才管、level1 只有 191 字

- 新词的表外字**不会**让门禁红（所以很容易忘了它违反项目承诺）；新**释义**的表外字**会**红。
- level1 的字表白名单只有 **191 字**，而且它是 `level1.yaml` 的**派生快照**。给 level1 换词/改释义时，几乎一定要重写措辞；顺手 `python tools/build_charset.py` 会让门禁自我证明（见 §2.3）。
- level2 是 2000 字常用表，且与 `corpus/chars/common2000.txt` 字节相同；往任一份里加字都会造成分叉 / 影响语料覆盖率统计（`<90%` 直接 error）。

### 坑 3 · 拼音：数量有校验，正确性一点没有；而且下标必须对齐

- `WordText.tsx:32` 用 `card.pinyin[index]` 按字下标取音；`localLexicon.ts:197-200` 还用「先到先得」建了 `charPinyin` 单字表——**一张早出现的卡把「行」标成 `háng`，后面所有卡的「行」都会被它带偏**。
- 常见多音字（`work/cards500/merge-cards.mjs` 的 `PINYIN_OVERRIDES` 已经踩过的）：`开户行/手机银行/网上银行 → … háng`、`大夫 → dài fu`、`还款 → huán kuǎn`、`和面 → huó miàn`、`择菜 → zhái cài`、`切菜/切块/切丝 → qiē …`；另外 `重/长/干/发/觉/血/壳/薄/得/地/了` 都要人工看（见 HANDOFF §4.4）。
- 声调要用 Unicode 符号（`yào`），不要 `yao4`；门禁两种都收。
- 换了 text 一定要整体重写 `pinyin` 数组，不要只改第一个音节——数量对但音错是最隐蔽的错。

### 坑 4 · 图片：存在性是硬错，alt 只是警告，但 alt 会被念出来

- 图不在 `content/images/` → `[error] <id>: 图片不存在 content/images/xxx.svg`（硬失败）。
- `alt` 缺失/过期**不会**失败，但它出现在 `<img alt>`、`aria-label`、`看图` 按钮朗读（`LearnPage.tsx:108`、`CardImage.tsx:23-45`）。复用旧图却忘改 alt，等于给老人念错图。
- 文件名必须纯 ASCII、无路径、无空格；`cards500-501.svg` 这类命名最稳。
- 别复用别的卡的图文件名（一卡一图是本项目约定，`work/cards500/validate-cards.mjs:86` 会拦，主门禁不拦）。
- 删图会改总数（552 → 更少），`AGENTS.md`、`content/README.md` 的数字要跟着改；**两张只给文章用的图（`community.svg`、`phone-permission.svg`）删了会让 `articles.test.ts` 变红**。

### 坑 5 · 生成物手改 + 脏工作区回滚

- `apps/web/src/content/cards.generated.json` 和 `apps/web/public/images/` 是**构建产物**，手改会在下次 `content:build` 被覆盖；只改它们不改 YAML，等于改了立刻丢。
- CI 的 `pnpm check` 里 build 每次都会重生成，所以 **CI 不会发现「提交的生成物和 YAML 不一致」**；本地 `typecheck` 也仍然基于旧 JSON 通过。表现就是「本地全绿，但 App 里还是旧卡」——一定要在提交前确认 `cards.generated.json` 的 diff 里有你改的词。
- `builtAt` 每次都变，diff 里必然有一条时间戳噪音，不代表内容变了。
- 当前工作区有 15 个未提交路径（含未跟踪的 `work/cards500/`、`work/char-stats/`、`docs/14`）：回滚**只能**用路径级 `git restore -- <路径>`；`git checkout -- .` / `git clean -fd` 会把整批未提交工作清掉。清理新图时先 `git clean -fdn content/images` 看清单再执行。

---

## 7. 可执行命令清单（照抄即可；按阶段顺序执行）

> 全部在仓库根 `D:\haness_agent\help_old` 下运行。PowerShell 7（`pwsh`）。
> 分析阶段只做了只读验证（`content:validate` 与下列自查片段），**没有**按这份清单改动任何文件。
> 当前工作区不干净，命令 0.1 是**必须先看**的一步。

### 0 · 冻结与备份

```powershell
# 0.1 先看现在有什么没提交（预计 15 个路径；其中 content/ 是干净的）
git status --porcelain

# 0.2 建替换分支（未提交的改动会跟过来，不会丢）
git switch -c content/replace-2026-10

# 0.3 备份 4 个内容源文件 + 图片清单 + 当前 HEAD
New-Item -ItemType Directory -Force work\char-audit\backup-2026-10-28 | Out-Null
Copy-Item content\cards\level1.yaml, content\cards\level2.yaml, `
          content\charset.level1.txt, content\charset.level2.txt `
          -Destination work\char-audit\backup-2026-10-28 -Force
Get-ChildItem content\images | Select-Object Name, Length |
  Export-Csv work\char-audit\backup-2026-10-28\images-before.csv -NoTypeInformation -Encoding utf8
git rev-parse HEAD | Set-Content -Encoding utf8 work\char-audit\backup-2026-10-28\HEAD.txt
```

### 1 · 采基线（只读）

```powershell
# 1.1 现状应绿、0 警告
pnpm content:validate

# 1.2 用字频次基线（人看）
pnpm cards:chars -- --top 30

# 1.3 用字频次基线（机器 diff 用）
# 注意：不要把 backup 里的 YAML 和正式 YAML 一起传给 cards:chars——
#       同一个 id 对应两个不同的词时会直接抛错（lib/card-char-frequency.mjs:144-149），
#       想比较就分别跑两次，各存一个 JSON。
node scripts/card-char-frequency.mjs --format json --output work/char-audit/baseline-cards-550.json

# 1.4 总数 / 场景 / level 快照
node --input-type=module -e "
import fs from 'node:fs'; import YAML from 'yaml';
const cards = ['content/cards/level1.yaml','content/cards/level2.yaml']
  .flatMap((f) => YAML.parse(fs.readFileSync(f,'utf8')));
const scene = {}; const level = {1:0,2:0,3:0};
for (const c of cards) { scene[c.scene] = (scene[c.scene] ?? 0) + 1; level[c.level] += 1; }
const out = { total: cards.length, scene, level };
fs.writeFileSync('work/char-audit/baseline-quota.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out));
"
```

### 2 · 编辑（手工）

- 改 `content/cards/level2.yaml`（或 `level1.yaml`）对应条目：保 `id`、保 `scene`、保 `level`、保数组位置。
- 新图放 `content/images/<ascii-name>.svg`，YAML 写 `image.file`。
- 自己写一份 `work/char-audit/replacements-2026-10.md`（旧 id/旧词 → 新词 → 依据），后面回滚和交接都靠它。

### 3 · 替换后的只读自查（这些 `content:validate` 不查）

```powershell
# 3.1 目标词用字：level1 对 charset.level1（191 字），level2 对 common2000 —— 两套口径别混
node --input-type=module -e "
import fs from 'node:fs'; import YAML from 'yaml';
const common = new Set(fs.readFileSync('corpus/chars/common2000.txt','utf8')
  .replace(/#[^\n]*/gm,'').replace(/\s+/g,''));
const Han = (ch) => { const c = ch.codePointAt(0); return c >= 0x4e00 && c <= 0x9fff; };
const cs1 = new Set([...fs.readFileSync('content/charset.level1.txt','utf8')].filter(Han));
const l1 = YAML.parse(fs.readFileSync('content/cards/level1.yaml','utf8'));
const l2 = YAML.parse(fs.readFileSync('content/cards/level2.yaml','utf8'));
console.log('level1 目标词不在 charset.level1:',
  l1.filter((c) => [...c.text].some((ch) => !cs1.has(ch))).map((c) => c.id + ':' + c.text));
console.log('level2 目标词不在 common2000:',
  l2.filter((c) => [...c.text].some((ch) => !common.has(ch))).map((c) => c.id + ':' + c.text));
"

# 3.2 图片引用：总数 / 唯一 / 缺失
node --input-type=module -e "
import fs from 'node:fs'; import YAML from 'yaml';
const cards = ['content/cards/level1.yaml','content/cards/level2.yaml']
  .flatMap((f) => YAML.parse(fs.readFileSync(f,'utf8')));
const refs = cards.map((c) => c.image.file);
const dup = refs.filter((f,i) => refs.indexOf(f) !== i);
const missing = refs.filter((f) => !fs.existsSync('content/images/' + f));
console.log({ cards: refs.length, unique: new Set(refs).size, dup, missing });
"

# 3.3 总数 / 场景 / level 与基线对比
node --input-type=module -e "
import fs from 'node:fs'; import YAML from 'yaml';
const before = JSON.parse(fs.readFileSync('work/char-audit/baseline-quota.json','utf8'));
const cards = ['content/cards/level1.yaml','content/cards/level2.yaml']
  .flatMap((f) => YAML.parse(fs.readFileSync(f,'utf8')));
const scene = {}; const level = {1:0,2:0,3:0};
for (const c of cards) { scene[c.scene] = (scene[c.scene] ?? 0) + 1; level[c.level] += 1; }
const after = { total: cards.length, scene, level };
console.log('before', JSON.stringify(before));
console.log('after ', JSON.stringify(after));
console.log(JSON.stringify(before) === JSON.stringify(after) ? '配额未变 ✓' : '配额变了 ✗');
"
```

### 4 · 门禁（按成本从低到高）

```powershell
# 4.1 结构 + 释义用字 + 图片存在（秒级）
pnpm content:validate

# 4.2 只有改过 level1 才必须：检查新词是否撞 corpus/release（dup-card）
pnpm corpus:lint

# 4.3 全量：内容 + 语料 + 类型 + 67 测试 + 构建 + GitHub 链接
pnpm check
```

### 5 · 重建与生成物检查

```powershell
# 5.1 重建（pnpm check 里的 build 已做过一次；想单独看场景汇总时再跑）
pnpm content:build

# 5.2 生成物数量
node -e "const d=JSON.parse(require('node:fs').readFileSync('apps/web/src/content/cards.generated.json','utf8'));console.log('deck cards', d.cards.length, 'builtAt', d.builtAt)"
(Get-ChildItem content\images -File).Count
(Get-ChildItem apps\web\public\images -File).Count

# 5.3 预期：550 / 552 / 552；只有 content 源、content/images、两个生成物在 diff 里
git status --short
git diff --stat
```

### 6 · 重建用字报告（可选；保持文件名，docs/14 链接才不会断）

```powershell
node scripts/card-char-frequency.mjs --format markdown --output work/char-stats/cards-550.md
node scripts/card-char-frequency.mjs --format json     --output work/char-stats/cards-550.json
node scripts/card-char-frequency.mjs --format csv      --output work/char-stats/cards-550.csv
node scripts/card-char-frequency.mjs                   --output work/char-stats/cards-550.txt
```

### 7 · 提交

```powershell
git add content/cards content/images content/charset.level1.txt content/charset.level2.txt `
        apps/web/src/content/cards.generated.json apps/web/public/images `
        CHANGELOG.md work/char-audit/replacements-2026-10.md
git status --short          # 确认没有把 work/char-audit/backup-* 或无关文件带进来
git commit -s -m "content: replace N cards (2026-10)"
```

### 8 · 回滚

```powershell
# 8.1 整体回滚（未提交时）——只按路径还原，绝不要 git checkout -- .
git restore --source=HEAD -- content/cards content/images `
      apps/web/src/content/cards.generated.json apps/web/public/images

# 8.2 还原只做了一半：新增但未跟踪的图不会被 restore 删掉，先看清单再删
git clean -fdn content/images     # dry-run，确认只列出这次新增的图
git clean -fd  content/images     # 确认后执行
git clean -fdn apps/web/public/images

# 8.3 重新生成，回到基线
pnpm content:build
pnpm content:validate
git status --short

# 8.4 已提交的情况
git revert <sha>
pnpm content:build
```

### 9 · 桌面版（只在要出安装包时）

```powershell
pnpm desktop:build      # 内部 content:build → web build → build-desktop → desktop:prepare
```

---

## 附：一页速查（贴到 PR 描述里）

```text
替换 N 张（N = 20–35），总数仍 550，场景/level 不动
□ 同 id / 同 scene / 同 level / 同位置
□ text = chars.join('')，pinyin 数量 = 字数（多音字人工定）
□ meaning ≤20 字、无英文数字括号、汉字 ⊆ 对应字表（level1 191 / level2 2000）
□ image.file 存在 content/images，alt 已按新图重写
□ confusables 已重写或删除；meaning_source.entry 已改成新词
□ gen.prompt_ver 标记本批（如 replace-2026-10@1.0），status 仍 draft
□ pnpm content:validate / pnpm corpus:lint（动 level1 必跑）/ pnpm check 全绿
□ cards.generated.json = 550，public/images = 552，两处生成物已提交
□ CHANGELOG Unreleased 已更新；替换记录已写进 work/char-audit/
```

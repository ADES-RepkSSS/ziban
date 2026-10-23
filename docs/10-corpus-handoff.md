# 10 · 语料库制作交接（给下一位 AI / 内容同学）

> 目标：让另一个 AI 或内容同学**不需要读完整代码**，也能产出可被字伴直接加载、可审校、可替换的屏幕词库。
>
> 先看：[schema/corpus.schema.json](../schema/corpus.schema.json) 是机器校验格式；
> 本文是“写什么、怎么写、怎么验收”。屏幕取词的实现见 [docs/08](08-screen-lookup.md) 第 8 节。
>
> **当前状态（2026-10-23）**：第一批 293 条已产出到 [corpus/release](../corpus/release/)，
> 全部 `source=auto-*`，**机器审校草稿，没有人工审校、没有老人测试**。
> 它不会被程序自动安装；要用 `pnpm corpus:install` 显式装到 `userData/corpus`。
> 本批复盘见 [docs/11](11-corpus-batch1-handoff.md)。

## 1. 这个语料库是干什么的

字伴的屏幕取词优先级：

```text
人工字卡（content/cards/level1.yaml）
  > userData/corpus/*.json（本语料库）
  > 本机离线词表 + pinyin-pro
  > 可选大模型补缺（默认关闭）
```

所以语料库负责的是：

- **字卡没覆盖、但老人会在屏幕上遇到的词**；
- 尤其是医院、银行、政务、手机设置、出行、防骗这些“必须看懂才能办事”的词；
- 不是做一本大词典，也不是收成语/文学词/网络梗。

目标规模：**先做 200–500 条高质量词条**，不要一次性堆 5000 条。
第一批已做到 293 条，但这只是“机器审校草稿”的规模，不是人工审校后的质量结论。
每条都要能回答：老人为什么会在屏幕上看到它？看不懂会卡在哪？

## 2. 文件放哪里

运行时读取：

| 平台 | 目录 |
|---|---|
| Windows | `%APPDATA%\字伴\corpus\*.json` |
| macOS | `~/Library/Application Support/字伴/corpus/*.json` |

- 一个文件最多 5000 条；建议按主题拆成多个文件（例如 `medical.json`、`bank.json`），方便审校和回滚。
- 文件改动后 **500ms 自动重载**，不用重启字伴。
- 字伴只读本地 JSON；爬虫负责写文件，字伴不联网抓取。

## 3. 文件格式（v1）

```json
{
  "version": 1,
  "name": "医院办事词表",
  "license": "CC-BY-SA-4.0",
  "entries": [
    {
      "word": "挂号",
      "pinyin": "guà hào",
      "definition": "看病前先登记，排上看医生的号。",
      "example": "去医院先挂号，再在候诊区等叫号。",
      "source": "hospital-2026-10"
    }
  ]
}
```

字段说明：

| 字段 | 必填 | 限制 | 说明 |
|---|---|---|---|
| `version` | 是 | 必须是 `1` | 格式版本 |
| `name` | 否 | ≤40 字 | 会显示成“语料库 · 医院办事词表” |
| `license` | 否 | ≤40 字 | 例如 `CC-BY-SA-4.0`；必须与来源相符 |
| `entries` | 是 | 数组，≤5000 | 词条列表 |
| `entries[].word` | 是 | 1–8 字 | 建议 2–4 个汉字；不要空格、标点、HTML |
| `entries[].definition` | 是 | 1–120 字 | 一句口语解释；不要英文、网址、HTML |
| `entries[].example` | 否 | ≤120 字 | 一句生活例句；不要示范危险操作 |
| `entries[].pinyin` | 否 | ≤40 字 | 带声调、音节空格分隔；不确定就省略 |
| `entries[].source` | 否 | ≤80 字 | 来源标识，必须可追溯 |

机器校验：`schema/corpus.schema.json`；本地快速检查：

```bash
pnpm corpus:validate path/to/medical.json
```

脚本会检查版本、字段长度、重复词、HTML/网址/危险内容提示；**以 schema 为准**。

## 4. 写什么样的词

### 4.1 建议主题与数量（第一版 300 条左右）

| 主题 | 建议条数 | 例子 |
|---|---|---|
| 医院/挂号/缴费/报告/取药 | 55 | 挂号、候诊、缴费、报告单、取药、医保 |
| 银行/支付/转账/账单/冻结 | 55 | 余额、转账、收款、账单、冻结、限额 |
| 政务/社保/身份证/预约/窗口 | 45 | 预约、取号、窗口、材料、审核、社保 |
| 手机/微信/通知/权限/设置 | 55 | 通知、权限、下载、安装、更新、清理 |
| 出行/公交/地铁/扫码/打车 | 35 | 乘车码、站点、换乘、扫码、打车 |
| 防骗/验证码/链接/客服/安全 | 35 | 验证码、链接、客服、中奖、退款、冻结 |
| 购物/快递/退货/优惠 | 20 | 下单、包邮、退货、退款、优惠券 |

这些是**覆盖方向**，不是硬性配额；宁少勿滥。

### 4.2 必须做到

- **以词为单位**：`验证码`、`挂号`、`缴费`，不要拆成单字；字伴虽然能分词，但语料库应直接给完整词。
- **释义是口语**：像家里人解释，不像词典。例：
  - ✅ “看病前先登记，排上看医生的号。”
  - ❌ “谓于医疗机构预先登记以取得就诊资格。”
- **例句是生活场景**：一句就够，不要长段落；不要出现真实姓名、电话、卡号、地址。
- **不编来源**：`source` 写批次/来源（如 `community-2026-10`、`hospital-faq-2026`），不要写“网上”。
- **一条只解释一个词**；同义词另起条目，不要在一个 `definition` 里塞多个词。
- **风险词要保守**：验证码、转账、冻结、退款、中奖等，例句不要教操作；必要时在释义里加“先问家里人/银行”。

### 4.3 不要做

- 不要用大模型“凭感觉”补医学剂量、法律结论、投资建议；
- 不要收政治、宗教、色情、暴力、歧视内容；
- 不要收真实个人信息、真实聊天记录、真实屏幕截图；
- 不要为了凑数收“的、了、是、在”这类语法字；
- 不要把字卡已有的词重复塞进来（字卡优先级更高，重复不会生效，只会浪费审校时间）。

## 5. 给 AI 的生成提示词（可直接用）

把下面整段交给另一个模型；把“主题/数量”替换成当前批次。

```text
你是字伴（Ziban）的中文屏幕词库编辑。字伴服务 65–85 岁、识字量很低、但听说正常的中文老人。
他们在电脑/手机屏幕上看到不认识的词，字伴会在小窗里用一句大白话解释，并给一句生活例句。

请为主题【医院挂号/缴费】生成 50 条词条，输出严格 JSON（不要 Markdown 代码块，不要解释文字）：
{
  "version": 1,
  "name": "医院办事词表",
  "license": "CC-BY-SA-4.0",
  "entries": [
    {
      "word": "挂号",
      "pinyin": "guà hào",
      "definition": "看病前先登记，排上看医生的号。",
      "example": "去医院先挂号，再在候诊区等叫号。",
      "source": "ai-draft-hospital-2026-10"
    }
  ]
}

硬性要求：
1. word 是 2–4 个汉字的完整词，不要单字，不要成语/文学词/网络梗；
2. definition 12–40 个汉字，口语，不用专业术语，不写英文/网址/HTML；
3. example 10–40 个汉字，生活场景，不出现真实姓名/电话/卡号/地址；
4. pinyin 用带声调拼音，音节用空格分隔；不确定就省略该字段，不要猜；
5. 不收医学剂量、法律结论、投资建议；风险词只提醒“先问家里人/银行/医生”；
6. 不重复已有字卡词（药、医院、挂号、医生、缴费、预约、医保、取钱、存钱、密码、卡、余额、转账、确认、取消、公交、站、地铁、上车、下车、扫码、开、关、大、小、温度、声音、微信、电话、语音、视频、发、红包、消息、身份证、社保、办理、窗口、提交、付款、多少钱、打折、买、验证码、中奖、免费、警察、银行、不要、挂断）；
7. 同批内不得重复 word；按主题相关度从高到低排序；
8. 输出必须是可被 JSON.parse 的纯 JSON。

完成后自检：条数、重复词、字段长度、是否有网址/HTML、是否有危险操作示范。
```

> 生成的是 `draft`。当前 `corpus/release` 里的 293 条也只是**机器审校草稿**，
> 不是人工审校、不是正式内容；不要因为文件叫 release 就当成已审核发布。

## 6. 人工/自动审校清单

每条至少过一遍：

- [ ] `word` 是老人屏幕上真会看到的完整词；
- [ ] `definition` 老人能听懂，且没有编造；
- [ ] `example` 是生活场景，不泄露隐私、不教危险操作；
- [ ] `pinyin` 声调正确（可抽查；不确定宁可省略）；
- [ ] `source` 可追溯，`license` 与来源一致；
- [ ] 不与字卡重复，不与同批其他词重复；
- [ ] 没有 HTML、网址、`<script>`、外链；
- [ ] 医疗/金融/法律词有保守提醒；
- [ ] 通过 `pnpm corpus:validate`。

建议审校抽样：

- 100% 看 `word` 和 `definition`；
- 30% 抽查 `pinyin`；
- 100% 看风险词（验证码/转账/冻结/退款/中奖/密码/链接）；
- 至少 10 条拿给真实老人读一遍，记录“听不懂/不想看”的原话。

## 7. 加载与验收

1. 把 JSON 放到 `<userData>/corpus/`；
2. 打开字伴 → 设置确认“看屏幕”正常；
3. 在另一个窗口显示这些词（或把词粘贴到辅助窗口），鼠标停上去；
4. 小窗应显示“语料库 · 你的 name”；
5. 改一个 `definition` 保存，500ms 内再查同词，应看到新解释（热加载）；
6. 跑 `pnpm corpus:validate` 和 `pnpm check`。

如果语料库没有生效：

- 检查文件名是否 `.json`、`version` 是否 `1`、`entries` 是否存在；
- 检查 `definition` 是否为空/超长；
- 看主进程日志 `[ziban] 语料库...`；
- 字卡命中的词会优先字卡，不会显示语料库解释，这是预期。

## 8. 与代码的边界

- 语料库是**数据**，不要改 `localLexicon.ts` 来塞词；
- 语料库不会覆盖人工字卡；如果要改字卡，走 `content/cards/level1.yaml` + 内容审校流程；
- 语料库的 `definition` 会经过 `sanitizeKnowledgeText`（去 HTML/控制字符、限长）；
- `sourceLabel` 只显示 `name`，不显示 `license`；许可信息仍要写进文件，便于审计；
- 未来爬虫只需输出同一 JSON；不要改 `CorpusStore` 的加载格式，除非同步更新 schema、本文和 `docs/08`。

## 9. 最小示例（10 条）

```json
{
  "version": 1,
  "name": "医院办事词表（示例）",
  "license": "CC-BY-SA-4.0",
  "entries": [
    { "word": "挂号", "pinyin": "guà hào", "definition": "看病前先登记，排上看医生的号。", "example": "去医院先挂号，再等叫号。", "source": "example-2026-10" },
    { "word": "候诊", "pinyin": "hòu zhěn", "definition": "挂完号，坐着等医生叫。", "example": "请在候诊区等叫号。", "source": "example-2026-10" },
    { "word": "缴费", "pinyin": "jiǎo fèi", "definition": "把看病的钱交上。", "example": "看完医生，先去缴费再取药。", "source": "example-2026-10" },
    { "word": "报告单", "pinyin": "bào gào dān", "definition": "检查结果写的那张纸。", "example": "报告单在自助机上打印。", "source": "example-2026-10" },
    { "word": "取药", "pinyin": "qǔ yào", "definition": "拿着单子去药房拿药。", "example": "缴完费去一楼药房取药。", "source": "example-2026-10" },
    { "word": "医保", "pinyin": "yī bǎo", "definition": "看病买药能报销一部分的保险。", "example": "挂号时出示医保卡。", "source": "example-2026-10" },
    { "word": "预约", "pinyin": "yù yuē", "definition": "提前定好看病的时间。", "example": "手机上可以提前预约。", "source": "example-2026-10" },
    { "word": "窗口", "pinyin": "chuāng kǒu", "definition": "办事柜台，隔着玻璃说话的地方。", "example": "请到二号窗口办理。", "source": "example-2026-10" },
    { "word": "叫号", "pinyin": "jiào hào", "definition": "广播念号码，轮到你了。", "example": "听到叫号再去诊室。", "source": "example-2026-10" },
    { "word": "复诊", "pinyin": "fù zhěn", "definition": "看完病后，再回来给医生看。", "example": "下周记得回来复诊。", "source": "example-2026-10" }
  ]
}
```

## 10. 相关文件

- [schema/corpus.schema.json](../schema/corpus.schema.json)
- [apps/desktop/electron/capabilities/knowledge/corpus.ts](../apps/desktop/electron/capabilities/knowledge/corpus.ts)
- [docs/08-screen-lookup.md](08-screen-lookup.md) 第 8.2 节
- [scripts/validate-corpus.mjs](../scripts/validate-corpus.mjs)
- [content/cards/level1.yaml](../content/cards/level1.yaml)（已有字卡词，去重时看）

## 11. 第一批实验语料（2026-10）

按 [交接手册](字伴-语料批处理与自动审核-交接手册.md) 跑出的第一批，**机器审校草稿**：

| 文件 | 条数 | 风险层 |
|---|---:|---|
| [corpus/release/hospital.json](../corpus/release/hospital.json) | 51 | R1 |
| [corpus/release/bank.json](../corpus/release/bank.json) | 52 | R1 |
| [corpus/release/gov.json](../corpus/release/gov.json) | 44 | R1 |
| [corpus/release/phone.json](../corpus/release/phone.json) | 43 | R2 |
| [corpus/release/transit.json](../corpus/release/transit.json) | 35 | R3 |
| [corpus/release/fraud.json](../corpus/release/fraud.json) | 43 | R1 |
| [corpus/release/shopping.json](../corpus/release/shopping.json) | 25 | R3 |

- 运行时 `source` 统一 `auto-*`；`CorpusStore` 会把这类条目显示成“机器审校 · … · 不一定对”，
  `generated=true`、`confidence=medium`，**不会冒充人工高可信**。
- 全部省略 `pinyin`：语料拼音会覆盖本机 `pinyin-pro`，写错比不写更糟；运行时仍有兜底拼音。
- 生成/评审/构建脚本：`pnpm corpus:lint`、`corpus:review`、`corpus:build`、`corpus:metrics`；
  审计材料在 [corpus/workbench/](../corpus/workbench/)，批次说明见 [corpus/RELEASE.md](../corpus/RELEASE.md)。
- 与手册的已知差异（下一批必须补）：只跑了单稿，没跑“每词 3 稿 + 共识”；评审是同一模型家族的多个子代理，
  不是不同模型家族；没有人工审校、没有老人测试。**不能对外说成正式内容。**
- 逐条复盘、踩坑与下一批顺序见 [docs/11-corpus-batch1-handoff.md](11-corpus-batch1-handoff.md)。

## 12. 程序可用性验证（2026-10-23）

### 12.1 已通过的验证

| 检查 | 结果 |
|---|---|
| `pnpm corpus:lint` | 293 条，0 hard fail，0 提醒 |
| `node scripts/validate-corpus.mjs corpus/release/*.json` | 7 个文件、293 条通过 |
| `pnpm test` | 64 个测试；新增 release 全量加载测试 |
| `CorpusStore` | 7 个文件全部加载，合计 293 条 |
| `KnowledgeService.localLookup('候诊')` | 返回 `source=corpus`、`sourceLabel=机器审校 · 医院办事词表`、`confidence=medium` |
| 真实 userData 安装 | `pnpm corpus:install` 已复制 7 个文件到 `%APPDATA%\字伴\corpus`；应用启动日志确认“语料库加载：293 条（7 个文件）” |

新增测试在
[corpus.test.ts](../apps/desktop/electron/capabilities/knowledge/corpus.test.ts)：
它把 `corpus/release/` 的 7 个文件复制到临时 `userData/corpus`，断言总数 293，
再走 `KnowledgeService.localLookup`，确认语料真的进入知识管线，而不是只通过 lint。

### 12.2 安装（显式动作，不自动发布）

```bash
pnpm corpus:install                 # 复制到真实 userData
pnpm corpus:install -- --dry-run    # 只打印路径
```

Windows：`%APPDATA%\字伴\corpus`
macOS：`~/Library/Application Support/字伴/corpus`

- 默认覆盖同名文件；运行中的字伴 500ms 内热加载；
- 不复制 `workbench/`；不要把 manifest/review 放进语料目录；
- 这是机器审校草稿，小窗会显示“机器审校 · … · 不一定对”；
- 回滚：删除这 7 个文件。

### 12.3 还没做的验证

- 本机当前屏幕锁着，**真实 OCR → 小窗显示“候诊”** 没跑；需要在解锁桌面后人工看一次
  来源标签、换行、热加载和小窗高度；
- 没有真人/老人测试；
- 没有把 7 个文件打进安装包；`corpus:install` 是显式动作。

## 13. 图形资产：这批语料需要画 SVG 吗？

**不需要。** 原因：

- 屏幕语料 schema 没有 `image` 字段；
- 屏幕取词小窗只显示词、拼音、释义、例句、来源、风险，不显示插图；
- 本次没有新增字卡：仍是 50 张卡、52 张 SVG（50 卡 + 2 文章），`pnpm content:validate` 通过。

只有**新增字卡**才需要新 SVG：一张卡一张图，图片放 `content/images/`，文件名写进 YAML 的
`image.file`。如果下一批要扩卡，统一风格提示词如下（给批量 AI 用）：

```text
为字伴识字卡生成一张 512×512 的 SVG 插画，主题对象是：【物体/场景】。
统一风格：
- 正方形 viewBox 0 0 512 512，圆角 40 的奶油色底 #F4EBD9；
- 中央浅色圆 #FCF8EF，主体占画面约 60–70%，留白充分；
- 深色手绘轮廓 #26313D，线宽 12–14，圆角连接；
- 低饱和配色：青绿 #0B5A53、砖红 #C9483A、暖黄 #FBEAC8、浅青 #DCEEE9、粉 #E7A79C；
- 扁平、干净、略手绘，不使用渐变、阴影、写实纹理、3D；
- 画面里不要出现任何文字、字母、数字、二维码、真实人脸、品牌 Logo、真实个人信息；
- 只画“东西长什么样”，不要把答案写成字（老人要认的是字，不是图里的字）；
- 背景不要透明，不要描边外框，不要水印；
- 输出只给 SVG 代码，不要 Markdown 代码块，不要解释。
```

批量生成后必须人工看图：物体是否一眼可辨、有没有文字、大小是否一致、是否和已有 52 张风格接近。

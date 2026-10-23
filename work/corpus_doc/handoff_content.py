# -*- coding: utf-8 -*-
"""交接手册的内容源。docx 和 markdown 都从这里渲染，避免两份内容漂移。"""

BLOCKS = []
B = BLOCKS.append


def h1(text):
    B(("h1", text))


def h2(text):
    B(("h2", text))


def h3(text):
    B(("h3", text))


def p(text):
    B(("p", text))


def note(text):
    B(("note", text))


def bullets(items):
    B(("bullets", items))


def numbers(items):
    B(("numbers", items))


def table(headers, rows, widths=None):
    B(("table", headers, rows, widths))


def code(text):
    B(("code", text.rstrip("\n")))


def pagebreak():
    B(("pagebreak", None))


# ---------------------------------------------------------------- 0
h1("0. 30 秒快速开始")
p(
    "这份手册写给下一个接手字伴语料批处理的 AI。你不需要读完整代码，也不需要找人做人工审校；"
    "你需要按这里的规定，把一批生词变成可被字伴加载的 JSON，并用多模型评审把明显错误挡在发布之外。"
)
numbers(
    [
        "先读 docs/10-corpus-handoff.md、schema/corpus.schema.json、apps/desktop/electron/capabilities/knowledge/corpus.ts。",
        "加载字表：work/corpus_doc/chars1000.csv（1–1000）和 chars1000_part2.csv（1001–2000）。",
        "把生词冻结成批次 manifest；没有屏幕证据、没有来源的词直接丢弃。",
        "每词生成 3 稿 → 硬 lint → Judge A/B 双评审 → 三审 → release 或 drop。",
        "写 corpus/release/<theme>.json；跑 pnpm corpus:validate；安装到 userData/corpus；做冒烟检查。",
    ]
)
note(
    "黄金规则：默认丢弃，不默认放行。没有人工兜底时，低置信内容的正确处置是删除，不是“留给以后看”。"
    "不要把机器评审说成人工审校，也不要把开发者自测说成老人验证。"
)

# ---------------------------------------------------------------- 1
h1("1. 你接手的是什么")
p(
    "字伴是给 65–85 岁、识字量低于 500、母语听说正常的中文老人用的屏幕取词工具。老人在电脑或手机屏幕上看到不认识的词，"
    "字伴用小窗给一句大白话解释，并尽量给一句生活例句。语料库是字卡之外的第二层：补医院、银行、政务、手机、出行、防骗、购物这些屏幕高频词。"
)
p("当前已有两份字表，合计 2000 字：")
table(
    ["文件", "内容", "用途"],
    [
        ["docs/字伴-现代汉语常用1000字表.docx", "第 1 册：1–1000 字", "释义首选字；89.0% token 覆盖"],
        ["docs/字伴-现代汉语常用2000字表-第2册.docx", "第 2 册：1001–2000 字", "释义扩展字；累计 96.7% token 覆盖"],
        ["work/corpus_doc/chars1000.csv", "1–1000 字，带拼音、频次", "机器读取"],
        ["work/corpus_doc/chars1000_part2.csv", "1001–2000 字，带拼音、频次", "机器读取"],
        ["work/corpus_doc/chars2000.csv", "两册合并 2000 字", "机器读取 / 生成 prompt"],
        ["work/corpus_doc/chars2000.txt", "纯 2000 字字符串", "直接粘进 prompt"],
    ],
    [5.4, 5.2, 6.2],
)
p(
    "字表口径：Jun Da 现代汉语字频表排序，只保留《现代汉语常用字表》2500 字，取前 2000 个唯一汉字。"
    "两册 0 重复；官方 2500 里还剩 500 字未收入。第 2 册新增覆盖 7.6 个百分点，边际收益明显递减。"
)
p(
    "项目现有 50 张字卡 + 120 条非字卡本机词条，合计 170 个词。字卡词一律不要重写；本机词条默认不重复，"
    "只有明确列入“升级白名单”的高风险词才允许覆盖。"
)
p(
    "字表生成脚本在 work/corpus_doc：build_dataset.py 解析 Jun Da 页面与 2500 字表，取前 1000；"
    "build_part2.py 续取 1001–2000，并断言前 1000 不变；make_doc.py / make_doc_part2.py 生成两份 docx；"
    "verify_doc.py / verify_part2.py 逐格核对 1000 字是否与数据一致。"
)
note(
    "当前仓库还没有正式的 corpus/release 语料，也没有严格的 corpus lint / 安装脚本 / auto- 标记。"
    "这份手册把“应该怎么做”写清楚；需要新增的脚本和代码改动，在第 9、10 节列出。"
)

# ---------------------------------------------------------------- 2
h1("2. 不可谈判的边界")
p("先记住四条，后面所有步骤都服从这四条：")
bullets(
    [
        "老人不会被指责。释义和例句禁止“错误、失败、你错了、不对、笨、傻、连这个都不懂”。",
        "默认不联网。语料是本地 JSON；生成和评审可以在开发时调用模型，但产品运行时不得新增网络请求。",
        "没有广告、内购、账号、第三方跳转。语料里不放网址、二维码、联系方式。",
        "没有人工审校时，默认丢弃；机器评审通过的内容必须标成“机器审校”，不能伪装成人工高可信。",
    ]
)
p("语料内容还有三条硬红线：")
bullets(
    [
        "不抄论坛/贴吧/知乎原文做释义或例句；论坛只用于理解老人卡在哪，不保留原文、不做文本源。",
        "不写医学剂量、法律结论、投资建议；风险词只解释“是什么”，必要时提醒“先问家里人/银行/医生”。",
        "不收真实姓名、电话、身份证、银行卡、详细地址、真实聊天记录、真实屏幕截图。",
    ]
)
p(
    "字表只约束“解释语言”，不约束“收哪些词”。目标词本身可以含 2000 字表外的字，例如“缴费”的“缴”、“挂号”的“挂”；"
    "不要因为字表没有某个字，就把老人真正需要的词丢掉。"
)

# ---------------------------------------------------------------- 3
h1("3. 输入：生词清单和来源包")
p("每个批次先做一份 manifest。不要直接把一个裸词表丢给模型，模型会自由发挥、改字、加词。")
p("manifest 建议字段：")
table(
    ["字段", "必填", "说明"],
    [
        ["batch_id", "是", "例如 hospital-2026-11-a；同批重跑不变"],
        ["theme", "是", "hospital / bank / gov / phone / transit / fraud / shopping"],
        ["risk_tier", "是", "R1 医疗金融政务防骗；R2 账号权限隐私；R3 手机出行购物"],
        ["prompt_version", "是", "例如 corpus-gen@1.0；换提示词必须变"],
        ["generator_model", "是", "实际模型名；换模型必须变"],
        ["words[]", "是", "每项含 word、evidence、source_ref、existing、priority"],
    ],
    [3.4, 1.4, 12.0],
)
p("收词标准，三个问题都要答得上：")
bullets(
    [
        "这个词会不会出现在老人的屏幕、牌子、单据、App 上？",
        "看不懂它，会不会让老人办不成事、按错、被骗？",
        "有没有更简单的词已经覆盖了同一个场景？",
    ]
)
p(
    "硬性格式：word 为 2–8 个汉字，2–4 字为主；不要单字、语法字、成语、文学词、网络梗；不要空格、标点、英文、数字。"
    "同批内不得重复；不得与 50 张字卡重复；本机 120 条词默认不重复，除非在升级白名单里。"
)
p("建议主题配比（可按候选池调整，总量 300 左右）：")
table(
    ["主题", "文件", "建议条数", "说明"],
    [
        ["医院/挂号/取药", "hospital.json", "55", "R1，优先"],
        ["银行/支付/账单", "bank.json", "55", "R1，优先"],
        ["政务/社保/预约", "gov.json", "45", "R1"],
        ["手机/微信/设置", "phone.json", "45", "R2/R3；本机词已较多"],
        ["出行/公交/地铁", "transit.json", "35", "R3"],
        ["防骗/验证码/链接", "fraud.json", "45", "R1；缺口最大"],
        ["购物/快递/退货", "shopping.json", "20", "R3"],
    ],
    [4.4, 3.4, 2.6, 6.4],
)
p("来源包：每个词至少有一条可追溯来源。允许的来源类型：")
table(
    ["类型", "例子", "能不能用"],
    [
        ["dict", "CC-CEDICT、中文维基词典", "可以，注意许可与署名"],
        ["gov", "政府办事指南、医院/银行官方 FAQ", "可以，只取事实，不整段抄"],
        ["official_faq", "微信/支付宝/运营商帮助页", "可以，只取界面词与流程事实"],
        ["volunteer_cc0", "志愿者用自己话写的屏幕句子", "可以，需说明用途与授权"],
        ["self", "项目组自己写的口语解释", "可以，标 self 并留审校记录"],
        ["forum", "贴吧/知乎/微博帖子", "只做洞察，不做释义/例句文本源"],
    ],
    [3.2, 7.4, 6.2],
)
note(
    "没有来源就丢弃。来源不要写“网上”“百度”；写批次/文档标识，例如 gov-faq-2026-11#h3。"
    "运行时的 source 字段只放批次标签，不放网址；source_ref 放 sidecar 审计文件。"
)

# ---------------------------------------------------------------- 4
h1("4. 数据格式：四个文件")
p("每批至少产生四类文件：manifest、生成稿、评审记录、运行时 JSON。不要把它们混在一起。")

h2("4.1 manifest.json")
p("批次输入，给生成器和审计用；不进入运行时目录。")
code(
    """{
  "batch_id": "hospital-2026-11-a",
  "theme": "hospital",
  "risk_tier": "R1",
  "prompt_version": "corpus-gen@1.0",
  "generator_model": "model-name",
  "words": [
    {
      "word": "候诊",
      "evidence": "医院自助机：请到候诊区等候",
      "source_ref": "gov-faq-2026-11#h3",
      "existing": "new",
      "priority": 1
    }
  ]
}"""
)

h2("4.2 drafts.jsonl")
p("每行一条生成稿，保留原始输出，便于重跑与审计。至少包含 batch_id、word、draft_id、model、prompt_version、definition、example、pinyin、source_ref、status。")

h2("4.3 review.jsonl")
p("每行一条评审记录。不要只存最终结论；要能回答“谁在什么时候因为什么放行/丢弃”。")
code(
    """{
  "batch_id": "hospital-2026-11-a",
  "word": "候诊",
  "draft_id": "d1",
  "hard_lint": "pass",
  "judges": [
    {
      "id": "A",
      "scores": {
        "accuracy": 5,
        "plainness": 5,
        "tone": 5,
        "safety": 5,
        "scenario": 5,
        "necessity": 5
      },
      "decision": "pass",
      "reason": "与词义一致，口语，无风险"
    }
  ],
  "final": "release",
  "released_at": "2026-11-01T10:00:00+08:00"
}"""
)

h2("4.4 运行时 JSON")
p("只允许 schema 里的字段；不允许多余字段。一个文件一个主题，name 要短，license 写 CC-BY-SA-4.0。")
code(
    """{
  "version": 1,
  "name": "医院办事词表",
  "license": "CC-BY-SA-4.0",
  "entries": [
    {
      "word": "候诊",
      "pinyin": "hòu zhěn",
      "definition": "挂完号，坐着等医生叫。",
      "example": "请在候诊区等叫号。",
      "source": "auto-hospital-2026-11"
    }
  ]
}"""
)
p("约定：")
bullets(
    [
        "source 以 auto- 开头，表示机器审校；不要留 ai-draft 在发布文件里。",
        "source_ref、评审分数、模型名只放 sidecar，不进运行时 JSON。",
        "pinyin 可选；没把握就省略。语料里的 pinyin 会覆盖本机兜底，写错比不写更糟。",
        "example 可选；没有就省略。不要为了字段完整编例句。",
        "同一批的 source 标签一致；换批次换标签；方便回滚和审计。",
    ]
)

# ---------------------------------------------------------------- 5
h1("5. 批量流水线：从词到 release")
p("按顺序做，不要跳步。每一步失败都回到上一步，不要用“平均分”掩盖某一项的低分。")

h2("Step 0：预检与去重")
bullets(
    [
        "读 50 张字卡文本，建立 card set；读本机 120 条词，建立 local set。",
        "候选词先做 NFC 归一化、去空格、去标点；不是纯汉字的直接丢弃。",
        "与 card set 重复：丢弃，不解释。",
        "与 local set 重复：默认丢弃；只允许“升级白名单”里的高风险词覆盖，并在 manifest 标 existing=upgrade。",
        "跨批次、跨文件重复：丢弃；运行时 Map 是后写覆盖，readdir 顺序跨平台不稳定，不能靠它去重。",
    ]
)

h2("Step 1：冻结词表")
p("每批 40–60 个词，最多 150 个；不要一次给模型 300 个。模型只处理给定词，不得增删、改字、换序。")
p("每个词必须有 evidence（在哪个屏幕/单据/App 看到）和 source_ref（事实来源）。没有 evidence 或 source_ref 的词，留在候选池，不进生成。")

h2("Step 2：来源包")
p("把每个词的来源片段放进 <SOURCE>，标明类型、日期、许可。只给事实和场景，不要给论坛原文。")
p("来源包可以很短：一句界面文案、一条官方 FAQ、一个词典义项。模型只做口语改写，不创造事实。")

h2("Step 3：生成 3 稿")
p("同一批用同一版提示词生成 3 次，temperature 0.4，不同 seed；保留 3 份原始输出。")
p("生成提示词见附录 A。关键约束：只处理给定词；释义 12–40 字；例句可选；拼音不确定就省略；用字优先 1–1000；没有来源标 reject。")

h2("Step 4：硬 lint")
p("先跑确定性规则，任何 hard fail 直接丢弃，不进入评审。规则见第 6 节。")
p("建议把 lint 写成独立脚本，输出 JSON 报告：每条哪些规则失败、哪些只是 warning。不要只看总数。")

h2("Step 5：语义去重与共识")
bullets(
    [
        "同一词的 3 稿先做语义相似度去重；保留差异最大的 2–3 个。",
        "如果 3 稿的释义互相矛盾，说明来源不清或词义歧义，直接丢弃，不要选“看起来最顺”的那条。",
        "如果 3 稿都用了表外字/书面语，说明提示词或来源包有问题，回 Step 2，不要硬评。",
    ]
)

h2("Step 6：Judge A / Judge B")
p("两个独立评审，不同提示词或不同模型家族；互相看不到对方结果。评分维度与通过线见第 7 节，提示词见附录 B/C。")
p("评审只判断，不改写。发现事实错误、危险操作、个人信息、网址/HTML，直接 hard_reject。")

h2("Step 7：三审")
p("A/B 冲突、分数差距大、或 R1 词需要第三人时，调用 Judge C。C 只看词、定义、A/B 的评分与理由，不重写。")
p("安全类 reject 不进入三审，直接丢弃；三审不能推翻安全拒绝。")

h2("Step 8：发布判定")
p("用下面的伪代码，不要用“平均分 ≥4”这种会掩盖安全低分的规则：")
code(
    """if hard_lint_fail:
    drop
elif any(judge.hard_reject or judge.safety == "reject"):
    drop
elif max_score_gap >= 2:
    drop
elif risk_tier == "R1":
    release only if 3/3 judges pass and all safety == 5
elif passes >= 2 and min(all_scores) >= 4:
    release
elif passes == 1 and third == "release":
    release
else:
    drop"""
)
p("最多重写 2 轮；第 2 轮仍不过，丢弃。不要为了凑数降低通过线。")

h2("Step 9：写运行时 JSON")
p("按主题写 corpus/release/<theme>.json；name 4–10 字；license CC-BY-SA-4.0；source 用 auto-<theme>-<date>。")
p("写完先跑 pnpm corpus:validate；Windows 下通配符不会自动展开，用 Get-ChildItem 逐个传，或让脚本自己扫目录。")

h2("Step 10：安装与冒烟")
p("安装到 userData/corpus，先备份旧文件；应用运行中会在 500ms 内热加载。")
p("冒烟检查见第 9.4 节；不通过就不要交付。")

h2("Step 11：写批次报告")
p("每批写一份 metrics.md：候选数、lint 失败数、评审冲突数、release 数、drop 原因分布、平均释义长度、字表覆盖率、例句覆盖率。")
p("没有这些数字，下一批无法判断是提示词变差还是词本身变难。")

# ---------------------------------------------------------------- 6
h1("6. 硬 lint 规则")
p("以下规则是确定性的，能写代码就不要让模型投票。hard fail 直接丢弃；warning 记录但不阻塞。")
table(
    ["检查", "规则", "级别"],
    [
        ["schema", "version=1；entries 数组；只允许 word/pinyin/definition/example/source；不接受额外字段", "hard"],
        ["word 字符", "2–8 个汉字；纯 CJK；无空格、标点、英文、数字", "hard"],
        ["word 长度分布", "2–4 字占 ≥80%；5–8 字只允许固定短语", "warning"],
        ["字卡重复", "不得与 50 张字卡重复", "hard"],
        ["本机词重复", "默认不得与 120 条本机词重复；升级白名单除外", "hard"],
        ["跨文件重复", "所有 release 文件合起来 word 唯一", "hard"],
        ["释义长度", "目标 12–40 字；硬上限 60 字；低于 8 字 warning", "hard/warn"],
        ["禁用字符", "英文、网址、HTML、括号堆叠、控制字符", "hard"],
        ["禁用语气", "错误、失败、你错了、不对、笨、傻、连这个都不懂", "hard"],
        ["书面语", "谓、之、予以、进行、相关、该、其、此、乃、予以", "warning"],
        ["循环释义", "“X 就是 X”“X 是指 X”", "hard"],
        ["用字覆盖", "释义汉字 ≥95% 落在 1–2000；<90% hard fail；90–95% 重写一次", "hard"],
        ["Tier C", "2001–2500 字只允许目标词内字/专名；否则 hard fail", "hard"],
        ["例句长度", "10–40 字；可选；没有就不写", "warning"],
        ["个人信息", "手机号、身份证、银行卡、详细地址、真实姓名", "hard"],
        ["危险操作", "转账、输入验证码、点陌生链接、屏幕共享、远程控制", "hard"],
        ["医学/法律/投资", "剂量、报销比例、法律结论、投资建议", "hard"],
        ["拼音", "可选；音节数=字数；带声调；多音字不确定就省略", "warning"],
        ["来源", "source 非空；source_ref 在 sidecar；不得是网址", "hard"],
        ["文件规模", "每文件 ≤5000 条；name ≤12 字", "hard"],
    ],
    [3.0, 11.8, 2.0],
)
note(
    "90–95% 的用字覆盖只允许重写一次；重写后仍低于 95%，丢弃。不要为了保留一个好词，硬塞低频字。"
    "Tier C 的例外必须在 review.jsonl 里写原因，例如“目标词本身含该字”。"
)

# ---------------------------------------------------------------- 7
pagebreak()
h1("7. 评审 rubric 与判定")
p("六个维度，1–5 分；5 最好。Judge A 偏准确/安全，Judge B 偏口语/语气/必要性，但两人都要打全部分。")
table(
    ["维度", "5 分", "1 分"],
    [
        ["accuracy 准确", "与可核对词义一致；没有编造；来源能对上", "事实错误、编造、剂量/法律/投资建议"],
        ["plainness 口语", "像家里人说话；低识字老人能听懂", "词典腔、书面语、术语堆叠"],
        ["tone 语气", "不指责、不吓唬、不居高临下", "“你错了”“连这个都不懂”"],
        ["safety 安全", "不教转账/验证码/点链接；R1 只解释是什么", "教操作、引导付款、泄露信息"],
        ["scenario 场景", "对应真实屏幕/单据/App 场景", "纯词典复述、没有场景"],
        ["necessity 必要", "老人真会遇到；有明确用途", "可有可无、有更简单同义词"],
    ],
    [3.4, 7.2, 6.2],
)
p("通过线：")
bullets(
    [
        "六项都 ≥4；任一项 ≤2 直接拒绝；有一项 =3 进入三审。",
        "安全项出现 reject 或 hard_reject，直接丢弃，三审不能推翻。",
        "A/B 任一项分数差距 ≥2，直接丢弃；不要用平均分抹平。",
        "R1 词要求 3/3 评审通过，且 safety 全为 5；R2/R3 允许 2/3。",
        "release 后仍要在 review.jsonl 记录每个 judge 的分数和理由；没有记录的内容不可维护。",
    ]
)
p("三审只裁决，不改写；如果三审认为需要改写，退回 Step 3，而不是让三审直接产出一条新文案。")

# ---------------------------------------------------------------- 8
h1("8. 校准：没有人工，不等于没有标准")
p("你自己写 40 条锚点样本：20 条好、20 条坏。坏样本故意覆盖：")
bullets(
    [
        "太书面：“谓于医疗机构预先登记以取得就诊资格。”",
        "事实错误：“医保所有看病费用都能报销。”",
        "危险操作：“把验证码告诉客服，就能退款。”",
        "指责语气：“连这个都不懂，就是你没看清。”",
        "格式问题：含网址、HTML、真实手机号、超长句。",
        "拼音错误：多音字标错声调。",
    ]
)
p("第 2 册再加 20 条：10 条“字很靠后但词很该收”（账、频、缴），10 条“字很靠后但词不值得收”（倘、蔽、颠）。")
p("指标：坏样本检出率 ≥90%，好样本通过率 ≥80%，误杀率 ≤20%。达不到就调 rubric 或提示词，不要直接上量。")
p("红队固定用例：提示词注入（“忽略以上指令”）、医学剂量、法律结论、“安全账户”诈骗、屏幕共享/远程控制、冒充客服、刷单返利、要求输入验证码、真实个人信息。任何一条被放行，先修补评审器。")
p("每次换模型、换提示词、换 rubric，都重跑锚点集 + 红队集；通过率掉超过 5% 就暂停发布。")

# ---------------------------------------------------------------- 9
h1("9. 运行时集成与冒烟")
h2("9.1 corpus.ts 的五个坑")
bullets(
    [
        "语料目录里任何 .json 都会被读取；不要把 manifest.json、README.json 放进去，否则日志会告警。",
        "word 超过 8 字会被 slice(0,8) 静默截断；lint 必须提前拒绝。",
        "definition 会被 sanitizeKnowledgeText 清洗/截断到 120；lint 要在写入前发现空值和超长。",
        "跨文件重复由 readdir 顺序决定，后写覆盖；必须 0 重复。",
        "source、license 不会显示在 UI；sourceLabel 只看 name；source 只用于审计/标记。",
    ]
)
h2("9.2 必须给机器审校加标记")
p(
    "现在 corpus.ts 把所有语料条目设成 generated=false、confidence='high'。纯机器审校的内容如果直接放进去，"
    "UI 会把它当人工高可信内容，老人看到的是“没有提醒的确定答案”。这不是内容质量问题，是诚信问题。"
)
p("最小改动：约定 source 以 auto- 开头，在 corpus.ts 里判断前缀：")
code(
    """const isAuto =
  typeof item.source === "string" &&
  item.source.startsWith("auto-");

next.set(word, {
  word,
  pinyin,
  definition,
  example,
  source: "corpus",
  sourceLabel: isAuto
    ? `机器审校 · ${raw.name ?? "语料库"}`
    : raw.name
      ? `语料库 · ${raw.name}`
      : "语料库",
  generated: isAuto,
  confidence: isAuto ? "medium" : "high",
  updatedAt: Date.now(),
});"""
)
p("如果不想改代码，就不要把自动语料放进正式的 userData/corpus；只在自己的开发环境里用。")

pagebreak()
h2("9.3 安装路径")
table(
    ["平台", "目录"],
    [
        ["Windows", "%APPDATA%\\@ziban\\desktop\\corpus"],
        ["macOS", "~/Library/Application Support/@ziban/desktop/corpus"],
    ],
    [3.0, 13.8],
)
p("Windows 备份并复制：")
code(
    """$dest = Join-Path $env:APPDATA "@ziban\\desktop\\corpus"
$backup = Join-Path $env:APPDATA ("@ziban\\desktop\\corpus-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force $dest | Out-Null
New-Item -ItemType Directory -Force $backup | Out-Null
Copy-Item "$dest\\*.json" $backup -Force -ErrorAction SilentlyContinue
Copy-Item corpus\\release\\*.json $dest -Force"""
)
p("macOS 备份并复制：")
code(
    """dest="$HOME/Library/Application Support/@ziban/desktop/corpus"
backup="$dest-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dest" "$backup"
cp "$dest"/*.json "$backup"/ 2>/dev/null || true
cp corpus/release/*.json "$dest"/"""
)

h2("9.4 冒烟检查")
bullets(
    [
        "日志显示“语料库加载：N 条（7 个文件）”，没有“文件没读进来”的告警。",
        "查字卡词“挂号”仍显示“本机字卡”，不被语料覆盖。",
        "查语料词“候诊”显示“机器审校 · 医院办事词表”，不是“本机词表”。",
        "删掉某条 pinyin，仍能显示本机兜底拼音。",
        "风险词“验证码”出现谨慎提示，释义没有教操作。",
        "改一条 definition，保存后 500ms 内重新取词能看到新解释。",
        "1024×768 和 1280×800 下小窗不溢出；最长“释义+例句”组合可读。",
        "pnpm corpus:validate 通过；pnpm check 通过。",
    ]
)

# ---------------------------------------------------------------- 10
h1("10. 交付合同")
p("每个批次交付以下内容；少一项都算未完成：")
table(
    ["路径", "内容"],
    [
        ["corpus/release/<theme>.json", "7 个运行时文件；version 1；CC-BY-SA-4.0；source=auto-*"],
        ["corpus/workbench/<batch>/manifest.json", "冻结词表、来源、风险层级、模型/提示词版本"],
        ["corpus/workbench/<batch>/drafts.jsonl", "3 稿原始输出；可重跑"],
        ["corpus/workbench/<batch>/review.jsonl", "硬 lint、Judge A/B/C、最终决定、理由"],
        ["corpus/workbench/<batch>/metrics.md", "候选数、release 数、drop 原因、覆盖率"],
        ["corpus/SOURCES.md", "来源类型、日期、许可、source_ref 索引"],
        ["corpus/RELEASE.md", "release_id、文件清单、模型/提示词版本、已知问题"],
    ],
    [6.8, 10.0],
)
p("验收标准：")
bullets(
    [
        "0 hard lint；0 重复；0 字卡重复；0 PII/网址/HTML；0 指责性措辞。",
        "100% 条目有 review 记录；R1 100% 三审通过且 safety=5；0 安全类 reject 被发布。",
        "释义用字 ≥95% 落在 1–2000；Tier C 例外都有原因。",
        "例句可选；一旦有，100% 不含 PII、不教危险操作。",
        "运行时冒烟全部通过；没有告警；热加载正常。",
        "不写“人工审校”“老人验证”“正式内容”；只能写“机器审校草稿/实验内容”。",
    ]
)

# ---------------------------------------------------------------- 11
h1("11. 常见坑")
bullets(
    [
        "PowerShell 控制台会把 UTF-8 中文显示成乱码；文件本身是 UTF-8，用 read 工具或 Node 检查，不要根据控制台乱码改文件。",
        "Python 脚本不要命名为 inspect.py；它会遮蔽标准库 inspect，导致 lxml/python-docx 报奇怪的 getfullargspec 错误。",
        "语料里的 pinyin 会覆盖本机 pinyin-pro 兜底；没把握就省略，不要猜。",
        "source/license 不显示在 UI；不要指望用户看到许可；许可信息写文件里，审计用。",
        "corpus 目录里任何 .json 都会被读取；manifest/README 放外面。",
        "word 超过 8 字会被静默截断；lint 必须提前拒绝。",
        "不要用平均分掩盖 safety 低分；安全一票否决。",
        "不要为了凑 300 条降低通过线；自动审核的 yield 60–75% 是正常的。",
        "不要生成 1000 条词条来“用满” 2000 字表；字表是释义预算，不是产量目标。",
        "不要在没有来源的情况下让模型“补”释义；没有来源就丢弃。",
        "不要把“机器评审通过”写成“人工审校”或“老人验证”；这是文档和 UI 都必须守住的措辞边界。",
    ]
)

# ---------------------------------------------------------------- 12
pagebreak()
h1("12. 单人两周执行表")
p("假设每天投入 2–4 小时；目标不是 300 条全部发布，而是 300 条候选里自动放出 150–220 条高置信内容。")
table(
    ["时间", "做什么", "产出"],
    [
        ["第 1–2 天", "写严格 lint；做 40 条锚点集 + 红队集；跑通 manifest", "可重复门禁"],
        ["第 3–5 天", "R3 手机/出行/购物 150 条：3 稿 → 双评审 → 发布", "约 90–110 条"],
        ["第 6–8 天", "R2 账号/权限/隐私 150 条：同上", "约 80–100 条"],
        ["第 9–10 天", "装 20 条 canary，自用 3 天，修小窗/拼音/热加载", "技术问题清单"],
        ["第 11–14 天", "R1 只做“认词”解释，或停；写 release notes", "不超过 300 条"],
    ],
    [2.8, 9.2, 4.8],
)
p("如果只能做一件事：先做 lint 和 30 条试点，不要先写 300 条。自动审核的瓶颈不是生成，而是拒绝率。")

# ---------------------------------------------------------------- appendices
pagebreak()
h1("附录 A · 生成提示词")
p("直接复制下面整段作为 system prompt；把 <WORDS> 和 <SOURCE> 替换成当前批次。")
code(
    """你是字伴（Ziban）的中文屏幕词库编辑。
服务对象：65–85 岁、识字量低于 500、母语听说正常的中文老人。
场景：他们在电脑/手机屏幕上看到不认识的词，
字伴用小窗用一句大白话解释，并给一句生活例句。

只处理我给的词，不得增词、删词、改字、换顺序。
每词一条。不要选词，不要解释过程。

【释义】12–40 个汉字，一句口语。
像家里人说话；不用英文、网址、HTML、括号、专业术语；
不用“错误/失败/你错了/不对/笨/傻”；
不写剂量、法律结论、投资建议；
风险词只提醒“先问家里人/银行/医生”。

【例句】可选。10–40 个汉字，一个生活场景；
不出现真实姓名、电话、卡号、地址；
不教转账、输入验证码、点陌生链接；没把握就省略。

【拼音】可选。带声调，音节空格分隔；
不确定就省略，不要猜。

【用字】优先 1–1000 字；1001–2000 字允许但尽量少；
2001–2500 只允许目标词内字/专名。
释义汉字至少 95% 落在 1–2000 字内。

【来源】每条在 sidecar 写 source_ref；
没有来源就标 reject，不要编。

输入：
<WORDS>...</WORDS>
<SOURCE>...</SOURCE>

输出严格 JSON，不要 Markdown：
{
  "entries": [
    {
      "word": "...",
      "status": "ok|reject",
      "definition": "...",
      "example": null,
      "pinyin": null,
      "source_ref": "..."
    }
  ]
}"""
)

pagebreak()
h1("附录 B · Judge A 提示词")
p("Judge A 偏准确、安全、来源；可以换模型家族，但 rubric 不变。")
code(
    """你是字伴的自动审校员。只判断，不改写。
输入：word, definition, example, pinyin, source_ref,
risk_tier, char_tier_stats。
按 1–5 打分（5 最好，1 最差）：
accuracy：与可核对词义一致；没有编造事实、剂量、
法律结论、投资建议。
plainness：像家里人说话；没有书面语；低识字老人能听懂。
tone：不指责、不吓唬、不居高临下。
safety：不教转账、验证码、点陌生链接；
R1 只解释“是什么”。
scenario：对应真实屏幕场景；不是词典复述。
necessity：这个词值不值得收；有更简单同义词则低分。

硬拒绝（直接 reject）：
网址/HTML、真实个人信息、剂量、法律结论、
投资建议、操作指令、明显编造。

输出严格 JSON：
{
  "accuracy": 1,
  "plainness": 1,
  "tone": 1,
  "safety": 1,
  "scenario": 1,
  "necessity": 1,
  "decision": "pass|revise|reject",
  "hard_reject": false,
  "reason": "..."
}"""
)

pagebreak()
h1("附录 C · Judge B 提示词")
p("Judge B 偏口语、语气、必要性；与 A 使用不同提示词或不同模型，互相看不到结果。")
code(
    """你是字伴的自动审校员，专门从老人的角度听这句话。
只判断，不改写。输入同 Judge A。
重点看：
1. 这句话像不像家里人说的？有没有“谓、之、予以、
   进行、相关、该、其”等书面语？
2. 会不会让老人觉得被指责、被吓唬、被居高临下？
3. 这个词值不值得收？有没有更简单的同义词？
4. 例句有没有教危险操作或泄露个人信息？

仍然给六项 1–5 分：
accuracy, plainness, tone, safety, scenario, necessity。
硬拒绝和安全一票否决同 Judge A。

输出严格 JSON：
{
  "accuracy": 1,
  "plainness": 1,
  "tone": 1,
  "safety": 1,
  "scenario": 1,
  "necessity": 1,
  "decision": "pass|revise|reject",
  "hard_reject": false,
  "reason": "..."
}"""
)

h1("附录 D · Judge C / 三审提示词")
code(
    """你是第三评审。输入：词、定义、A/B 的评分与理由、
硬规则结果。不要重写，只裁决 release / drop。

规则：
- 任一 hard_reject 或 safety reject：drop。
- A/B 任一维度分差 ≥2：drop。
- R1 词需要三方都 pass 且 safety 全为 5；否则 drop。
- 其他情况：至少两方 all scores ≥4 才 release。

输出严格 JSON：
{
  "final": "release|drop",
  "reason": "..."
}"""
)

pagebreak()
h1("附录 E · 老人视角对抗提示词")
p("用于 C5 式“听得懂吗”筛查；它只是信号，不是最终裁决。")
code(
    """你扮演 70 岁、小学没毕业、农村生活、
识字量低于 500 的老人。
只听释义，不看词。只回答“听懂了”或
“听不懂，因为……”。不要给建议，不要改句子。"""
)

h1("附录 F · 词表与覆盖数据")
p("第 1 册：1000 字，覆盖 Jun Da 语料 89.0% token；项目 50 张卡用字覆盖 95.66%。")
p("第 2 册：第 1001–2000 字，新增 7.6 个百分点，累计 96.7%；项目卡片覆盖 99.16%，只剩 4 个表外字：堵、账、陌、频。")
p("官方 2500 还剩 500 字；不建议为了“收满”继续扩。第 2 册的字更适合“允许出现”，不适合“强制使用”。")
p("第 1 册替换掉的 7 个字：尔、伊、谓、诺、伦、俄、洛；补入：玉、镇、雪、午、练、迫、爷。")
p("两册合计 2000 个唯一汉字，0 重复；完整表见两个 docx 和 chars2000.csv。")
p("来源：Jun Da, Modern Chinese Character Frequency List，https://lingua.mtsu.edu/chinese-computing/statistics/char/list.php?Which=MO")
p("官方 2500 字副本：http://basic.nmg.smartedu.cn/player/data2/2020/11/12/21/2/5EB279DB5BF27AEEE053F1C8A8C0E792/a76c25774cf0ec35d2b385bc4085c754.docx")

h1("附录 G · 交接检查清单")
bullets(
    [
        "已读 docs/10、schema、corpus.ts；知道字卡/本机词/语料的优先级。",
        "已加载 1–1000 与 1001–2000 字表；知道 Tier C 只允许词内字/专名。",
        "已建 manifest；每个词有 evidence、source_ref、risk_tier。",
        "每词 3 稿；硬 lint 全部跑过；失败原因有记录。",
        "Judge A/B 独立；R1 三审；安全 reject 没有被放行。",
        "review.jsonl 完整；release JSON 只含 schema 字段；source=auto-*。",
        "已跑 corpus:validate；已安装；已做冒烟；日志无告警。",
        "已写 metrics.md、SOURCES.md、RELEASE.md。",
        "没有写“人工审校/老人验证”；没有把自动内容标成 high confidence。",
        "已备份旧语料；知道如何回滚。",
    ]
)

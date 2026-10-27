# 内容说明（v0.1 实验版）

> 屏幕取词的词库是另一套 JSON，不要塞进 `cards/level1.yaml`。格式、AI 提示词、审校与验收见
> [docs/10-corpus-handoff.md](../docs/10-corpus-handoff.md)。

## 状态

- `cards/level1.yaml`：50 张基线卡；`cards/level2.yaml`：500 张扩量卡；全部 `status: draft`。
- 500 张扩量卡中约 280 个词与 `corpus/release` 重名；运行时字卡优先，语料条目保留但不会覆盖卡片。
- 释义、例句是项目组用日常口语手写的原型内容，来源标记为 `self`，**没有**冒充维基词典或真实语料。
- 配图是项目手绘 SVG，不是文生图，也不是实拍；许可 CC BY-SA 4.0。
- **未经人工审校、没有老人测试。** 个人开发者不把人工审校/老人测试作为发布前置；内容以机器门禁 + 标注运行，详见 [docs/13](../docs/13-maintainer-policy.md)。

## 文件

```
content/
  cards/level1.yaml        50 张基线卡（同一构建入口）
  cards/level2.yaml        500 张扩量卡（AI 草稿，未人工审校）
  cards/level1.sample.yaml 结构样例，不参与构建
  images/*.svg             552 张配图（550 卡片 + 2 文章）
  charset.level1.txt       基线卡已学字 + 释义白名单
  charset.level2.txt       common2000 扩量卡释义用字表
  scenes.yaml              场景清单（选词骨架）
```

## 加一张卡

1. 在 `content/cards/level1.yaml`（基线）或 `level2.yaml`（扩量）末尾加一条，字段见 `schema/card.schema.json`。
2. 把 SVG 放进 `content/images/`，文件名写进 `image.file`。
3. 运行：

```bash
pnpm content:validate   # 只校验
pnpm content:build      # 校验 + 生成 apps/web 的 JSON 与图片副本
```

门禁会检查：Zod schema、`text === chars.join('')`、拼音数量、释义 ≤20 字且不含英文/数字/括号、释义用字 ⊆ 对应字表、图片存在、id 不重复。警告（如缺 `image.alt`）不阻塞构建，但建议清零。

## 配图

`tools/generate_images.py` 是**基线 52 张** SVG 的生成源，只用 Python 标准库；500 张扩量图由 `work/cards500/generate_svgs.py` 生成后复制进 `content/images/`：

```bash
python tools/generate_images.py
# 生成 content/images/*.svg 与 tools/output/contact-sheet.html
```

改图时优先改生成器，不要只手改 `content/images`；否则下次生成会被覆盖。

## 字表

`charset.level1.txt` 是 50 张基线卡的已学字 + 释义用字门禁；`charset.level2.txt` 是扩量卡用的 common2000 字表。它们都是**门禁**，不是教学顺序；不要为了过门禁删生活词。

## 许可

- 词表、释义、例句、手绘配图：CC BY-SA 4.0。
- 拼音数据：仅作内部数据与家人参考，不用于教学。
- 引用第三方内容时：必须带 `source_ref`，并遵守 docs/02 的合规红线；没有可引用来源的内容不得入库。

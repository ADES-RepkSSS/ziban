# 内容说明（v0.1 实验版）

> 屏幕取词的词库是另一套 JSON，不要塞进 `cards/level1.yaml`。格式、AI 提示词、审校与验收见
> [docs/10-corpus-handoff.md](../docs/10-corpus-handoff.md)。

## 状态

- `cards/level1.yaml`：50 张卡，全部 `status: draft`。
- 释义、例句是项目组用日常口语手写的原型内容，来源标记为 `self`，**没有**冒充维基词典或真实语料。
- 配图是项目手绘 SVG，不是文生图，也不是实拍；许可 CC BY-SA 4.0。
- **未经正式审校，禁止直接对外发布。** 发布前必须走 docs/01 的 C5 对抗审校与人工审校。

## 文件

```
content/
  cards/level1.yaml        50 张卡片（构建唯一入口）
  cards/level1.sample.yaml 结构样例，不参与构建
  images/*.svg             52 张配图（50 卡片 + 2 文章）
  charset.level1.txt       已学字 + 释义口语白名单（内容门禁用）
  scenes.yaml              场景清单（选词骨架）
```

## 加一张卡

1. 在 `content/cards/level1.yaml` 末尾加一条，字段见 `schema/card.schema.json`。
2. 把 SVG 放进 `content/images/`，文件名写进 `image.file`。
3. 运行：

```bash
pnpm content:validate   # 只校验
pnpm content:build      # 校验 + 生成 apps/web 的 JSON 与图片副本
```

门禁会检查：Zod schema、`text === chars.join('')`、拼音数量、释义 ≤20 字且不含英文/数字/括号、释义用字 ⊆ 字表、图片存在、id 不重复。警告（如缺 `image.alt`）不阻塞构建，但应在发布前清零。

## 配图

`tools/generate_images.py` 是 52 张 SVG 的生成源，只用 Python 标准库：

```bash
python tools/generate_images.py
# 生成 content/images/*.svg 与 tools/output/contact-sheet.html
```

改图时优先改生成器，不要只手改 `content/images`；否则下次生成会被覆盖。

## 字表

`charset.level1.txt` 由 `tools/build_charset.py` 从当前 50 张卡的已学字 + 释义用字生成，是**原型门禁**，不是教学字表。正式版应替换为按词频排序的 500/1000 字表，并按 level 分表。

## 许可

- 词表、释义、例句、手绘配图：CC BY-SA 4.0。
- 拼音数据：仅作内部数据与家人参考，不用于教学。
- 引用第三方内容时：必须带 `source_ref`，并遵守 docs/02 的合规红线；没有可引用来源的内容不得入库。

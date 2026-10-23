# 语料用字表

`common2000.txt` 是字伴语料流水线的「释义预算表」：现代汉语常用 2000 字（1–2000）。

- 来源：Jun Da, *Modern Chinese Character Frequency List*，只保留《现代汉语常用字表》2500 字，取前 2000 个唯一汉字。
- 生成：`work/corpus_doc/build_dataset.py` + `build_part2.py`（2026-10-23），两册 0 重复。
- 用法：`scripts/corpus-lint.mjs` 读取本文件，检查每条释义的用字覆盖率。
  - 释义用字 ≥95% 落在本表内：通过；
  - 90–95%：warning，必须重写一次；
  - <90%：hard fail。
- Tier C（2001–2500）：不在本表内，只允许出现在目标词本身或专名里；例外原因写进 `corpus/workbench/*/review.jsonl`。
- 字表只约束「解释语言」，不约束「收哪些词」：目标词本身可以含表外字（例如“缴费”的“缴”）。

修改这个文件等于改内容门禁，必须同步 `scripts/corpus-lint.mjs`、`docs/10-corpus-handoff.md` 和 `docs/字伴-语料批处理与自动审核-交接手册.md`。

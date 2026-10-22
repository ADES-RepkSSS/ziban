import re
from pathlib import Path

text = Path("content/cards/level1.yaml").read_text(encoding="utf-8")
card_chars = set()
for match in re.finditer(r"chars:\s*\[([^\]]*)\]", text):
    card_chars.update(re.findall(r"[\u4e00-\u9fff]", match.group(1)))

meanings = re.findall(r"^\s*meaning:\s*(.+)$", text, re.M)
extra = set()
for meaning in meanings:
    extra.update(re.findall(r"[\u4e00-\u9fff]", meaning))
extra -= card_chars

all_chars = sorted(card_chars | extra)
lines = [
    "# 字伴 v0.1 原型字表：50 张卡片的已学字 + 释义口语白名单",
    "#",
    "# 用途：内容门禁检查「释义是否用了没学过的字」。",
    "# 正式版应由按词频排序的 500/1000 字表替换，并按 level 分表；",
    "# 当前白名单只保证 v0.1 原型释义不出现生僻字，不代表教学顺序。",
    "",
]
for index in range(0, len(all_chars), 24):
    lines.append("".join(all_chars[index : index + 24]))
lines.append("")
Path("content/charset.level1.txt").write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {len(all_chars)} chars")

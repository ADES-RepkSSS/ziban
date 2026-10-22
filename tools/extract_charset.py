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

print(f"card chars {len(card_chars)}")
print(f"extra chars {len(extra)}")
out = "".join(sorted(extra))
Path("tools/output/extra_chars.txt").write_text(out, encoding="utf-8")
print(out)


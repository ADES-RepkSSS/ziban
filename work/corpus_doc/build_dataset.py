from pathlib import Path
import csv
import json
import re

ROOT = Path(".").resolve()
RAW = ROOT / "work" / "corpus_doc" / "junda.html"
OFFICIAL = ROOT / "work" / "corpus_doc" / "changyong2500.txt"

text = RAW.read_bytes().decode("gb18030", errors="replace")
m = re.search(r"<pre>(.*?)</pre>", text, re.S)
if not m:
    raise SystemExit("no <pre> block")

rows = []
for line in m.group(1).split("<br>"):
    parts = line.strip().split("\t")
    if len(parts) < 5 or not parts[0].isdigit():
        continue
    char = parts[1].strip()
    if len(char) != 1:
        continue
    rows.append(
        {
            "rank": int(parts[0]),
            "char": char,
            "frequency": int(parts[2]),
            "per_million": float(parts[3]),
            "pinyin": parts[4].strip(),
            "english": parts[5].strip() if len(parts) > 5 else "",
        }
    )

# unique by char, preserve first occurrence
seen = set()
unique_rows = []
for row in rows:
    if row["char"] in seen:
        continue
    seen.add(row["char"])
    unique_rows.append(row)

official = set(OFFICIAL.read_text(encoding="utf-8").strip())

selected = []
skipped = []
for row in unique_rows:
    if row["char"] in official:
        selected.append(row)
        if len(selected) == 1000:
            break
    elif len(selected) < 1000:
        skipped.append(row)

for i, row in enumerate(selected, 1):
    row["list_rank"] = i
    row["in_original_top1000"] = row["rank"] <= 1000

total_freq = sum(row["frequency"] for row in unique_rows)
selected_freq = sum(row["frequency"] for row in selected)

out = {
    "meta": {
        "name": "字伴·现代汉语常用 1000 字（频率序，限定在《现代汉语常用字表》2500 字内）",
        "version": "2026-10-23",
        "method": "Jun Da 现代汉语字频表按频率排序，仅保留《现代汉语常用字表》2500 常用字；取前 1000 个唯一汉字。",
        "sources": [
            "https://lingua.mtsu.edu/chinese-computing/statistics/char/list.php?Which=MO",
            "http://basic.nmg.smartedu.cn/player/data2/2020/11/12/21/2/5EB279DB5BF27AEEE053F1C8A8C0E792/a76c25774cf0ec35d2b385bc4085c754.docx",
        ],
        "total_frequency": total_freq,
        "selected_frequency": selected_freq,
        "token_coverage": round(selected_freq / total_freq, 6),
        "skipped_top1000": [
            {"rank": r["rank"], "char": r["char"], "reason": "不在《现代汉语常用字表》2500 字内"}
            for r in skipped
        ],
        "replacements": [
            {"rank": r["rank"], "char": r["char"]}
            for r in selected
            if not r["in_original_top1000"]
        ],
    },
    "chars": selected,
}

(ROOT / "work" / "corpus_doc" / "chars1000.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
(ROOT / "work" / "corpus_doc" / "chars1000.txt").write_text(
    "".join(r["char"] for r in selected), encoding="utf-8"
)
with (ROOT / "work" / "corpus_doc" / "chars1000.csv").open(
    "w", encoding="utf-8-sig", newline=""
) as fh:
    writer = csv.writer(fh)
    writer.writerow(["rank", "char", "pinyin", "frequency", "per_million", "english"])
    for row in selected:
        writer.writerow(
            [
                row["list_rank"],
                row["char"],
                row["pinyin"],
                row["frequency"],
                row["per_million"],
                row["english"],
            ]
        )

# Project text coverage: card meanings + sentences
card_text = (ROOT / "content" / "cards" / "level1.yaml").read_text(encoding="utf-8")
meanings = re.findall(r"^\s*meaning:\s*(.+)$", card_text, re.M)
sentences = re.findall(r"^\s*sentence:\s*(.+)$", card_text, re.M)
sample = meanings + sentences
charset = set(out_chars := "".join(r["char"] for r in selected))
sample_chars = [ch for text_item in sample for ch in text_item if "\u4e00" <= ch <= "\u9fff"]
unknown = sorted({ch for ch in sample_chars if ch not in charset})
unknown_count = sum(1 for ch in sample_chars if ch not in charset)
meta_project = {
    "sample_lines": len(sample),
    "cjk_chars": len(sample_chars),
    "unique_cjk": len(set(sample_chars)),
    "unknown_unique": unknown,
    "unknown_count": unknown_count,
    "coverage": round((len(sample_chars) - unknown_count) / max(1, len(sample_chars)), 4),
}
out["project_sample"] = meta_project
(ROOT / "work" / "corpus_doc" / "chars1000.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)

print("selected", len(selected), "unique", len({r['char'] for r in selected}))
print("skipped", len(skipped), "".join(r["char"] for r in skipped))
print("replacements", len(out["meta"]["replacements"]))
print("token coverage", out["meta"]["token_coverage"])
print("project coverage", meta_project)
print("unknown", "".join(unknown))

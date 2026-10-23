from pathlib import Path
import csv
import json
import re

ROOT = Path(".").resolve()
RAW = ROOT / "work" / "corpus_doc" / "junda.html"
OFFICIAL = ROOT / "work" / "corpus_doc" / "changyong2500.txt"
FIRST = ROOT / "work" / "corpus_doc" / "chars1000.json"

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

seen = set()
unique_rows = []
for row in rows:
    if row["char"] in seen:
        continue
    seen.add(row["char"])
    unique_rows.append(row)

official = set(OFFICIAL.read_text(encoding="utf-8").strip())

selected = []
for row in unique_rows:
    if row["char"] in official:
        selected.append(row)
        if len(selected) == 2000:
            break

for i, row in enumerate(selected, 1):
    row["list_rank"] = i

first_data = json.loads(FIRST.read_text(encoding="utf-8"))
first_chars = [r["char"] for r in first_data["chars"]]
second_chars = [r["char"] for r in selected[1000:2000]]

if first_chars != [r["char"] for r in selected[:1000]]:
    raise SystemExit("first 1000 changed; aborting")

total_freq = sum(row["frequency"] for row in unique_rows)
cum = []
running = 0
for i, row in enumerate(selected, 1):
    running += row["frequency"]
    if i % 100 == 0:
        cum.append((i, round(running / total_freq * 100, 1)))

part2_freq = sum(row["frequency"] for row in selected[1000:2000])
part1_freq = sum(row["frequency"] for row in selected[:1000])

# Project sample coverage with 2000 chars
card_text = (ROOT / "content" / "cards" / "level1.yaml").read_text(encoding="utf-8")
meanings = re.findall(r"^\s*meaning:\s*(.+)$", card_text, re.M)
sentences = re.findall(r"^\s*sentence:\s*(.+)$", card_text, re.M)
sample = meanings + sentences
charset = set("".join(r["char"] for r in selected))
sample_chars = [ch for text_item in sample for ch in text_item if "\u4e00" <= ch <= "\u9fff"]
unknown = sorted({ch for ch in sample_chars if ch not in charset})
unknown_count = sum(1 for ch in sample_chars if ch not in charset)
project = {
    "sample_lines": len(sample),
    "cjk_chars": len(sample_chars),
    "unique_cjk": len(set(sample_chars)),
    "unknown_unique": unknown,
    "unknown_count": unknown_count,
    "coverage": round((len(sample_chars) - unknown_count) / max(1, len(sample_chars)), 4),
}

meta = {
    "name": "字伴·现代汉语常用 2000 字（第 2 册：第 1001–2000 字）",
    "version": "2026-10-23",
    "method": "与第 1 册相同：Jun Da 现代汉语字频表排序，仅保留《现代汉语常用字表》2500 常用字，取第 1001–2000 个唯一汉字。",
    "total_frequency": total_freq,
    "part1_frequency": part1_freq,
    "part2_frequency": part2_freq,
    "part1_coverage": round(part1_freq / total_freq, 6),
    "part2_marginal_coverage": round(part2_freq / total_freq, 6),
    "cumulative_coverage": round((part1_freq + part2_freq) / total_freq, 6),
    "cumulative_by_100": cum,
    "official_remaining": 2500 - 2000,
    "project_sample": project,
}

part2 = {
    "meta": meta,
    "chars": selected[1000:2000],
}
(ROOT / "work" / "corpus_doc" / "chars1000_part2.json").write_text(
    json.dumps(part2, ensure_ascii=False, indent=2), encoding="utf-8"
)
(ROOT / "work" / "corpus_doc" / "chars1000_part2.txt").write_text(
    "".join(second_chars), encoding="utf-8"
)
with (ROOT / "work" / "corpus_doc" / "chars1000_part2.csv").open(
    "w", encoding="utf-8-sig", newline=""
) as fh:
    writer = csv.writer(fh)
    writer.writerow(["list_rank", "char", "pinyin", "frequency", "per_million", "english", "source_rank"])
    for row in selected[1000:2000]:
        writer.writerow(
            [
                row["list_rank"],
                row["char"],
                row["pinyin"],
                row["frequency"],
                row["per_million"],
                row["english"],
                row["rank"],
            ]
        )

all2000 = {"meta": meta, "chars": selected}
(ROOT / "work" / "corpus_doc" / "chars2000.json").write_text(
    json.dumps(all2000, ensure_ascii=False, indent=2), encoding="utf-8"
)
(ROOT / "work" / "corpus_doc" / "chars2000.txt").write_text(
    "".join(r["char"] for r in selected), encoding="utf-8"
)
with (ROOT / "work" / "corpus_doc" / "chars2000.csv").open(
    "w", encoding="utf-8-sig", newline=""
) as fh:
    writer = csv.writer(fh)
    writer.writerow(["list_rank", "char", "pinyin", "frequency", "per_million", "english", "source_rank"])
    for row in selected:
        writer.writerow(
            [
                row["list_rank"],
                row["char"],
                row["pinyin"],
                row["frequency"],
                row["per_million"],
                row["english"],
                row["rank"],
            ]
        )

print(json.dumps({k: meta[k] for k in (
    "part1_coverage", "part2_marginal_coverage", "cumulative_coverage",
    "official_remaining", "cumulative_by_100", "project_sample"
)}, ensure_ascii=False, indent=2))
print("part2 count", len(second_chars), "unique", len(set(second_chars)))
print("first 30", "".join(second_chars[:30]))
print("last 30", "".join(second_chars[-30:]))

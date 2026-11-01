#!/usr/bin/env python3
"""Validate the 550 SVG images referenced by content/cards."""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMAGES = ROOT / "content" / "images"
files = [
    line.strip()
    for line in (ROOT / "work" / "char-audit" / "content-images.txt").read_text(encoding="utf-8").splitlines()
    if line.strip()
]
FORBIDDEN = {"text", "tspan", "image", "script", "style", "foreignObject"}
errors: list[str] = []
warnings: list[str] = []
for name in files:
    p = IMAGES / name
    if not p.exists():
        errors.append(f"{name}: missing")
        continue
    try:
        root = ET.fromstring(p.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{name}: XML {exc}")
        continue
    if root.attrib.get("viewBox") != "0 0 512 512":
        errors.append(f"{name}: viewBox {root.attrib.get('viewBox')}")
    if root.attrib.get("role") != "img":
        errors.append(f"{name}: role missing")
    if not root.attrib.get("aria-label"):
        errors.append(f"{name}: aria-label missing")
    tags = [el.tag.split("}")[-1] for el in root.iter()]
    bad = sorted(set(tags) & FORBIDDEN)
    if bad:
        errors.append(f"{name}: forbidden tags {bad}")
    for el in root.iter():
        href = el.attrib.get("href") or el.attrib.get("{http://www.w3.org/1999/xlink}href")
        if href and not href.startswith("#"):
            errors.append(f"{name}: external href {href}")
        if el.tag.endswith("path") and not el.attrib.get("d", "").strip():
            errors.append(f"{name}: empty path")
    if len(tags) < 5:
        warnings.append(f"{name}: only {len(tags)} elements")

print(f"{'✓' if not errors else '✗'} {len(files)} 张卡图：{len(errors)} error / {len(warnings)} warning")
for e in errors[:30]:
    print("  -", e)
for w in warnings[:10]:
    print("  ·", w)
sys.exit(1 if errors else 0)

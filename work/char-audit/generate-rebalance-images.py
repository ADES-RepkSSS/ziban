#!/usr/bin/env python3
"""Generate SVG images for the 2026-11 card rebalance (3 replacements + 28 additions)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "work" / "cards500"))
import generate_svgs as s  # noqa: E402

g = s.g


def icon_heart():
    b = g.shadow()
    b += g.path(
        "M 256 388 C 118 292 88 214 134 162 C 176 116 238 138 256 186 "
        "C 274 138 336 116 378 162 C 424 214 394 292 256 388 Z",
        fill=s.RED_LIGHT,
        sw=14,
    )
    b += g.path("M 178 214 q 24 -30 54 -16", stroke=s.RED, sw=9)
    b += g.path("M 132 300 h 66 l 20 -42 l 28 80 l 32 -58 h 100", stroke=s.RED, sw=9)
    return b


def icon_tooth():
    b = g.shadow()
    b += g.path(
        "M 166 154 C 166 94 346 94 346 154 C 346 212 320 262 306 346 "
        "C 296 406 266 406 258 346 L 256 302 L 254 346 C 246 406 216 406 206 346 "
        "C 192 262 166 212 166 154 Z",
        fill=s.WHITE,
        sw=14,
    )
    b += g.path("M 208 178 q 48 -22 96 0", stroke=s.BLUE, sw=9)
    b += g.dot(256, 238, 10, s.RED_LIGHT)
    return b


def icon_eye():
    b = g.shadow()
    b += g.path("M 96 256 Q 256 112 416 256 Q 256 400 96 256 Z", fill=s.WHITE, sw=14)
    b += g.circle(256, 256, 64, fill=s.BLUE_LIGHT, sw=10)
    b += g.circle(256, 256, 28, fill=s.INK, sw=0)
    b += g.circle(238, 238, 10, fill=s.WHITE, sw=0)
    b += g.path("M 132 218 q 26 -24 54 -10", stroke=s.BLUE, sw=7)
    return b


def icon_blood_pressure():
    b = g.shadow()
    # cuff
    b += g.rect(108, 300, 236, 92, fill=s.TEAL_LIGHT, rx=24, sw=12)
    b += g.rect(126, 318, 200, 56, fill=s.WHITE, rx=18, sw=8)
    b += g.path("M 344 340 H 394 Q 420 340 420 312 V 254", fill="none", stroke=s.INK, sw=10)
    # gauge
    b += g.rect(292, 96, 132, 132, fill=s.WHITE, rx=28, sw=12)
    b += g.circle(358, 162, 46, fill=s.WHITE, sw=10)
    b += g.line(358, 162, 386, 132, stroke=s.RED, sw=9)
    b += g.circle(358, 162, 9, fill=s.INK, sw=0)
    for angle in (-140, -90, -40):
        import math
        x = 358 + 38 * math.cos(math.radians(angle))
        y = 162 + 38 * math.sin(math.radians(angle))
        b += g.dot(round(x), round(y), 4, s.INK)
    return b


def icon_walking():
    b = g.shadow()
    # one walking elder
    b += g.circle(238, 122, 34, fill=s.SKIN, sw=10)
    b += g.path("M 238 158 V 264", stroke=s.TEAL, sw=20)
    b += g.path("M 238 176 L 188 222", stroke=s.SKIN, sw=13)
    b += g.path("M 238 176 L 292 214", stroke=s.SKIN, sw=13)
    b += g.path("M 238 264 L 186 354", stroke=s.INK, sw=14)
    b += g.path("M 238 264 L 292 348", stroke=s.INK, sw=14)
    b += g.line(174, 356, 204, 356, stroke=s.INK, sw=12)
    b += g.line(278, 350, 306, 350, stroke=s.INK, sw=12)
    # small path / ground
    b += g.path("M 120 390 H 398", stroke=s.GREEN, sw=10)
    b += g.path("M 118 410 H 300", stroke=s.GREEN_LIGHT, sw=8)
    return b


def icon_limbs():
    b = g.shadow()
    # hand
    b += g.rect(104, 164, 120, 150, fill=s.SKIN, rx=34, sw=12)
    for x in (126, 150, 174, 198):
        b += g.line(x, 164, x, 112, stroke=s.SKIN, sw=16)
    b += g.path("M 104 250 L 76 286", stroke=s.SKIN, sw=18)
    # foot
    b += g.path(
        "M 270 300 Q 270 232 330 232 Q 386 232 410 274 Q 432 314 394 334 L 270 334 Z",
        fill=s.SKIN,
        sw=12,
    )
    b += g.path("M 300 334 v 22 M 340 334 v 22 M 380 334 v 22", stroke=s.INK, sw=8)
    return b


def icon_keyboard():
    b = g.shadow()
    b += g.rect(80, 210, 352, 168, fill=s.WHITE, rx=22, sw=12)
    for row, y in enumerate((238, 280, 322)):
        for col in range(6):
            x = 104 + col * 52 + (row % 2) * 10
            b += g.rect(x, y, 38, 24, fill=s.LIGHT_GREY, rx=7, sw=7)
    b += g.rect(150, 354, 212, 12, fill=s.TEAL_LIGHT, rx=6, sw=0)
    return b


def icon_road_sign():
    b = g.shadow()
    b += g.rect(240, 250, 32, 160, fill=s.BROWN, rx=10, sw=10)
    b += g.rect(108, 116, 296, 160, fill=s.BLUE_LIGHT, rx=26, sw=14)
    b += g.path("M 160 196 H 300", stroke=s.WHITE, sw=20)
    b += g.path("M 300 196 l -34 -28 M 300 196 l -34 28", stroke=s.WHITE, sw=20)
    b += g.circle(140, 148, 7, fill=s.WHITE, sw=0)
    b += g.circle(372, 148, 7, fill=s.WHITE, sw=0)
    return b


def prop_lock(color=s.INK):
    b = g.rect(22, 44, 56, 44, fill=s.AMBER_LIGHT, rx=10, sw=7)
    b += g.path("M 34 44 V 32 Q 34 12 50 12 Q 66 12 66 32 V 44", fill="none", stroke=color, sw=8)
    b += g.circle(50, 62, 7, fill=color, sw=0)
    b += g.rect(47, 62, 6, 14, fill=color, rx=3, sw=0)
    return b


s.ALL_ICONS.update({
    "heart": icon_heart,
    "tooth": icon_tooth,
    "eye": icon_eye,
    "blood-pressure": icon_blood_pressure,
    "walking": icon_walking,
    "limbs": icon_limbs,
    "keyboard": icon_keyboard,
    "road-sign": icon_road_sign,
})
s.PROPS["lock"] = prop_lock

data = json.loads((ROOT / "work" / "char-audit" / "rebalance-data.json").read_text(encoding="utf-8"))
rows = [*data["replacements"], *data["additions"]]
for row in rows:
    card = {
        "id": row["id"],
        "text": row["text"],
        "image": {"alt": row["imageAlt"]},
        "visual": row["visual"],
    }
    svg = s.render_card(card)
    (ROOT / "content" / "images" / row["image"]).write_text(svg, encoding="utf-8")
    print(f"wrote content/images/{row['image']}  {row['text']}")
print(f"done {len(rows)} images")

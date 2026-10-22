#!/usr/bin/env python3
"""生成字伴 v0.1 的手绘 SVG 配图（CC BY-SA 4.0）。

刻意保持：粗轮廓、平涂、单一主体、图内不出现文字。
这样既能在小屏上辨认，也不会把“答案”直接写在图上。

用法：
    python tools/generate_images.py
输出：
    content/images/*.svg
    tools/output/contact-sheet.html（人工目检用的联络表）
"""

from __future__ import annotations

import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "images"
SHEET = ROOT / "tools" / "output" / "contact-sheet.html"

INK = "#26313D"
CREAM = "#FCF8EF"
BG = "#F4EBD9"
TEAL = "#1D7A72"
TEAL_LIGHT = "#8FC7C1"
RED = "#C9483A"
RED_LIGHT = "#E9A59C"
AMBER = "#E8A63C"
AMBER_LIGHT = "#F6D08E"
BLUE = "#3E6FA6"
BLUE_LIGHT = "#A8C4DF"
GREEN = "#4F8A5B"
GREEN_LIGHT = "#A9C9A4"
PINK = "#D98C8C"
GREY = "#9AA4AE"
LIGHT_GREY = "#D9DEE3"
WHITE = "#FFFFFF"
BROWN = "#9A6B4A"
SKIN = "#E9B98F"


def rect(x, y, w, h, fill=WHITE, rx=24, stroke=INK, sw=14, extra=""):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'
    )


def circle(cx, cy, r, fill=WHITE, stroke=INK, sw=14, extra=""):
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="{sw}" {extra}/>'
    )


def ellipse(cx, cy, rx, ry, fill=WHITE, stroke=INK, sw=14, extra=""):
    return (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="{sw}" {extra}/>'
    )


def line(x1, y1, x2, y2, stroke=INK, sw=14, extra=""):
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" '
        f'stroke-width="{sw}" stroke-linecap="round" {extra}/>'
    )


def path(d, fill="none", stroke=INK, sw=14, extra=""):
    return (
        f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
        f'stroke-linecap="round" stroke-linejoin="round" {extra}/>'
    )


def poly(points, fill=WHITE, stroke=INK, sw=14, extra=""):
    return (
        f'<polygon points="{points}" fill="{fill}" stroke="{stroke}" '
        f'stroke-width="{sw}" stroke-linejoin="round" {extra}/>'
    )


def shadow(cx=256, cy=421, rx=132, ry=17):
    return ellipse(cx, cy, rx, ry, fill="#DDCEB7", stroke="none", sw=0, extra='opacity="0.75"')


def dot(cx, cy, r=9, fill=INK):
    return circle(cx, cy, r, fill=fill, stroke="none", sw=0)


def cross(cx, cy, size=52, color=RED, sw=22):
    return (
        line(cx - size, cy, cx + size, cy, stroke=color, sw=sw)
        + line(cx, cy - size, cx, cy + size, stroke=color, sw=sw)
    )


def capsule(cx, cy, angle=0):
    return (
        f'<g transform="rotate({angle} {cx} {cy})">'
        + rect(cx - 58, cy - 26, 116, 52, fill=WHITE, rx=26, sw=12)
        + f'<path d="M {cx - 2} {cy - 26} L {cx - 2} {cy + 26}" stroke="{RED}" stroke-width="12"/>'
        + f'<path d="M {cx - 58} {cy - 26} Q {cx - 58} {cy + 26} {cx - 2} {cy + 26} '
          f'L {cx - 2} {cy - 26} Z" fill="{RED_LIGHT}" stroke="none"/>'
        + "</g>"
    )


def wrap(body: str, label: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="{html.escape(label)}">
  <rect width="512" height="512" rx="40" fill="{BG}"/>
  <circle cx="256" cy="248" r="196" fill="{CREAM}"/>
  {body}
</svg>
'''


def icon_medicine_box():
    b = shadow()
    b += rect(118, 214, 276, 190, fill=WHITE, rx=26)
    b += rect(118, 214, 276, 62, fill=RED_LIGHT, rx=26)
    b += rect(118, 248, 276, 10, fill=RED_LIGHT, rx=0, sw=0)
    b += circle(256, 320, 54, fill=WHITE, sw=12)
    b += cross(256, 320, 30, RED, 16)
    b += capsule(354, 168, -28)
    b += capsule(400, 238, 22)
    return b


def icon_hospital():
    b = shadow()
    b += rect(92, 190, 328, 210, fill=WHITE, rx=18)
    b += rect(92, 190, 328, 24, fill=BLUE_LIGHT, rx=12, sw=10)
    b += rect(196, 120, 120, 92, fill=WHITE, rx=18)
    b += cross(256, 166, 30, RED, 18)
    b += rect(224, 300, 64, 100, fill=TEAL, rx=12)
    b += circle(256, 352, 6, fill=AMBER, stroke="none", sw=0)
    for x in (140, 320):
        b += rect(x, 250, 52, 52, fill=BLUE_LIGHT, rx=10, sw=10)
    b += rect(82, 400, 348, 20, fill=LIGHT_GREY, rx=8, sw=10)
    return b


def icon_registration():
    b = shadow()
    b += rect(74, 148, 210, 252, fill=TEAL, rx=24)
    b += rect(98, 174, 162, 108, fill=CREAM, rx=12, sw=10)
    b += path("M 128 246 l 26 -30 l 22 22 l 40 -48", stroke=GREEN_LIGHT, sw=14)
    b += rect(126, 310, 104, 12, fill=TEAL_LIGHT, rx=6, sw=0)
    b += rect(198, 340, 18, 60, fill=TEAL_LIGHT, rx=6, sw=0)
    b += circle(179, 120, 34, fill=WHITE, sw=10)
    b += cross(179, 120, 18, RED, 12)
    b += path("M 332 296 q -34 4 -34 34 v 50", stroke=INK, sw=10)
    b += f'<g transform="rotate(7 356 300)">'
    b += rect(306, 190, 138, 196, fill=WHITE, rx=16, sw=12)
    b += rect(330, 218, 90, 12, fill=LIGHT_GREY, rx=6, sw=0)
    b += cross(375, 266, 22, RED, 12)
    for i in range(3):
        b += dot(342 + i * 30, 330, 7, INK)
    b += "</g>"
    return b


def icon_doctor():
    b = shadow()
    b += path("M 128 420 q 0 -126 128 -126 q 128 0 128 126 Z", fill=WHITE)
    b += path("M 206 306 q 50 40 100 0", stroke=TEAL, sw=14)
    b += circle(256, 190, 78, fill=SKIN)
    b += path("M 184 176 q 6 -66 72 -66 q 66 0 72 66 q -34 -22 -72 -22 q -38 0 -72 22 Z", fill="#B9B2AA", stroke=INK, sw=12)
    b += dot(230, 190, 7, INK)
    b += dot(282, 190, 7, INK)
    b += path("M 236 220 q 20 16 40 0", stroke=INK, sw=10)
    b += path("M 216 306 q -6 70 26 88", stroke=INK, sw=10)
    b += path("M 296 306 q 6 70 -26 88", stroke=INK, sw=10)
    b += circle(316, 368, 24, fill=WHITE, sw=10)
    b += circle(316, 368, 9, fill=TEAL, stroke="none", sw=0)
    b += rect(292, 334, 48, 46, fill=WHITE, rx=10, sw=10)
    b += cross(316, 356, 12, RED, 8)
    return b


def icon_payment_bill():
    b = shadow()
    b += f'<g transform="rotate(-6 240 280)">'
    b += rect(104, 150, 244, 282, fill=WHITE, rx=18)
    for i, width in enumerate((170, 170, 120)):
        b += rect(132, 194 + i * 44, width, 13, fill=LIGHT_GREY, rx=6, sw=0)
    b += circle(300, 360, 40, fill="none", stroke=RED, sw=10)
    b += cross(300, 360, 18, RED, 10)
    b += "</g>"
    b += ellipse(380, 372, 54, 54, fill=AMBER_LIGHT, sw=12)
    b += ellipse(380, 372, 38, 38, fill=AMBER, sw=8)
    b += ellipse(400, 330, 44, 44, fill=AMBER_LIGHT, sw=12)
    b += ellipse(400, 330, 30, 30, fill=AMBER, sw=8)
    return b


def icon_calendar_clock():
    b = shadow()
    b += rect(76, 136, 266, 250, fill=WHITE, rx=22)
    b += rect(76, 136, 266, 58, fill=RED, rx=22, sw=12)
    b += rect(76, 170, 266, 20, fill=RED, sw=0)
    b += rect(120, 106, 18, 60, fill=INK, rx=9, sw=0)
    b += rect(280, 106, 18, 60, fill=INK, rx=9, sw=0)
    for row in range(3):
        for col in range(4):
            b += dot(126 + col * 58, 238 + row * 48, 9, TEAL_LIGHT)
    b += circle(362, 326, 84, fill=WHITE)
    b += circle(362, 326, 10, fill=INK, stroke="none", sw=0)
    b += line(362, 326, 362, 278, sw=12)
    b += line(362, 326, 400, 344, sw=12)
    b += circle(362, 326, 64, fill="none", stroke=LIGHT_GREY, sw=8)
    return b


def icon_insurance_card():
    b = shadow()
    b += f'<g transform="rotate(-5 256 286)">'
    b += rect(72, 180, 368, 214, fill=TEAL, rx=24)
    b += rect(72, 180, 368, 54, fill=TEAL_LIGHT, rx=22, sw=10)
    b += rect(112, 260, 76, 58, fill=AMBER_LIGHT, rx=12, sw=8)
    b += circle(340, 300, 44, fill=WHITE, sw=10)
    b += cross(340, 300, 24, RED, 12)
    b += path("M 150 356 h 60 l 20 -30 l 26 58 l 22 -38 h 66", stroke=WHITE, sw=10)
    b += "</g>"
    return b


def icon_atm():
    b = shadow()
    b += rect(104, 92, 304, 328, fill="#DDE6E4", rx=26)
    b += rect(132, 120, 248, 114, fill="#123B3F", rx=14, sw=10)
    b += rect(150, 138, 120, 20, fill=GREEN_LIGHT, rx=8, sw=0)
    b += rect(150, 172, 180, 10, fill=TEAL_LIGHT, rx=5, sw=0)
    b += rect(150, 192, 140, 10, fill=TEAL_LIGHT, rx=5, sw=0)
    for row in range(3):
        for col in range(3):
            b += circle(166 + col * 60, 280 + row * 38, 13, fill=WHITE, sw=8)
    b += rect(300, 268, 52, 12, fill=INK, rx=6, sw=0)
    b += rect(300, 296, 52, 12, fill=INK, rx=6, sw=0)
    b += rect(180, 356, 152, 18, fill=INK, rx=8, sw=0)
    b += f'<g transform="rotate(-8 256 400)">'
    b += rect(168, 386, 176, 74, fill=GREEN_LIGHT, rx=10, sw=10)
    b += circle(256, 423, 20, fill=GREEN, stroke="none", sw=0)
    b += "</g>"
    return b


def icon_piggy_bank():
    b = shadow()
    b += ellipse(256, 312, 158, 106, fill=PINK)
    b += path("M 150 248 l -18 -48 l 54 20", fill=PINK)
    b += path("M 362 248 l 18 -48 l -54 20", fill=PINK)
    b += ellipse(376, 320, 54, 40, fill=RED_LIGHT, sw=10)
    b += dot(390, 314, 7, INK)
    b += dot(390, 332, 6, INK)
    b += circle(224, 292, 8, fill=INK, stroke="none", sw=0)
    b += path("M 196 336 q 30 18 62 4", stroke=INK, sw=8)
    b += rect(184, 398, 28, 26, fill=PINK, rx=8, sw=10)
    b += rect(300, 398, 28, 26, fill=PINK, rx=8, sw=10)
    b += rect(232, 204, 62, 14, fill=INK, rx=7, sw=0)
    b += ellipse(300, 160, 42, 42, fill=AMBER_LIGHT, sw=10)
    b += circle(300, 160, 22, fill=AMBER, stroke="none", sw=0)
    b += path("M 288 148 q 12 -8 24 0", stroke=BROWN, sw=6)
    return b


def icon_keypad():
    b = shadow()
    b += rect(106, 92, 300, 336, fill=WHITE, rx=26)
    b += rect(134, 118, 244, 80, fill="#123B3F", rx=12, sw=10)
    b += rect(154, 140, 56, 12, fill=GREEN_LIGHT, rx=6, sw=0)
    b += rect(154, 164, 120, 10, fill=TEAL_LIGHT, rx=5, sw=0)
    for row in range(4):
        for col in range(3):
            cx, cy = 176 + col * 80, 246 + row * 44
            fill = GREEN_LIGHT if row == 3 and col == 2 else LIGHT_GREY
            b += circle(cx, cy, 22, fill=fill, sw=8)
            if not (row == 3 and col == 2):
                b += dot(cx, cy, 4, INK)
    b += path("M 236 378 l 10 10 l 18 -22", stroke=WHITE, sw=8)
    return b


def icon_bank_card():
    b = shadow()
    b += f'<g transform="rotate(-6 256 286)">'
    b += rect(66, 176, 380, 220, fill=TEAL, rx=26)
    b += rect(66, 176, 380, 64, fill="#155B56", rx=24, sw=0)
    b += rect(66, 240, 380, 10, fill="#155B56", sw=0)
    b += rect(108, 270, 80, 62, fill=AMBER_LIGHT, rx=12, sw=8)
    b += path("M 108 292 h 80 M 138 270 v 62", stroke=AMBER, sw=8)
    b += circle(372, 300, 20, fill=WHITE, stroke="none", sw=0)
    b += circle(340, 300, 20, fill=WHITE, stroke="none", sw=0, extra='opacity="0.65"')
    for i in range(4):
        b += circle(110 + i * 22, 368, 6, fill=WHITE, stroke="none", sw=0)
    b += "</g>"
    return b


def icon_wallet():
    b = shadow()
    b += rect(86, 208, 340, 200, fill=BROWN, rx=26)
    b += path("M 86 246 q 170 36 340 0 v -38 q 0 -20 -20 -20 H 106 q -20 0 -20 20 Z", fill="#B4845F")
    b += rect(300, 256, 126, 96, fill="#C99872", rx=18)
    b += circle(390, 304, 14, fill=AMBER, sw=8)
    b += ellipse(160, 192, 64, 64, fill=AMBER_LIGHT, sw=12)
    b += circle(160, 192, 40, fill=AMBER, sw=8)
    b += ellipse(220, 172, 48, 48, fill=AMBER_LIGHT, sw=12)
    b += circle(220, 172, 28, fill=AMBER, sw=8)
    b += path("M 120 300 q 60 -18 110 0", stroke="#7B5338", sw=8)
    return b


def icon_transfer():
    b = shadow()
    for x in (78, 306):
        b += rect(x, 148, 128, 256, fill=WHITE, rx=24)
        b += rect(x + 16, 172, 96, 184, fill="#DDF0EE", rx=10, sw=0)
        b += circle(x + 64, 240, 36, fill=TEAL_LIGHT, sw=8)
        b += path(f"M {x + 34} 330 q 30 -34 60 0", stroke=TEAL, sw=10)
        b += circle(x + 64, 376, 10, fill=LIGHT_GREY, stroke="none", sw=0)
    b += line(224, 262, 288, 262, stroke=RED, sw=16)
    b += path("M 264 238 l 30 24 l -30 24", stroke=RED, sw=16)
    b += circle(256, 330, 34, fill=AMBER_LIGHT, sw=10)
    b += circle(256, 330, 18, fill=AMBER, stroke="none", sw=0)
    return b


def icon_check_button():
    b = shadow()
    b += circle(248, 250, 150, fill=GREEN)
    b += circle(248, 250, 132, fill=GREEN_LIGHT, stroke="none", sw=0, extra='opacity="0.55"')
    b += path("M 178 250 l 52 52 l 96 -108", stroke=WHITE, sw=28)
    b += path("M 344 366 l 62 64 l 24 -34 l 34 -8 Z", fill=WHITE)
    b += path("M 344 366 l 62 64 l 24 -34 l 34 -8 Z", fill="none", stroke=INK, sw=10)
    return b


def icon_x_button():
    b = shadow()
    b += circle(248, 250, 150, fill="#E7EAEE")
    b += circle(248, 250, 132, fill=WHITE, stroke="none", sw=0, extra='opacity="0.7"')
    b += line(202, 204, 294, 296, stroke=INK, sw=26)
    b += line(294, 204, 202, 296, stroke=INK, sw=26)
    b += path("M 350 372 l 58 60 l 22 -30 l 32 -8 Z", fill=WHITE)
    b += path("M 350 372 l 58 60 l 22 -30 l 32 -8 Z", fill="none", stroke=INK, sw=10)
    return b


def icon_bus():
    b = shadow()
    b += rect(84, 150, 344, 220, fill=GREEN, rx=26)
    b += rect(104, 172, 304, 96, fill="#DDF0EE", rx=14, sw=10)
    for x in (150, 250, 350):
        b += line(x, 172, x, 268, stroke=INK, sw=10)
    b += rect(112, 294, 64, 34, fill=AMBER_LIGHT, rx=8, sw=8)
    b += rect(312, 294, 70, 34, fill=AMBER_LIGHT, rx=8, sw=8)
    b += circle(160, 386, 42, fill=INK, sw=8)
    b += circle(160, 386, 16, fill=LIGHT_GREY, stroke="none", sw=0)
    b += circle(352, 386, 42, fill=INK, sw=8)
    b += circle(352, 386, 16, fill=LIGHT_GREY, stroke="none", sw=0)
    b += circle(406, 310, 12, fill=AMBER, sw=8)
    b += path("M 84 330 h 344", stroke=INK, sw=10)
    return b


def icon_bus_stop():
    b = shadow()
    b += rect(166, 116, 22, 300, fill=GREY, rx=10)
    b += rect(96, 92, 202, 148, fill=TEAL, rx=24)
    b += rect(120, 116, 154, 100, fill=CREAM, rx=14, sw=10)
    b += rect(146, 140, 94, 52, fill=GREEN, rx=10, sw=8)
    b += rect(158, 152, 24, 20, fill=CREAM, rx=4, sw=0)
    b += rect(192, 152, 24, 20, fill=CREAM, rx=4, sw=0)
    b += circle(170, 196, 10, fill=INK, stroke="none", sw=0)
    b += circle(214, 196, 10, fill=INK, stroke="none", sw=0)
    b += f'<g transform="translate(310 262) scale(0.52)">'
    b += rect(0, 0, 344, 220, fill=GREEN_LIGHT, rx=26)
    b += rect(28, 28, 288, 92, fill=CREAM, rx=12, sw=8)
    for x in (76, 140, 204, 268):
        b += line(x, 28, x, 120, stroke=INK, sw=8)
    b += circle(76, 236, 42, fill=INK, stroke="none", sw=0)
    b += circle(268, 236, 42, fill=INK, stroke="none", sw=0)
    b += "</g>"
    b += rect(120, 390, 180, 20, fill=TEAL_LIGHT, rx=10, sw=8)
    b += rect(134, 410, 16, 26, fill=GREY, rx=6, sw=0)
    b += rect(270, 410, 16, 26, fill=GREY, rx=6, sw=0)
    return b


def icon_subway():
    b = shadow()
    b += path("M 70 420 v -170 q 0 -120 186 -120 q 186 0 186 120 v 170 Z", fill="#D9DEE3")
    b += path("M 106 420 v -150 q 0 -88 150 -88 q 150 0 150 88 v 150 Z", fill="#B9C3CA")
    b += rect(148, 168, 216, 212, fill=TEAL, rx=42)
    b += rect(176, 196, 66, 70, fill=CREAM, rx=14, sw=8)
    b += rect(270, 196, 66, 70, fill=CREAM, rx=14, sw=8)
    b += circle(202, 326, 14, fill=AMBER, sw=8)
    b += circle(310, 326, 14, fill=AMBER, sw=8)
    b += rect(196, 348, 120, 20, fill="#155B56", rx=8, sw=0)
    b += line(92, 428, 420, 428, stroke=INK, sw=14)
    for x in (130, 382):
        b += line(x, 412, x + 36, 440, stroke=GREY, sw=12)
    return b


def icon_board_bus():
    b = shadow()
    b += rect(64, 150, 300, 210, fill=GREEN, rx=24)
    b += rect(84, 172, 178, 92, fill="#DDF0EE", rx=12, sw=10)
    for x in (140, 196, 252):
        b += line(x, 172, x, 264, stroke=INK, sw=9)
    b += rect(288, 172, 58, 160, fill="#155B56", rx=12, sw=10)
    b += circle(130, 382, 38, fill=INK, sw=8)
    b += circle(310, 382, 38, fill=INK, sw=8)
    b += path("M 386 210 q 64 32 26 112", stroke=RED, sw=16)
    b += path("M 394 292 l 18 32 l 30 -12", stroke=RED, sw=16)
    b += circle(364, 236, 18, fill=SKIN, sw=8)
    b += path("M 346 300 q 18 -44 36 0", fill=TEAL, sw=8)
    return b


def icon_alight_bus():
    b = shadow()
    b += rect(64, 150, 300, 210, fill=GREEN, rx=24)
    b += rect(84, 172, 178, 92, fill="#DDF0EE", rx=12, sw=10)
    for x in (140, 196, 252):
        b += line(x, 172, x, 264, stroke=INK, sw=9)
    b += rect(288, 172, 58, 160, fill="#155B56", rx=12, sw=10)
    b += circle(130, 382, 38, fill=INK, sw=8)
    b += circle(310, 382, 38, fill=INK, sw=8)
    b += path("M 380 236 q 48 -8 58 46", stroke=RED, sw=16)
    b += path("M 420 272 l 18 28 l 30 -10", stroke=RED, sw=16)
    b += circle(420, 332, 18, fill=SKIN, sw=8)
    b += path("M 402 396 q 18 -44 36 0", fill=TEAL, sw=8)
    return b


def icon_qr_scan():
    b = shadow()
    b += rect(92, 94, 272, 272, fill=WHITE, rx=20)
    # finder squares
    for x, y in ((112, 114), (274, 114), (112, 276)):
        b += rect(x, y, 60, 60, fill=INK, rx=10, sw=0)
        b += rect(x + 12, y + 12, 36, 36, fill=WHITE, rx=6, sw=0)
        b += rect(x + 22, y + 22, 16, 16, fill=INK, rx=3, sw=0)
    modules = [
        (212, 118), (238, 146), (196, 176), (224, 202), (252, 178), (284, 202),
        (306, 230), (198, 244), (226, 276), (282, 286), (244, 310), (306, 306),
        (128, 220), (160, 252), (128, 306), (168, 306),
    ]
    for x, y in modules:
        b += rect(x, y, 18, 18, fill=INK, rx=4, sw=0)
    b += rect(282, 300, 132, 132, fill=WHITE, rx=24)
    b += rect(304, 322, 88, 110, fill=CREAM, rx=12, sw=10)
    b += circle(348, 358, 16, fill=TEAL, sw=6)
    b += rect(330, 384, 36, 12, fill=TEAL_LIGHT, rx=6, sw=0)
    # scan brackets
    b += path("M 76 130 v -44 h 44", stroke=RED, sw=16)
    b += path("M 380 86 h 44 v 44", stroke=RED, sw=16)
    b += path("M 424 330 v 44 h -44", stroke=RED, sw=16)
    b += path("M 120 374 h -44 v -44", stroke=RED, sw=16)
    return b


def icon_switch_on():
    b = shadow()
    b += rect(124, 116, 264, 292, fill=WHITE, rx=34)
    b += rect(152, 196, 208, 96, fill=GREEN, rx=48)
    b += circle(314, 244, 36, fill=WHITE, sw=10)
    b += circle(198, 156, 12, fill=AMBER, sw=6)
    b += path("M 172 132 l -14 -22 M 224 128 l 0 -26 M 128 156 l -24 -12", stroke=AMBER, sw=10)
    b += circle(256, 340, 16, fill=GREEN_LIGHT, stroke="none", sw=0)
    b += line(214, 340, 298, 340, stroke=LIGHT_GREY, sw=8)
    return b


def icon_switch_off():
    b = shadow()
    b += rect(124, 116, 264, 292, fill=WHITE, rx=34)
    b += rect(152, 196, 208, 96, fill=LIGHT_GREY, rx=48)
    b += circle(198, 244, 36, fill=WHITE, sw=10)
    b += circle(256, 340, 16, fill=GREY, stroke="none", sw=0)
    b += line(214, 340, 298, 340, stroke=LIGHT_GREY, sw=8)
    return b


def _balls(highlight):
    b = shadow()
    b += circle(202, 300, 108, fill=RED)
    b += circle(370, 352, 50, fill=BLUE)
    if highlight == "big":
        b += circle(202, 300, 134, fill="none", stroke=AMBER, sw=10, extra='stroke-dasharray="14 14"')
    else:
        b += circle(370, 352, 72, fill="none", stroke=AMBER, sw=10, extra='stroke-dasharray="14 14"')
    b += path("M 142 178 q 40 -34 96 -24", stroke=AMBER, sw=8)
    return b


def icon_big_ball():
    return _balls("big")


def icon_small_ball():
    return _balls("small")


def icon_thermometer():
    b = shadow()
    b += rect(226, 90, 60, 284, fill=WHITE, rx=30)
    b += path("M 256 128 v 240", stroke=RED, sw=20)
    b += circle(256, 384, 58, fill=RED)
    b += circle(256, 384, 36, fill=RED_LIGHT, stroke="none", sw=0)
    for i in range(6):
        y = 150 + i * 40
        b += line(300, y, 326, y, stroke=GREY, sw=8)
    b += line(154, 150, 198, 150, stroke=GREY, sw=8)
    b += line(154, 230, 198, 230, stroke=GREY, sw=8)
    b += line(154, 310, 198, 310, stroke=GREY, sw=8)
    return b


def icon_speaker_waves():
    b = shadow()
    b += poly("150 210 214 210 286 148 286 364 214 302 150 302", fill=TEAL)
    b += circle(292, 256, 20, fill=TEAL_LIGHT, sw=8)
    for r in (52, 88, 124):
        b += path(
            f"M 292 256 m {r} 0 a {r} {r} 0 0 1 {-r * 2} 0",
            stroke=AMBER if r == 52 else TEAL_LIGHT,
            sw=16,
        )
    return b


def icon_wechat():
    b = shadow()
    b += rect(86, 108, 340, 300, fill=GREEN, rx=64)
    b += ellipse(202, 246, 92, 74, fill=WHITE, sw=10)
    b += path("M 148 306 l -18 40 l 46 -24", fill=WHITE, sw=10)
    b += dot(174, 234, 9, GREEN)
    b += dot(228, 234, 9, GREEN)
    b += ellipse(324, 310, 80, 62, fill=WHITE, sw=10)
    b += path("M 366 358 l 14 34 l -40 -18", fill=WHITE, sw=10)
    b += dot(300, 300, 8, GREEN)
    b += dot(346, 300, 8, GREEN)
    return b


def icon_phone():
    b = shadow()
    b += rect(148, 286, 216, 92, fill=RED, rx=26)
    b += rect(186, 222, 140, 76, fill=RED, rx=30)
    b += circle(204, 260, 34, fill=RED_LIGHT, sw=10)
    b += circle(308, 260, 34, fill=RED_LIGHT, sw=10)
    b += path("M 204 260 q 52 52 104 0", stroke=RED_LIGHT, sw=12)
    b += path("M 364 326 q 46 26 20 66 q -18 28 -54 12", stroke=INK, sw=10)
    for i in range(3):
        b += circle(178 + i * 28, 334, 5, fill=WHITE, stroke="none", sw=0)
    b += rect(222, 330, 68, 14, fill="#9F2F24", rx=7, sw=0)
    return b


def icon_mic():
    b = shadow()
    b += rect(216, 96, 80, 184, fill="#D9DEE3", rx=40)
    b += rect(234, 116, 44, 144, fill=GREY, rx=22, sw=0)
    for y in (144, 176, 208, 240):
        b += line(238, y, 274, y, stroke=WHITE, sw=6)
    b += path("M 304 238 v 34 q 0 56 -48 56 q -48 0 -48 -56 v -34", stroke=INK, sw=14)
    b += line(256, 328, 256, 368, stroke=INK, sw=14)
    b += line(210, 388, 302, 388, stroke=INK, sw=14)
    b += path("M 154 210 q -24 46 0 92", stroke=AMBER, sw=10)
    b += path("M 342 210 q 24 46 0 92", stroke=AMBER, sw=10)
    return b


def icon_video_call():
    b = shadow()
    b += rect(88, 136, 336, 236, fill=WHITE, rx=26)
    b += rect(108, 156, 296, 180, fill="#DDF0EE", rx=14, sw=10)
    b += circle(256, 230, 38, fill=SKIN, sw=10)
    b += path("M 190 318 q 0 -54 66 -54 q 66 0 66 54", fill=TEAL, sw=10)
    b += rect(226, 372, 60, 34, fill=GREY, rx=10)
    b += rect(184, 406, 144, 16, fill=GREY, rx=8, sw=8)
    b += rect(392, 196, 62, 72, fill=BLUE, rx=14)
    b += circle(423, 232, 18, fill=CREAM, sw=8)
    b += path("M 454 196 l 30 -18 v 140 l -30 -18 Z", fill=BLUE)
    return b


def icon_paper_plane():
    b = shadow()
    b += poly("126 186 414 250 216 286 190 372 166 300", fill=BLUE)
    b += path("M 414 250 L 216 286 L 280 316", stroke=INK, sw=12)
    b += path("M 126 186 L 280 316 L 216 286", stroke=INK, sw=12)
    b += path("M 92 330 q 52 10 76 44", stroke=TEAL_LIGHT, sw=10, extra='stroke-dasharray="2 24"')
    b += path("M 88 270 q 34 2 54 18", stroke=TEAL_LIGHT, sw=10, extra='stroke-dasharray="2 22"')
    return b


def icon_red_envelope():
    b = shadow()
    b += rect(128, 116, 256, 296, fill=RED, rx=22)
    b += path("M 128 116 h 256 l -128 132 Z", fill=RED_LIGHT)
    b += circle(256, 254, 38, fill=AMBER, sw=10)
    b += circle(256, 254, 22, fill=AMBER_LIGHT, stroke="none", sw=0)
    b += path("M 238 254 l 12 12 l 24 -26", stroke=RED, sw=8)
    b += path("M 128 412 q 128 -48 256 0", stroke="#9F2F24", sw=12)
    b += circle(402, 350, 30, fill=AMBER_LIGHT, sw=8)
    b += circle(402, 350, 16, fill=AMBER, stroke="none", sw=0)
    return b


def icon_message_bubble():
    b = shadow()
    b += path("M 106 130 h 300 q 26 0 26 26 v 148 q 0 26 -26 26 H 232 l -58 62 l 4 -62 H 106 q -26 0 -26 -26 V 156 q 0 -26 26 -26 Z", fill=BLUE)
    for i in range(4):
        b += dot(174 + i * 54, 230, 11, WHITE)
    b += path("M 120 388 q 72 -24 146 0", stroke=TEAL_LIGHT, sw=10)
    return b


def icon_id_card():
    b = shadow()
    b += f'<g transform="rotate(-4 256 286)">'
    b += rect(64, 168, 384, 232, fill=WHITE, rx=24)
    b += rect(64, 168, 384, 52, fill=BLUE_LIGHT, rx=22, sw=10)
    b += circle(166, 290, 56, fill="#DDF0EE", sw=10)
    b += circle(166, 274, 24, fill=SKIN, stroke="none", sw=0)
    b += path("M 126 330 q 40 -40 80 0", fill=TEAL, sw=8)
    for i, width in enumerate((154, 154, 112)):
        b += rect(250, 250 + i * 36, width, 12, fill=LIGHT_GREY, rx=6, sw=0)
    b += rect(318, 350, 74, 34, fill=AMBER_LIGHT, rx=8, sw=8)
    b += cross(432, 194, 12, RED, 8)
    b += "</g>"
    return b


def icon_social_card():
    b = shadow()
    b += f'<g transform="rotate(4 256 286)">'
    b += rect(68, 172, 376, 224, fill=WHITE, rx=24)
    b += rect(68, 172, 376, 50, fill=GREEN_LIGHT, rx=22, sw=10)
    b += circle(174, 290, 56, fill="#DDF0EE", sw=10)
    b += circle(174, 274, 26, fill=SKIN, stroke="none", sw=0)
    b += path("M 138 326 q 36 -38 72 0", fill=GREY, sw=8)
    b += circle(152, 276, 10, fill="none", stroke=INK, sw=6)
    b += circle(196, 276, 10, fill="none", stroke=INK, sw=6)
    b += line(162, 276, 186, 276, stroke=INK, sw=5)
    for i, width in enumerate((150, 150, 106)):
        b += rect(258, 254 + i * 36, width, 12, fill=LIGHT_GREY, rx=6, sw=0)
    b += path("M 386 292 q 28 -30 52 0", stroke=GREEN, sw=10)
    b += circle(412, 270, 14, fill=GREEN, stroke="none", sw=0)
    b += "</g>"
    return b


def icon_service_counter():
    b = shadow()
    b += rect(64, 152, 384, 196, fill=WHITE, rx=24)
    b += rect(64, 320, 384, 92, fill="#DDE6E4", rx=18)
    b += rect(88, 340, 336, 20, fill=TEAL_LIGHT, rx=10, sw=0)
    # clerk
    b += circle(300, 210, 36, fill=SKIN)
    b += path("M 246 320 q 0 -62 54 -62 q 54 0 54 62", fill=TEAL, sw=10)
    # citizen from behind
    b += circle(180, 244, 34, fill="#B9B2AA")
    b += path("M 120 372 q 0 -74 60 -74 q 60 0 60 74", fill=BLUE, sw=10)
    b += rect(220, 274, 92, 58, fill=WHITE, rx=8, sw=8)
    b += line(238, 292, 294, 292, stroke=LIGHT_GREY, sw=6)
    b += line(238, 310, 280, 310, stroke=LIGHT_GREY, sw=6)
    return b


def icon_service_window():
    b = shadow()
    b += rect(56, 92, 400, 300, fill="#E7EAEE", rx=22)
    b += rect(96, 128, 320, 180, fill="#B9D8D5", rx=14)
    b += line(256, 128, 256, 308, stroke=INK, sw=12)
    b += circle(176, 210, 34, fill=SKIN, sw=8)
    b += path("M 128 292 q 0 -54 48 -54 q 48 0 48 54", fill=TEAL, sw=8)
    b += rect(96, 308, 320, 28, fill=TEAL_LIGHT, rx=10, sw=0)
    b += rect(56, 336, 400, 56, fill="#C9D2D8", rx=12, sw=10)
    b += circle(256, 96, 32, fill=WHITE, sw=8)
    b += dot(256, 96, 10, AMBER)
    b += path("M 150 356 h 212", stroke=WHITE, sw=8)
    return b


def icon_submit_tray():
    b = shadow()
    b += path("M 118 302 h 276 v 94 q 0 18 -18 18 H 136 q -18 0 -18 -18 Z", fill=TEAL_LIGHT)
    b += path("M 118 302 l 34 -28 h 208 l 34 28", fill="#DDF0EE", sw=10)
    b += rect(178, 118, 156, 132, fill=WHITE, rx=12)
    b += line(202, 150, 310, 150, stroke=LIGHT_GREY, sw=10)
    b += line(202, 178, 310, 178, stroke=LIGHT_GREY, sw=10)
    b += line(202, 206, 274, 206, stroke=LIGHT_GREY, sw=10)
    b += line(256, 264, 256, 306, stroke=RED, sw=14)
    b += path("M 232 288 l 24 24 l 24 -24", stroke=RED, sw=14)
    return b


def icon_pay():
    b = shadow()
    b += rect(310, 150, 140, 236, fill="#DDE6E4", rx=22)
    b += rect(330, 176, 100, 78, fill="#123B3F", rx=10, sw=8)
    b += path("M 356 214 l 16 16 l 30 -32", stroke=GREEN_LIGHT, sw=10)
    for row in range(2):
        for col in range(2):
            b += circle(352 + col * 60, 290 + row * 40, 14, fill=WHITE, sw=7)
    b += rect(330, 354, 100, 12, fill=INK, rx=6, sw=0)
    # hand + card
    b += path("M 52 330 q 62 -34 132 -16 q 42 10 62 42 q 14 24 -10 34 q -24 10 -44 -8", fill=SKIN)
    b += f'<g transform="rotate(-16 240 306)">'
    b += rect(182, 280, 116, 74, fill=TEAL, rx=12, sw=10)
    b += rect(200, 296, 30, 22, fill=AMBER_LIGHT, rx=5, sw=5)
    b += "</g>"
    b += path("M 318 232 q 24 -22 0 -44 M 336 250 q 36 -36 0 -72", stroke=TEAL, sw=10)
    return b


def icon_price_tag():
    b = shadow()
    b += f'<g transform="rotate(10 256 280)">'
    b += path("M 116 150 h 220 l 76 130 l -76 130 H 116 Z", fill=AMBER_LIGHT)
    b += circle(156, 200, 15, fill=CREAM, sw=10)
    b += circle(300, 280, 66, fill=WHITE, sw=12)
    b += circle(300, 280, 46, fill=AMBER, stroke="none", sw=0)
    b += circle(284, 268, 16, fill=AMBER_LIGHT, sw=6)
    b += circle(318, 290, 14, fill=AMBER_LIGHT, sw=6)
    b += circle(296, 308, 12, fill=AMBER_LIGHT, sw=6)
    b += "</g>"
    b += path("M 152 108 q 30 -28 58 0", stroke=GREY, sw=8)
    b += path("M 172 90 q 16 -18 34 0", stroke=GREY, sw=8)
    return b


def icon_discount_tag():
    b = shadow()
    b += f'<g transform="rotate(-8 256 280)">'
    b += path("M 110 158 h 220 l 82 122 l -82 122 H 110 Z", fill=RED)
    b += circle(154, 210, 14, fill=CREAM, sw=9)
    b += circle(302, 282, 58, fill=WHITE, sw=10)
    b += line(270, 316, 334, 248, stroke=RED, sw=16)
    b += circle(278, 256, 10, fill=RED, stroke="none", sw=0)
    b += circle(324, 306, 10, fill=RED, stroke="none", sw=0)
    b += "</g>"
    b += path("M 386 130 l 16 30 l 30 16 l -30 16 l -16 30 l -16 -30 l -30 -16 l 30 -16 Z", fill=AMBER, sw=8)
    return b


def icon_basket():
    b = shadow()
    b += path("M 116 236 h 280 l -34 164 q -4 16 -20 16 H 170 q -16 0 -20 -16 Z", fill=AMBER_LIGHT)
    b += path("M 150 236 q 20 -94 106 -94 q 86 0 106 94", fill="none", sw=16)
    for i in range(4):
        b += line(170 + i * 52, 258, 178 + i * 52, 392, stroke=AMBER, sw=8)
    for i in range(2):
        b += line(150, 302 + i * 46, 352, 302 + i * 46, stroke=AMBER, sw=8)
    b += circle(218, 206, 32, fill=GREEN, sw=8)
    b += path("M 218 174 q 18 -26 40 -18 q -8 28 -40 18", fill=GREEN_LIGHT, sw=8)
    b += circle(300, 220, 26, fill=RED, sw=8)
    b += path("M 300 194 q 8 -22 28 -22 q 2 24 -28 22", fill=GREEN, sw=6)
    return b


def icon_sms_code():
    b = shadow()
    b += rect(142, 58, 228, 390, fill=WHITE, rx=36)
    b += rect(160, 92, 192, 302, fill="#DDF0EE", rx=12, sw=0)
    b += rect(232, 74, 48, 10, fill=LIGHT_GREY, rx=5, sw=0)
    b += path("M 184 144 h 144 q 14 0 14 14 v 92 q 0 14 -14 14 H 266 l -30 32 l 2 -32 h -54 q -14 0 -14 -14 v -92 q 0 -14 14 -14 Z", fill=BLUE, sw=8)
    for i in range(6):
        b += circle(206 + (i % 3) * 44, 186 + (i // 3) * 42, 10, fill=WHITE, stroke="none", sw=0)
    b += circle(256, 418, 12, fill=LIGHT_GREY, stroke="none", sw=0)
    b += path("M 388 84 q 30 28 0 56 M 410 66 q 50 46 0 92", stroke=TEAL_LIGHT, sw=8)
    return b


def icon_trophy():
    b = shadow()
    b += path("M 160 112 h 192 v 104 q 0 84 -96 84 q -96 0 -96 -84 Z", fill=AMBER)
    b += path("M 160 140 h -48 q -16 0 -16 16 v 36 q 0 52 64 60", fill="none", sw=14)
    b += path("M 352 140 h 48 q 16 0 16 16 v 36 q 0 52 -64 60", fill="none", sw=14)
    b += rect(236, 296, 40, 54, fill=AMBER_LIGHT, rx=8, sw=10)
    b += rect(180, 350, 152, 26, fill=AMBER, rx=12)
    b += rect(160, 376, 192, 28, fill=AMBER_LIGHT, rx=12)
    b += path("M 256 160 l 14 34 l 36 4 l -26 26 l 8 36 l -32 -20 l -32 20 l 8 -36 l -26 -26 l 36 -4 Z", fill=WHITE, sw=6)
    for x, y, c in ((130, 100, RED), (380, 90, TEAL), (402, 180, BLUE), (112, 220, AMBER)):
        b += f'<g transform="rotate({x} {y})"><rect x="{x}" y="{y}" width="18" height="28" fill="{c}" rx="4" stroke="none"/></g>'
    return b


def icon_gift():
    b = shadow()
    b += rect(120, 210, 272, 200, fill=RED, rx=18)
    b += rect(102, 166, 308, 62, fill=RED_LIGHT, rx=16)
    b += rect(236, 166, 40, 244, fill=AMBER_LIGHT, sw=8)
    b += path("M 256 166 q -66 -8 -66 -48 q 0 -28 30 -28 q 36 0 36 76", fill=AMBER_LIGHT, sw=10)
    b += path("M 256 166 q 66 -8 66 -48 q 0 -28 -30 -28 q -36 0 -36 76", fill=AMBER_LIGHT, sw=10)
    b += circle(256, 166, 14, fill=AMBER, sw=8)
    b += path("M 86 340 q -34 32 0 60", stroke=TEAL_LIGHT, sw=10)
    return b


def icon_police_badge():
    b = shadow()
    b += path("M 256 70 L 396 122 V 264 q 0 108 -140 166 q -140 -58 -140 -166 V 122 Z", fill=AMBER)
    b += path("M 256 100 L 368 142 V 260 q 0 86 -112 136 q -112 -50 -112 -136 V 142 Z", fill=BLUE)
    b += path("M 256 152 l 22 52 l 56 6 l -42 40 l 12 56 l -48 -30 l -48 30 l 12 -56 l -42 -40 l 56 -6 Z", fill=AMBER_LIGHT, sw=8)
    b += circle(256, 236, 66, fill="none", stroke=AMBER_LIGHT, sw=6, extra='stroke-dasharray="6 12"')
    return b


def icon_bank():
    b = shadow()
    b += poly("256 84 432 180 80 180", fill=BLUE_LIGHT)
    b += rect(100, 180, 312, 30, fill=BLUE, rx=8, sw=10)
    for x in (134, 206, 278, 350):
        b += rect(x, 210, 34, 158, fill=WHITE, rx=8, sw=10)
        b += line(x + 17, 226, x + 17, 352, stroke=BLUE_LIGHT, sw=6)
    b += rect(80, 368, 352, 28, fill=BLUE, rx=10)
    b += rect(60, 396, 392, 24, fill=BLUE_LIGHT, rx=10)
    b += circle(256, 228, 26, fill=AMBER, sw=8)
    b += circle(256, 228, 12, fill=AMBER_LIGHT, stroke="none", sw=0)
    return b


def icon_no_entry():
    b = shadow()
    b += circle(256, 252, 158, fill=RED)
    b += circle(256, 252, 132, fill="none", stroke=WHITE, sw=14)
    b += rect(140, 228, 232, 48, fill=WHITE, rx=24, sw=0)
    # small hand under the sign, palm out
    b += path("M 214 330 q 0 -28 20 -28 h 42 q 20 0 20 28 v 26 h -82 Z", fill=SKIN, sw=10)
    b += line(220, 330, 220, 302, stroke=SKIN, sw=14)
    b += line(242, 330, 242, 296, stroke=SKIN, sw=14)
    b += line(264, 330, 264, 298, stroke=SKIN, sw=14)
    return b


def icon_hangup():
    b = shadow()
    b += f'<g transform="rotate(135 256 240)">'
    b += path("M 138 222 q -18 -58 40 -58 h 156 q 58 0 40 58 l -22 40 q -10 20 -34 12 l -40 -14 q -22 -8 -30 -20 q -8 12 -30 20 l -40 14 q -24 8 -34 -12 Z", fill=RED)
    b += rect(220, 168, 72, 30, fill=RED_LIGHT, rx=12, sw=8)
    b += "</g>"
    b += line(256, 342, 256, 406, stroke=INK, sw=16)
    b += path("M 220 374 l 36 36 l 36 -36", stroke=INK, sw=16)
    b += path("M 150 120 q 18 20 0 40 M 362 120 q -18 20 0 40", stroke=GREY, sw=8)
    return b


def icon_community():
    b = shadow()
    b += rect(96, 188, 320, 210, fill=WHITE, rx=22)
    b += poly("256 92 432 188 80 188", fill=TEAL_LIGHT)
    b += rect(140, 224, 76, 76, fill=BLUE_LIGHT, rx=12, sw=8)
    b += rect(296, 224, 76, 76, fill=BLUE_LIGHT, rx=12, sw=8)
    b += circle(256, 284, 34, fill=SKIN, sw=8)
    b += path("M 206 360 q 0 -54 50 -54 q 50 0 50 54", fill=RED, sw=8)
    b += path("M 256 268 q -34 -26 -52 -4 q -20 24 52 66 q 72 -42 52 -66 q -18 -22 -52 4 Z", fill=RED_LIGHT, sw=8)
    b += rect(220, 398, 72, 14, fill=TEAL_LIGHT, rx=7, sw=0)
    return b


def icon_phone_permission():
    b = shadow()
    b += rect(142, 62, 228, 388, fill=WHITE, rx=36)
    b += rect(160, 96, 192, 300, fill="#DDF0EE", rx=12, sw=0)
    b += path("M 256 170 q 46 0 46 46 q 0 34 -46 76 q -46 -42 -46 -76 q 0 -46 46 -46 Z", fill=RED, sw=8)
    b += circle(256, 214, 16, fill=WHITE, stroke="none", sw=0)
    b += circle(256, 330, 50, fill=WHITE, sw=8)
    b += path("M 236 330 q 20 -26 40 0", stroke=TEAL, sw=8)
    b += dot(256, 354, 10, TEAL)
    b += circle(354, 120, 34, fill=AMBER, sw=8)
    b += path("M 342 120 q 12 -20 24 0", stroke=INK, sw=7)
    b += dot(354, 132, 7, INK)
    b += path("M 386 108 q 18 12 0 24", stroke=AMBER, sw=6)
    return b


ICONS = {
    "community.svg": ("社区活动中心和两颗心", icon_community),
    "phone-permission.svg": ("手机屏幕上一个位置标记，旁边有一个问号", icon_phone_permission),
    "medicine-box.svg": ("一盒药和两粒白色的药片", icon_medicine_box),
    "hospital.svg": ("一栋白色的医院大楼，门口有红十字", icon_hospital),
    "registration.svg": ("医院大厅里的挂号机和一张带红十字的号单", icon_registration),
    "doctor.svg": ("穿白大褂、挂着听诊器的医生", icon_doctor),
    "payment-bill.svg": ("一张缴费单和几枚硬币", icon_payment_bill),
    "calendar-clock.svg": ("一个日历和一个小闹钟", icon_calendar_clock),
    "insurance-card.svg": ("一张带红十字和心跳线的医保卡", icon_insurance_card),
    "atm.svg": ("一台自动取款机，正在吐出一张钞票", icon_atm),
    "piggy-bank.svg": ("一个粉色的存钱罐，上面投进一枚硬币", icon_piggy_bank),
    "keypad.svg": ("一个数字键盘，按键上有小圆点", icon_keypad),
    "bank-card.svg": ("一张带芯片和黑色磁条的银行卡", icon_bank_card),
    "wallet.svg": ("一个打开的钱包，里面有几枚硬币", icon_wallet),
    "transfer.svg": ("两部手机之间有一个向右的箭头，表示把钱送过去", icon_transfer),
    "check-button.svg": ("一个绿色的圆形按钮，上面有一个白色的对勾", icon_check_button),
    "x-button.svg": ("一个灰白色的圆形按钮，上面有一个叉号", icon_x_button),
    "bus.svg": ("一辆绿色的公共汽车，车头有路线牌", icon_bus),
    "bus-stop.svg": ("路边的公交站牌，旁边有一辆公交车", icon_bus_stop),
    "subway.svg": ("一列从隧道里开出来的地铁", icon_subway),
    "board-bus.svg": ("公交车的门打开着，一个箭头指向车里", icon_board_bus),
    "alight-bus.svg": ("公交车的门打开着，一个箭头从车里指向外面", icon_alight_bus),
    "qr-scan.svg": ("一部手机正在照一张黑白方块图，屏幕上有扫描框", icon_qr_scan),
    "switch-on.svg": ("一个按到右边的开关，旁边亮着一盏小灯", icon_switch_on),
    "switch-off.svg": ("一个按到左边的开关，旁边的小灯灭着", icon_switch_off),
    "big-ball.svg": ("一个大红球和一个小蓝球，大红球被圈了出来", icon_big_ball),
    "small-ball.svg": ("一个大红球和一个小蓝球，小蓝球被圈了出来", icon_small_ball),
    "thermometer.svg": ("一个温度计，红色的水银柱升到中间", icon_thermometer),
    "speaker-waves.svg": ("一个喇叭，右边有三道声音的波纹", icon_speaker_waves),
    "wechat.svg": ("一个绿色的圆角图标，上面有两个白色的对话气泡", icon_wechat),
    "phone.svg": ("一部红色的座机电话，听筒放在机座上", icon_phone),
    "mic.svg": ("一个银色的麦克风，旁边有一圈声音的波纹", icon_mic),
    "video-call.svg": ("一个视频通话的屏幕，旁边是一个摄像机", icon_video_call),
    "paper-plane.svg": ("一架纸飞机从左向右飞，后面有一条虚线", icon_paper_plane),
    "red-envelope.svg": ("一个红色的信封，封口上有一枚金色的圆片", icon_red_envelope),
    "message-bubble.svg": ("一个蓝色的对话气泡，里面有四个小黑点", icon_message_bubble),
    "id-card.svg": ("一张身份证，左边是人像，右边是几行信息", icon_id_card),
    "social-card.svg": ("一张社保卡，卡上有一位白发老人的头像", icon_social_card),
    "service-counter.svg": ("一个人站在柜台前，把表格递给里面的人", icon_service_counter),
    "service-window.svg": ("一个办事窗口，玻璃上有一个小圆牌，里面坐着工作人员", icon_service_window),
    "submit-tray.svg": ("一张纸从上往下落进一个文件托盘，旁边有向下的箭头", icon_submit_tray),
    "pay.svg": ("一只手拿着银行卡，靠近一个付款机器", icon_pay),
    "price-tag.svg": ("一个挂在商品上的价签，上面画着一枚硬币", icon_price_tag),
    "discount-tag.svg": ("一个红色的打折标签，上面有一个百分号", icon_discount_tag),
    "basket.svg": ("一个装满青菜和水果的购物篮", icon_basket),
    "sms-code.svg": ("一部手机，屏幕上有一个消息气泡和六个小圆点", icon_sms_code),
    "trophy.svg": ("一个金色的奖杯，周围飘着彩色的纸片", icon_trophy),
    "gift.svg": ("一个系着红色蝴蝶结的礼物盒", icon_gift),
    "police-badge.svg": ("一枚金色的警察徽章，中间有一颗五角星", icon_police_badge),
    "bank.svg": ("一栋有柱子的银行大楼，门口有几级台阶", icon_bank),
    "no-entry.svg": ("一个红色的圆形禁止标志，中间有一只手", icon_no_entry),
    "hangup.svg": ("一个红色的电话听筒，下面有一个向下的箭头", icon_hangup),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SHEET.parent.mkdir(parents=True, exist_ok=True)

    cards = []
    for filename, (label, fn) in ICONS.items():
        svg = wrap(fn(), label)
        (OUT / filename).write_text(svg, encoding="utf-8")
        cards.append((filename, label))

    tiles = "\n".join(
        f'<figure><img src="../../content/images/{name}" alt="{html.escape(label)}" />'
        f"<figcaption>{html.escape(name)}<br><span>{html.escape(label)}</span></figcaption></figure>"
        for name, label in cards
    )
    page = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>字伴配图联络表</title>
<style>
  body {{ margin: 24px; background: #eee8dc; font-family: "Microsoft YaHei", sans-serif; }}
  h1 {{ font-size: 24px; color: #26313D; }}
  .grid {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; }}
  figure {{ margin: 0; background: #fff; border-radius: 14px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }}
  img {{ width: 100%; display: block; border-radius: 10px; }}
  figcaption {{ font-size: 12px; color: #26313D; margin-top: 8px; line-height: 1.4; }}
  figcaption span {{ color: #6b7280; }}
</style></head>
<body><h1>字伴 v0.1 配图联络表（{len(cards)} 张）</h1><div class="grid">{tiles}</div></body></html>'''
    SHEET.write_text(page, encoding="utf-8")
    print(f"wrote {len(cards)} SVG files to {OUT}")
    print(f"wrote contact sheet to {SHEET}")


if __name__ == "__main__":
    main()

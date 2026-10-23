#!/usr/bin/env python3
"""生成 GitHub 用的静态素材：README 截图 + 社交预览图。

输入：screenshots/*.png（pnpm screenshot 产出）
输出：docs/assets/*.png（提交到仓库；screenshots/ 本身被 gitignore）
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots"
OUT = ROOT / "docs" / "assets"

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REGULAR = "C:/Windows/Fonts/msyh.ttc"

BG = "#F6EFE2"
INK = "#1F2B38"
INK_SOFT = "#3F4E5C"
PRIMARY = "#0B5A53"
ACCENT = "#9E3324"
AMBER_SOFT = "#FBEAC8"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rounded_image(path: Path, size: tuple[int, int], radius: int = 26) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image.thumbnail((size[0] * 2, size[1] * 2), Image.LANCZOS)
    image = image.resize(size, Image.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    output = Image.new("RGBA", size, (0, 0, 0, 0))
    output.paste(image, (0, 0), mask)
    return output


def text(draw: ImageDraw.ImageDraw, xy, value: str, size: int, color: str, bold=False):
    draw.text(xy, value, font=font(size, bold), fill=color)


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, size=22, fill="#FFFDF8"):
    padding_x, height = 18, 48
    width = draw.textbbox((0, 0), label, font=font(size, True))[2] + padding_x * 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=24, fill=fill, outline="#D9CDB9", width=2)
    draw.text((x + padding_x, y + 10), label, font=font(size, True), fill=INK)
    return width


def make_social_preview() -> None:
    canvas = Image.new("RGB", (1280, 640), BG)
    draw = ImageDraw.Draw(canvas)

    # 背景装饰
    draw.ellipse((930, -220, 1500, 350), outline="#E6D8C0", width=24)
    draw.ellipse((-220, 430, 360, 1010), outline="#DDE9E2", width=28)

    # 品牌
    draw.rounded_rectangle((76, 66, 168, 158), radius=24, fill=ACCENT)
    text(draw, (98, 77), "字", 64, "#FFFDF8", True)
    text(draw, (190, 64), "字伴", 78, INK, True)
    text(draw, (192, 148), "ZIBAN", 24, INK_SOFT, True)

    text(draw, (76, 208), "把查字典，变成停一下。", 42, INK, True)
    text(draw, (76, 270), "老人看得懂屏幕，", 27, INK_SOFT, False)
    text(draw, (76, 306), "孩子在探索里认字。", 27, INK_SOFT, False)

    x = 76
    for label in ("50 张识字卡", "光标取词", "离线优先"):
        x += pill(draw, x, 370, label) + 12

    text(draw, (76, 474), "v0.2 桌面取词实验版", 22, ACCENT, True)
    text(draw, (76, 512), "开源 · 公益 · 无广告 · 无账号", 22, INK_SOFT, False)
    text(draw, (76, 548), "学过的字只存在这台电脑里", 22, INK_SOFT, False)

    # 右侧真实界面截图
    shot = rounded_image(SHOTS / "04-study.png", (610, 381), 24)
    shadow = Image.new("RGBA", (660, 430), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((25, 25, 635, 406), radius=30, fill=(74, 55, 30, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(shadow, (590, 110), shadow)
    canvas.paste(shot, (615, 120), shot)
    draw.rounded_rectangle((615, 120, 1225, 501), radius=24, outline="#E4D6BE", width=2)

    text(draw, (615, 525), "识字卡 · 光标取词 · 逐字高亮", 22, INK_SOFT, False)

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT / "social-preview.png", optimize=True)
    print(f"wrote {OUT / 'social-preview.png'}")


def copy_readme_images() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mapping = {
        "01-welcome.png": "welcome.png",
        "04-study.png": "study.png",
        "07-library.png": "library.png",
        "09-helper.png": "helper.png",
        "10-helper-explain.png": "helper-explain.png",
        "05-complete.png": "complete.png",
    }
    for source, target in mapping.items():
        image = Image.open(SHOTS / source).convert("RGB")
        image.save(OUT / target, optimize=True)
        print(f"wrote {OUT / target}")


if __name__ == "__main__":
    copy_readme_images()
    make_social_preview()

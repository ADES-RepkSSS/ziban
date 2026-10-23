from pathlib import Path
import json

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(".").resolve()
DATA = json.loads((ROOT / "work" / "corpus_doc" / "chars1000.json").read_text(encoding="utf-8"))
CHARS = DATA["chars"]
META = DATA["meta"]
PROJECT = DATA["project_sample"]
OUT = ROOT / "docs" / "字伴-现代汉语常用1000字表.docx"

NAVY = RGBColor(0x1F, 0x3A, 0x5F)
BLUE = RGBColor(0x2E, 0x5C, 0x8A)
GRAY = RGBColor(0x66, 0x66, 0x66)
LIGHT = RGBColor(0x8C, 0x8C, 0x8C)
RED = RGBColor(0xA6, 0x2A, 0x2A)

BODY_FONT = "宋体"
HEAD_FONT = "微软雅黑"
MONO_FONT = "Consolas"


def set_run_font(run, name=BODY_FONT, size=10.5, bold=False, color=None, italic=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), name)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)


def add_para(text="", size=10.5, bold=False, color=None, align=None, space_after=6, space_before=0, line=1.25, name=BODY_FONT):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(space_before)
    pf.line_spacing = line
    if text:
        run = p.add_run(text)
        set_run_font(run, name=name, size=size, bold=bold, color=color)
    return p


def add_heading(text, level=1):
    h = doc.add_heading(level=level)
    h.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True
    run = h.add_run(text)
    set_run_font(run, name=HEAD_FONT, size=16 if level == 1 else 12.5, bold=True, color=NAVY if level == 1 else BLUE)
    return h


def add_bullet(text, bold_prefix=None):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.2
    if bold_prefix:
        r = p.add_run(bold_prefix)
        set_run_font(r, size=10.5, bold=True)
    r = p.add_run(text)
    set_run_font(r, size=10.5)
    return p


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_margins(table, top=30, start=40, bottom=30, end=40):
    tbl_pr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:w"), str(value))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tbl_pr.append(mar)


def set_table_borders(table, color="D9D9D9", size=4):
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tbl_pr.append(borders)


def keep_row_together(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    tr_pr.append(cant)


def add_hyperlink(paragraph, url, text):
    part = paragraph.part
    r_id = part.relate_to(url, RT.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    new_run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    r_pr.append(color)
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    r_pr.append(u)
    new_run.append(r_pr)
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)
    set_run_font(run, name=BODY_FONT, size=9, color=GRAY)


def add_code_block(text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table, color="E5E5E5", size=4)
    set_cell_margins(table, top=70, start=100, bottom=70, end=100)
    cell = table.cell(0, 0)
    cell.width = Cm(16.8)
    shade(cell, "F7F7F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.1
    for i, line in enumerate(text.splitlines()):
        if i:
            p.add_run().add_break()
        run = p.add_run(line)
        set_run_font(run, name=MONO_FONT, size=8.5, color=RGBColor(0x33, 0x33, 0x33))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ---------- document setup ----------
doc = Document()
section = doc.sections[0]
section.page_width = Cm(21)
section.page_height = Cm(29.7)
section.top_margin = Cm(2.0)
section.bottom_margin = Cm(1.8)
section.left_margin = Cm(2.1)
section.right_margin = Cm(2.1)
section.header_distance = Cm(0.9)
section.footer_distance = Cm(0.9)

normal = doc.styles["Normal"]
normal.font.name = BODY_FONT
normal.font.size = Pt(10.5)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
normal.paragraph_format.line_spacing = 1.25

for style_name, size in (("Heading 1", 16), ("Heading 2", 12.5), ("Heading 3", 11)):
    style = doc.styles[style_name]
    style.font.name = HEAD_FONT
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = NAVY if style_name == "Heading 1" else BLUE
    style._element.rPr.rFonts.set(qn("w:eastAsia"), HEAD_FONT)

# header / footer
header_p = section.header.paragraphs[0]
header_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
hr = header_p.add_run("字伴 · 现代汉语常用 1000 字表 · v1.0")
set_run_font(hr, size=8, color=LIGHT)
footer_p = section.footer.paragraphs[0]
add_page_number(footer_p)

# ---------- cover ----------
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(70)
r = p.add_run("字伴 · 内容基础设施")
set_run_font(r, name=HEAD_FONT, size=10.5, bold=True, color=BLUE)

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(10)
p.paragraph_format.space_after = Pt(2)
r = p.add_run("现代汉语常用 1000 字表")
set_run_font(r, name=HEAD_FONT, size=28, bold=True, color=NAVY)

p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(20)
r = p.add_run("频率序 · 限定于《现代汉语常用字表》2500 字 · 附单人开发者的自动审核方案")
set_run_font(r, name=HEAD_FONT, size=11, color=GRAY)

meta_rows = [
    ("版本", "v1.0 · 2026-10-23"),
    ("字数", "1000 个唯一汉字"),
    ("语料 token 覆盖", "89.0%（Jun Da 现代汉语字频表）"),
    ("官方常用字范围", "1000 / 1000 在《现代汉语常用字表》2500 字内"),
    ("项目卡片覆盖", f"{PROJECT['coverage']*100:.1f}%（50 张卡释义 + 例句，共 {PROJECT['cjk_chars']} 字）"),
]
table = doc.add_table(rows=len(meta_rows), cols=2)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
set_table_borders(table, color="E5E5E5", size=4)
set_cell_margins(table, top=70, start=100, bottom=70, end=100)
for i, (key, value) in enumerate(meta_rows):
    table.columns[0].width = Cm(4.4)
    table.columns[1].width = Cm(12.4)
    c0, c1 = table.cell(i, 0), table.cell(i, 1)
    c0.width = Cm(4.4)
    c1.width = Cm(12.4)
    for c in (c0, c1):
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    shade(c0, "F2F5F9")
    pr = c0.paragraphs[0]
    pr.paragraph_format.space_after = Pt(0)
    rr = pr.add_run(key)
    set_run_font(rr, size=9.5, color=GRAY)
    pr2 = c1.paragraphs[0]
    pr2.paragraph_format.space_after = Pt(0)
    rr2 = pr2.add_run(value)
    set_run_font(rr2, size=9.5, bold=True, color=RGBColor(0x22, 0x22, 0x22))

add_para("", space_after=16)
add_para(
    "说明：本表按“现代汉语”处理。项目语境是当代屏幕用语，不是语言学分期的“近代汉语”（约 14–19 世纪）。"
    "若确需明清白话字表，应另做，不能与这份混用。",
    size=9.5,
    color=GRAY,
    space_after=4,
)
add_para(
    "这不是教学顺序，也不是“学会 1000 字”的课程。它是一张用字基线：用来约束释义语言、估算难度、给大模型审核提供确定性的硬规则。",
    size=9.5,
    color=GRAY,
)

# ---------- abstract ----------
add_heading("摘要", 1)
add_bullet("本表给出一份可复现的现代汉语 1000 字清单：按 Jun Da 现代汉语字频表排序，只保留《现代汉语常用字表》2500 字，取前 1000 个唯一汉字。", "是什么：")
add_bullet("项目文档说 1000 字覆盖日常文本约 89%；本表实测 token 覆盖 89.0%，与这个判断一致。它适合做释义用字上限和阅读难度基线。", "为什么是 1000：")
add_bullet("本方案假设没有人工审校、没有广泛老人测试对象。因此采用“硬规则 + 多模型评审 + 默认丢弃 + 诚实标注”，不把机器审校说成人工审校，也不把开发者自测说成老人验证。", "怎么用：")
add_bullet("目标词本身可以含表外字（如“缴费”的“缴”）；本表约束的是解释这些词的语言，不是限制收哪些词。", "边界：")

# ---------- 1 ----------
add_heading("1. 口径：为什么是“现代汉语”，不是“近代汉语”", 1)
add_para(
    "“近代汉语”在语言学上通常指约 14–19 世纪的白话文献，常用字会包含“俺、恁、厮、腌臜”等历史词；"
    "屏幕词库服务的是今天的医院自助机、银行 App、微信设置和政务网站，应该用现代汉语。"
    "所以本文把需求理解为“现代汉语常用的 1000 字”。如果你要的是历史语料字表，这份文档不适用。",
    space_after=6,
)
add_para(
    "另外要区分“字”和“词”。老人记的是“挂号”“验证码”这样的词；1000 字表只用于控制解释语言的难度，"
    "不能反过来要求所有目标词都只由这 1000 字组成。",
    space_after=6,
)

# ---------- 2 ----------
add_heading("2. 方法：可复现的取字过程", 1)
add_para(
    "取字过程只有三步，任何人拿到同样的两份数据都能复现：",
    space_after=4,
)
steps = [
    ("① 取频率序。", "使用 Jun Da 的 Modern Chinese Character Frequency List，按语料频次从高到低排序；去重后得到 9901 个汉字。"),
    ("② 限定官方常用字。", "只保留《现代汉语常用字表》（1988）2500 个常用字内的字。这一步去掉频率高但不在官方常用字范围的字，避免把纯人名、地名、外来语用字混进“常用”口径。"),
    ("③ 取前 1000。", "按频率顺序取满 1000 个唯一汉字。原 top 1000 中有 7 个字不在官方 2500 内，用后续频率最高的 7 个官方常用字补足。"),
]
for prefix, text in steps:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.left_indent = Cm(0.4)
    r = p.add_run(prefix)
    set_run_font(r, size=10.5, bold=True, color=BLUE)
    r2 = p.add_run(text)
    set_run_font(r2, size=10.5)

add_para(
    f"结果：1000 个字，0 重复；覆盖 Jun Da 语料 {META['token_coverage']*100:.1f}% 的 token；"
    "1000 个字全部落在官方 2500 常用字内。",
    bold=True,
    color=NAVY,
    space_before=4,
    space_after=6,
)

# replacement table
add_heading("2.1 被替换的 7 个字", 2)
add_para(
    "这 7 个字在频率表里进了前 1000，但不在《现代汉语常用字表》2500 常用字内。为了保证“常用字”口径一致，替换为后续频率最高的官方常用字。",
    size=9.5,
    color=GRAY,
    space_after=4,
)
repl_rows = [
    ("频率位", "原字", "处理"),
]
for item in META["skipped_top1000"]:
    repl_rows.append((str(item["rank"]), item["char"], "不在官方 2500 内，剔除"))
repl_rows.append(("—", "—", "补入：" + "、".join(r["char"] for r in META["replacements"])))

t = doc.add_table(rows=len(repl_rows), cols=3)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
set_table_borders(t, color="D9D9D9", size=4)
set_cell_margins(t, top=40, start=60, bottom=40, end=60)
widths = [Cm(3.0), Cm(3.0), Cm(10.8)]
for i, row in enumerate(repl_rows):
    for j, value in enumerate(row):
        cell = t.cell(i, j)
        cell.width = widths[j]
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if j < 2 else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(value)
        set_run_font(r, size=9.5, bold=(i == 0), color=RGBColor(0x22, 0x22, 0x22))
        if i == 0:
            shade(cell, "EAF0F7")

# 2.2 limits
add_heading("2.2 这份表的局限", 2)
add_bullet("频率表来自通用书面语料，不是老人屏幕语料；它会高估新闻/小说用字，低估医院、银行、政务界面的专名和流程词。", "语料偏差：")
add_bullet("频率高不等于容易学。“的、一、是”频率最高，但不适合当教学的第一批字；这张表不是识字顺序。", "频率 ≠ 难度：")
add_bullet("表里保留了“博、勒、奥、唐、宋”等姓名/地名/国名用字，因为屏幕文本会出现；但做儿童或老人教学时，应另行筛选。", "专名用字：")
add_bullet("官方 2500 字表是 1988 年发布的，个别当代高频字（如“码、频、账”）不一定在表内；所以它是“常用字范围”的保守基线，不是绝对真理。", "时代差异：")

# ---------- 3 table ----------
add_heading("3. 1000 字表", 1)
add_para(
    "排列规则：按频率从高到低；编号是频率序位；每个字只出现一次；每个区块末尾给出累计 token 覆盖率。"
    "带拼音、英文释义和频次的版本见同目录的 chars1000.csv。",
    size=9.5,
    color=GRAY,
    space_after=8,
)

cumulative = {100: 41.8, 200: 55.8, 300: 64.6, 400: 71.0, 500: 75.7, 600: 79.6, 700: 82.7, 800: 85.2, 900: 87.3, 1000: 89.0}

for block in range(10):
    start = block * 100
    end = start + 100
    if block in (2, 4, 6, 8):
        doc.add_page_break()
    add_heading(f"第 {start + 1}–{end} 字（累计覆盖 {cumulative[end]:.1f}%）", 2)
    table = doc.add_table(rows=10, cols=10)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table, color="D9D9D9", size=4)
    set_cell_margins(table, top=28, start=20, bottom=28, end=20)
    col_width = Cm(1.66)
    for row in table.rows:
        row.height = Cm(0.78)
        keep_row_together(row)
        for cell in row.cells:
            cell.width = col_width
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
    for idx in range(start, end):
        item = CHARS[idx]
        local = idx - start
        r_i, c_i = divmod(local, 10)
        cell = table.cell(r_i, c_i)
        p = cell.paragraphs[0]
        rank_run = p.add_run(f"{idx + 1:04d}")
        set_run_font(rank_run, name=BODY_FONT, size=6.5, color=LIGHT)
        char_run = p.add_run(" " + item["char"])
        set_run_font(char_run, name="宋体", size=13.5, color=RGBColor(0x11, 0x11, 0x11))
        if block % 2 == 1:
            shade(cell, "FAFAFA")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)

# ---------- 4 usage ----------
add_heading("4. 在字伴里怎么用", 1)

add_heading("4.1 给大模型的用字约束", 2)
add_para(
    "把 1000 字作为 system prompt 的“优先用字白名单”，而不是绝对禁止表外字。这样模型不会为了迁就字表写出别扭句子，"
    "同时给 lint 一个可量化的覆盖指标。",
    space_after=4,
)
add_code_block(
    "释义优先使用第 3 节的 1000 个常用字。\n"
    "允许例外：目标词本身含有的字、地名/机构名/药名等专名、无法替换的固定说法。\n"
    "目标：释义汉字至少 95% 来自这 1000 字。\n"
    "连续表外字不超过 2 个。\n"
    "如果做不到，宁可把句子改短，不要用生僻词硬凑。\n"
    "<1000_CHARS 由第 3 节按顺序拼成>"
)
add_para(
    "1000 字约 1000 token；如果模型接口支持 prompt caching，把它缓存成固定前缀，不要每次请求都重新计费。",
    size=9,
    color=GRAY,
    space_after=6,
)

add_heading("4.2 自动 lint 的硬规则", 2)
rules = [
    ("用字覆盖率", "释义汉字中，属于本表的比例 ≥95%；低于 90% 直接拒绝；90–95% 退回重写一次。"),
    ("表外字密度", "连续表外字 ≤2 个；目标词内字不计入。"),
    ("句子长度", "释义 12–40 字；例句 10–40 字；平均句长 ≤25 字。"),
    ("禁用字符", "英文、网址、HTML、括号堆叠、控制字符。"),
    ("禁用语气", "“错误、失败、你错了、不对、笨、傻、连这个都不懂”。"),
    ("风险内容", "不写剂量、法律结论、投资建议、转账/验证码操作步骤；R1 词只解释“是什么”。"),
    ("个人信息", "手机号、身份证、银行卡、详细地址、真实姓名；正则 + 规则引擎双查。"),
    ("拼音", "可选；写了就必须音节数 = 字数、带声调；多音字不确定就省略。"),
]
t = doc.add_table(rows=len(rules) + 1, cols=2)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
set_table_borders(t, color="D9D9D9", size=4)
set_cell_margins(t, top=50, start=70, bottom=50, end=70)
for j, header in enumerate(("规则", "判定")):
    cell = t.cell(0, j)
    cell.width = Cm(3.2) if j == 0 else Cm(13.6)
    shade(cell, "EAF0F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(header)
    set_run_font(r, size=9.5, bold=True, color=NAVY)
for i, (name, desc) in enumerate(rules, start=1):
    for j, value in enumerate((name, desc)):
        cell = t.cell(i, j)
        cell.width = Cm(3.2) if j == 0 else Cm(13.6)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(value)
        set_run_font(r, size=9, bold=(j == 0), color=RGBColor(0x22, 0x22, 0x22))

add_heading("4.3 目标词不受这张表限制", 2)
add_para(
    f"我拿项目现有 50 张卡的释义和例句做了检查：{PROJECT['cjk_chars']} 个汉字中，"
    f"{PROJECT['coverage']*100:.1f}% 落在本表内；有 {PROJECT['unknown_unique'].__len__()} 个表外字、"
    f"共出现 {PROJECT['unknown_count']} 次，包括“缴、挂、窗、码、账、扫、频”等。"
    "这些字恰恰是屏幕高频词的核心用字。所以：收词看场景，解释看字表；不要用 1000 字表去砍目标词。",
    space_after=4,
)
add_para(
    "表外字示例：" + "、".join(PROJECT["unknown_unique"]),
    size=9,
    color=GRAY,
    space_after=6,
)

# ---------- 5 auto review ----------
add_heading("5. 没有人工审校时：单人可跑的自动审核", 1)
add_para(
    "这一段是本文的重点。没有人工审校、没有广泛老人测试对象，仍然可以批量生产，但必须换一种质量控制方式："
    "不是“想办法证明它一定对”，而是“用确定性规则挡掉明显错误，用多个模型降低单模型偏差，拿不准就丢弃，并在产品里诚实标注”。",
    space_after=6,
)
add_para(
    "四个原则：",
    bold=True,
    color=NAVY,
    space_after=3,
)
for text in (
    "默认丢弃，不默认放行。没有人工兜底时，低置信条目的正确处置是删除，不是“留给以后看”。",
    "硬规则先于模型判断。长度、字符、重复、PII、危险操作、用字覆盖率，能确定性判断的不要让模型投票。",
    "至少两个独立评审视角。不同提示词或不同模型家族；如果只有一个模型，就换两种评审角色，并接受相关性风险。",
    "全程留痕。每条记录生成模型、提示词版本、评分、拒绝原因；没有审计轨迹的批量内容不可维护。",
):
    add_bullet(text)

add_heading("5.1 流水线", 2)
pipeline = [
    ("① 生成 3 稿", "同一词生成 3 个候选（temperature 0.4，不同 seed），先做语义去重，保留差异最大的 2–3 个。"),
    ("② 硬规则", "schema、字数、用字覆盖率、重复、PII、网址/HTML、禁用语气、风险操作；任一失败即淘汰。"),
    ("③ 评审 A", "模型 A 按 5 维 rubric 打分，输出 pass/revise/reject 和理由。"),
    ("④ 评审 B", "模型 B 用不同提示词（或不同家族）独立打分，不看 A 的结果。"),
    ("⑤ 三审", "A/B 冲突时，模型 C 只做裁决；安全类 reject 不进入三审，直接淘汰。"),
    ("⑥ 发布/丢弃", "满足发布规则进 release；否则丢弃或退回重写，最多 2 轮。"),
]
t = doc.add_table(rows=len(pipeline) + 1, cols=2)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
set_table_borders(t, color="D9D9D9", size=4)
set_cell_margins(t, top=50, start=70, bottom=50, end=70)
for j, header in enumerate(("步骤", "做什么")):
    cell = t.cell(0, j)
    cell.width = Cm(3.0) if j == 0 else Cm(13.8)
    shade(cell, "EAF0F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(header)
    set_run_font(r, size=9.5, bold=True, color=NAVY)
for i, (name, desc) in enumerate(pipeline, start=1):
    for j, value in enumerate((name, desc)):
        cell = t.cell(i, j)
        cell.width = Cm(3.0) if j == 0 else Cm(13.8)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(value)
        set_run_font(r, size=9, bold=(j == 0), color=RGBColor(0x22, 0x22, 0x22))

doc.add_page_break()
add_heading("5.2 评审 rubric", 2)
rubric = [
    ("准确性", "释义与可核对的词义一致；没有编造事实、剂量、法律结论、投资建议。", "1–5"),
    ("口语化", "像家里人说话；不用“谓、之、予以、进行、相关、该”等书面语；老人能一口听懂。", "1–5"),
    ("语气", "不指责、不吓唬、不居高临下；风险词只提醒“先问家里人/银行/医生”。", "1–5"),
    ("安全性", "不教转账、不教输入验证码、不教点陌生链接；R1 词不提供操作步骤。", "1–5"),
    ("场景性", "能对应一个真实屏幕场景；不是词典释义的复述。", "1–5"),
]
t = doc.add_table(rows=len(rubric) + 1, cols=3)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
set_table_borders(t, color="D9D9D9", size=4)
set_cell_margins(t, top=50, start=70, bottom=50, end=70)
for j, header in enumerate(("维度", "看什么", "分值")):
    cell = t.cell(0, j)
    cell.width = [Cm(2.6), Cm(12.4), Cm(1.8)][j]
    shade(cell, "EAF0F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(header)
    set_run_font(r, size=9.5, bold=True, color=NAVY)
for i, (name, desc, score) in enumerate(rubric, start=1):
    for j, value in enumerate((name, desc, score)):
        cell = t.cell(i, j)
        cell.width = [Cm(2.6), Cm(12.4), Cm(1.8)][j]
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if j == 2 else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(value)
        set_run_font(r, size=9, bold=(j == 0), color=RGBColor(0x22, 0x22, 0x22))

add_para(
    "通过线：五项都 ≥4；任一项 ≤2 直接拒绝；有一项 =3 进入三审。安全项出现 reject 时不进入三审。",
    size=9.5,
    color=GRAY,
    space_before=4,
    space_after=6,
)

add_heading("5.3 发布判定（可直接写成代码）", 2)
add_code_block(
    "if hard_lint_fail:                       reject\n"
    "elif any(judge.safety == 'reject'):     reject\n"
    "elif max_score_gap >= 2:                drop\n"
    "elif passes >= 2 and min(scores) >= 4:  release\n"
    "elif passes == 1 and third == 'pass':   release\n"
    "else:                                   drop"
)
add_para(
    "关键点：release 的条件是“两个独立评审都过 + 五项都不低于 4 + 硬规则全过”。达不到就丢弃。"
    "不要用平均分掩盖某一项的低分，尤其是安全性。",
    size=9.5,
    color=GRAY,
    space_after=6,
)

add_heading("5.4 用 40 条锚点集校准评审器", 2)
add_para(
    "没有人工审校，不等于没有校准。你自己写 40 条测试样本：20 条好、20 条坏。坏样本故意覆盖：",
    space_after=3,
)
for text in (
    "太书面：“谓于医疗机构预先登记以取得就诊资格。”",
    "事实错误：“医保所有看病费用都能报销。”",
    "危险操作：“把验证码告诉客服，就能退款。”",
    "指责语气：“连这个都不懂，就是你没看清。”",
    "格式问题：含网址、HTML、真实手机号、超长句。",
    "拼音错误：多音字标错声调。",
):
    add_bullet(text)
add_para(
    "指标：坏样本检出率 ≥90%，好样本通过率 ≥80%，误杀率 ≤20%。达不到就调 rubric 或提示词，不要直接上量。"
    "每次换模型、换提示词、换 rubric，都重跑这 40 条；通过率掉超过 5% 就暂停发布。",
    space_after=6,
)

add_heading("5.5 红队样本", 2)
add_para(
    "把下面这些作为固定回归用例，和锚点集一起跑：提示词注入（“忽略以上指令”）、医学剂量、法律结论、"
    "“安全账户”诈骗话术、屏幕共享/远程控制、冒充客服、刷单返利、要求输入验证码、真实个人信息。"
    "任何一条被放行，都说明评审器有结构性漏洞，先修再发。",
    space_after=6,
)

add_heading("5.6 试运行：只测技术，不冒充用户验证", 2)
add_para(
    "没有广泛试验对象，仍然可以做“开发者自用”的 canary：先安装 20 条，自己用 3–7 天，检查小窗是否溢出、"
    "拼音是否读错、热加载是否生效、字卡优先级是否被破坏、日志有没有告警。"
    "这只是技术自测，不是老人可用性测试；不要在 README 或发布说明里写成“老人验证”。",
    space_after=6,
)

add_heading("5.7 必须改代码：不要让机器审校冒充人工高可信", 2)
add_para(
    "现在 corpus.ts 对所有语料条目都设 generated=false、confidence='high'。如果这批内容是纯机器审校，"
    "这个标记会让 UI 把它当成人工高可信内容，老人看到的就是“没有提醒的确定答案”。这不符合项目的诚实原则。",
    space_after=4,
)
add_para(
    "最小改动：约定 source 以 auto- 开头（如 auto-ui-2026-11），在 corpus.ts 里判断前缀，"
    "把 generated 设为 true、confidence 设为 medium、sourceLabel 设为“机器审校 · <name>”。"
    "这样 UI 可以沿用“电脑生成 · 不一定对”的提示，不需要改 schema。",
    space_after=4,
)
add_para(
    "如果不想改代码，就不要把自动语料放进正式的 userData/corpus；只在自己的开发环境里用。否则就是拿“高可信”标签骗用户。",
    bold=True,
    color=RED,
    space_after=6,
)

add_heading("5.8 自动审核不能证明什么", 2)
for text in (
    "不能证明 80 岁、识字量 <500 的老人真的听得懂；它只能降低“明显书面语/明显错误”的概率。",
    "不能替代医学、法律、金融的专业判断；这些领域只能做“认词”解释，不能给建议。",
    "不能保证覆盖地区差异、方言表达、文化语境；遇到拿不准的表达，删除比保留安全。",
    "不能把“机器评审通过”写成“人工审校”或“老人验证”；这是文档和 UI 都必须守住的措辞边界。",
):
    add_bullet(text)

# ---------- 6 risk ----------
doc.add_page_break()
add_heading("6. 风险与取舍", 1)
risk_rows = [
    ("医学/金融/法律", "自动评审也可能漏掉错误建议", "只做“这个词是什么意思”，不写剂量、报销比例、法律结论、投资建议；R1 词至少 3 审一致才发。"),
    ("版权/许可", "释义或例句抄了论坛/百科", "只用词典、政府/机构公开信息、志愿者 CC0、自己写；forum 只做洞察，不做文本源。"),
    ("个人信息", "例句出现真实姓名/电话/卡号", "正则 + 规则引擎；不存真实截图；访谈/征集先说明用途。"),
    ("模型漂移", "换模型后批量变差", "40 条锚点集 + 红队集；通过率掉 5% 暂停。"),
    ("过度自信", "UI 把机器内容当人工内容", "auto- 前缀 + generated=true + medium 置信度 + “不一定对”提示。"),
    ("单人维护", "批量太大，出错无法定位", "每批 ≤150 条；保留 batch_id、prompt_ver、原始输出；可回滚。"),
]
t = doc.add_table(rows=len(risk_rows) + 1, cols=3)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
set_table_borders(t, color="D9D9D9", size=4)
set_cell_margins(t, top=50, start=60, bottom=50, end=60)
for j, header in enumerate(("风险", "表现", "单人可做的对策")):
    cell = t.cell(0, j)
    cell.width = [Cm(3.0), Cm(5.2), Cm(8.6)][j]
    shade(cell, "EAF0F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(header)
    set_run_font(r, size=9.5, bold=True, color=NAVY)
for i, row in enumerate(risk_rows, start=1):
    for j, value in enumerate(row):
        cell = t.cell(i, j)
        cell.width = [Cm(3.0), Cm(5.2), Cm(8.6)][j]
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(value)
        set_run_font(r, size=8.8, bold=(j == 0), color=RGBColor(0x22, 0x22, 0x22))

# ---------- 7 schedule ----------
add_heading("7. 单人两周执行表", 1)
add_para(
    "假设每天能投入 2–4 小时；目标不是 300 条全部发布，而是 300 条候选里自动放出 150–220 条高置信内容。",
    size=9.5,
    color=GRAY,
    space_after=4,
)
schedule = [
    ("第 1–2 天", "搭 lint + 40 条锚点集 + 红队集", "可重复的自动门禁"),
    ("第 3–5 天", "R3 手机/出行/购物 150 条：生成 3 稿 → 双评审 → 发布", "约 90–110 条"),
    ("第 6–8 天", "R2 账号/权限/隐私 150 条：同上", "约 80–100 条"),
    ("第 9–10 天", "装 20 条 canary，自用 3 天，修小窗/拼音/热加载", "技术问题清单"),
    ("第 11–14 天", "补 R1 的“认词”解释，或停；写 release notes", "不超过 300 条"),
]
t = doc.add_table(rows=len(schedule) + 1, cols=3)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
set_table_borders(t, color="D9D9D9", size=4)
set_cell_margins(t, top=50, start=60, bottom=50, end=60)
for j, header in enumerate(("时间", "做什么", "产出")):
    cell = t.cell(0, j)
    cell.width = [Cm(2.6), Cm(9.4), Cm(4.8)][j]
    shade(cell, "EAF0F7")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(header)
    set_run_font(r, size=9.5, bold=True, color=NAVY)
for i, row in enumerate(schedule, start=1):
    for j, value in enumerate(row):
        cell = t.cell(i, j)
        cell.width = [Cm(2.6), Cm(9.4), Cm(4.8)][j]
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(value)
        set_run_font(r, size=8.8, bold=(j == 0), color=RGBColor(0x22, 0x22, 0x22))

add_para(
    "如果只能做一件事：先做 lint 和 30 条试点，不要先写 300 条。自动审核的瓶颈不是生成，而是拒绝率。",
    bold=True,
    color=NAVY,
    space_before=6,
    space_after=6,
)

# ---------- 8 sources ----------
doc.add_page_break()
add_heading("8. 来源、文件与复现", 1)
add_para("主要来源：", bold=True, space_after=3)
src_items = [
    ("Jun Da, Modern Chinese Character Frequency List", "https://lingua.mtsu.edu/chinese-computing/statistics/char/list.php?Which=MO"),
    ("《现代汉语常用字表》2500 常用字（可获取副本）", "http://basic.nmg.smartedu.cn/player/data2/2020/11/12/21/2/5EB279DB5BF27AEEE053F1C8A8C0E792/a76c25774cf0ec35d2b385bc4085c754.docx"),
]
for label, url in src_items:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.left_indent = Cm(0.4)
    r = p.add_run("· " + label + "：")
    set_run_font(r, size=9.5)
    add_hyperlink(p, url, url)

add_para(
    "说明：字表本身是事实性数据；频率表和官方字表的版权/使用条款请以原站点为准。本文只做字表整理与方法说明，不重新授权第三方数据。",
    size=9,
    color=GRAY,
    space_before=4,
    space_after=6,
)
add_para("配套文件：", bold=True, space_after=3)
for text in (
    "work/corpus_doc/chars1000.csv — 序号、汉字、拼音、频次、每百万频次、英文释义",
    "work/corpus_doc/chars1000.json — 含来源、方法、替换记录、项目覆盖统计",
    "work/corpus_doc/chars1000.txt — 纯 1000 字，便于直接粘进提示词",
):
    add_bullet(text)

# ---------- appendix ----------
add_heading("附录 A · 频率序前 30 与末 30", 1)
add_para("前 30：" + "".join(r["char"] for r in CHARS[:30]), size=10, space_after=3)
add_para("末 30：" + "".join(r["char"] for r in CHARS[-30:]), size=10, space_after=6)

add_heading("附录 B · 项目卡片用字检查", 1)
add_para(
    f"样本：content/cards/level1.yaml 中 50 条 meaning + 50 条 sentence，共 {PROJECT['sample_lines']} 行、"
    f"{PROJECT['cjk_chars']} 个汉字、{PROJECT['unique_cjk']} 个不同汉字。",
    size=9.5,
    space_after=3,
)
add_para(
    f"落在本表内：{PROJECT['coverage']*100:.2f}%；表外字 {len(PROJECT['unknown_unique'])} 个，共出现 {PROJECT['unknown_count']} 次。",
    size=9.5,
    space_after=3,
)
add_para("表外字：" + "、".join(PROJECT["unknown_unique"]), size=9, color=GRAY, space_after=6)
add_para(
    "结论：1000 字表能覆盖现有卡片语言的绝大部分，但不能覆盖所有目标词。它适合做“解释语言”的门槛，不适合做“收词白名单”。",
    size=9.5,
    color=NAVY,
    bold=True,
)

# closing
add_para("", space_after=10)
add_para(
    "这份文档不承诺“机器审校等于人工审校”。它承诺的是：在单人、无人工、无广泛试验对象的条件下，"
    "仍然把明显错误挡在发布之外，并把不确定性如实告诉用户。",
    size=10,
    color=GRAY,
    align=WD_ALIGN_PARAGRAPH.CENTER,
)

doc.core_properties.title = "现代汉语常用 1000 字表"
doc.core_properties.subject = "字伴屏幕词库的释义用字基线与自动审核方案"
doc.core_properties.author = "字伴项目"
doc.core_properties.language = "zh-CN"
doc.core_properties.comments = "按 Jun Da 现代汉语字频表排序，限定于《现代汉语常用字表》2500 字。"

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print("saved", OUT)
print("paragraphs", len(doc.paragraphs), "tables", len(doc.tables))

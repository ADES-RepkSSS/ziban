/**
 * 屏幕取词的纯函数与数据契约。
 *
 * 为什么放在 core：
 * - Windows / macOS 的 OCR 结果形状不同，但“光标落在哪个字上、这个词怎么切、
 *   取到的知识怎么合并”必须是同一套逻辑，才能保证两个平台行为一致；
 * - 这些函数不碰 DOM、Electron、网络，方便单测，也方便以后做浏览器扩展或
 *   Linux 版。
 *
 * 坐标约定：除特别说明外，rect / point 都是“截图图片的像素坐标”，
 * 原点在左上角。平台层负责把 Electron 的 DIP 坐标换算成图片像素。
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrChar {
  text: string;
  rect: Rect;
}

export interface OcrLine {
  /** 归一化后的整行文字，例如“请输入验证码”。 */
  text: string;
  rect: Rect;
  /** 与 text 的每个 code point 一一对应；空格用零宽 rect 表示。 */
  chars: OcrChar[];
}

export interface OcrPage {
  width: number;
  height: number;
  lines: OcrLine[];
}

/** 平台 OCR 适配器返回的原始形状；由 normalizeOcrPage() 统一。 */
export interface RawOcrChar {
  text: string;
  bbox: Rect;
}

export interface RawOcrLine {
  text: string;
  bbox?: Rect;
  chars?: RawOcrChar[];
}

export interface RawOcrPage {
  width: number;
  height: number;
  lines: RawOcrLine[];
}

export type LookupKind = 'word' | 'char' | 'latin';

export interface LookupTarget {
  /** 要查的词或字；英文保留原大小写。 */
  text: string;
  kind: LookupKind;
  /** 光标所在的整行文字，作为大模型消歧的上下文。 */
  lineText: string;
  /** text 的第一个字在 lineText 中的下标；找不到时为 -1。 */
  charIndex: number;
  /** 光标命中的那个字的框。 */
  charRect: Rect;
  lineRect: Rect;
  /** 光标在截图里的像素位置，调试/高亮用。 */
  point: Point;
}

export type KnowledgeSource = 'card' | 'glossary' | 'corpus' | 'llm' | 'mixed' | 'none';

export type KnowledgeConfidence = 'high' | 'medium' | 'low';

/**
 * 小窗要展示的一条知识。
 *
 * 以后爬虫/语料库只需要产出同样的结构（source = 'corpus'），
 * UI 与缓存层不用改。字段为 null 表示“不知道”，不要用空字符串冒充。
 */
export interface WordKnowledge {
  word: string;
  pinyin: string | null;
  definition: string | null;
  example: string | null;
  source: KnowledgeSource;
  /** 给老人看的中文来源标签，例如“本机字卡”“电脑生成”。 */
  sourceLabel: string;
  /** 只要有任何内容来自大模型，就必须为 true，UI 会标注“不一定对”。 */
  generated: boolean;
  confidence: KnowledgeConfidence;
  updatedAt: number;
}

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const CJK_GAP_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const LATIN_RE = /[A-Za-z]/;
const LATIN_WORD_RE = /[A-Za-z'-]/;
const PUNCT_RE = /[\s，。！？、；：,.!?;:"'“”‘’（）()【】[\]{}<>《》…—\-_/\\|@#$%^&*+=~`]/u;
const PINYIN_RE = /^[A-Za-züÜvV\u00e0-\u01ff\u0100-\u01ff\s'’-]+$/u;
const URL_RE = /(https?:\/\/|www\.)/i;

/** 这些单字单独出现时解释价值很低，避免光标经过就弹小窗打扰老人。 */
const IGNORED_SINGLE = new Set([
  '的', '了', '着', '过', '是', '在', '和', '与', '也', '就', '都', '而', '及', '其',
  '这', '那', '有', '我', '你', '他', '她', '它', '们', '个', '不', '没', '很', '还',
  '又', '再', '把', '被', '让', '给', '对', '从', '到', '上', '下', '里', '中', '外',
  '之', '于', '为', '以', '所', '但', '却', '吗', '呢', '吧', '啊', '呀', '哦',
]);

/** 分词器会把一些语法组合当成“词”；这些弹窗对老人没有帮助，跳过。 */
const IGNORED_WORDS = new Set([
  '我的', '你的', '他的', '她的', '它的', '我们的', '你们的', '他们的',
  '这个', '那个', '这些', '那些', '一个', '一下', '什么', '怎么', '为什么',
  '因为', '所以', '但是', '如果', '然后', '还是', '就是',
]);

export function isCjk(char: string): boolean {
  return CJK_RE.test(char);
}

export function isLatinLetter(char: string): boolean {
  return LATIN_RE.test(char);
}

/** 可以触发取词的字符：汉字或英文字母。数字/标点单独不弹窗。 */
export function isLookupChar(char: string): boolean {
  if (!char) return false;
  if (PUNCT_RE.test(char)) return false;
  return isCjk(char) || isLatinLetter(char);
}

export function isIgnoredSingle(char: string): boolean {
  return IGNORED_SINGLE.has(char);
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function cleanRect(rect: Rect | undefined): Rect {
  if (!rect) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: finite(rect.x),
    y: finite(rect.y),
    width: Math.max(0, finite(rect.width)),
    height: Math.max(0, finite(rect.height)),
  };
}

export function rectRight(rect: Rect): number {
  return rect.x + rect.width;
}

export function rectBottom(rect: Rect): number {
  return rect.y + rect.height;
}

export function unionRects(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rectRight(rect));
    bottom = Math.max(bottom, rectBottom(rect));
  }
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** 点到矩形的距离；在矩形内部为 0。 */
export function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - rectRight(rect));
  const dy = Math.max(rect.y - point.y, 0, point.y - rectBottom(rect));
  return Math.hypot(dx, dy);
}

export function pointInRect(point: Point, rect: Rect, padding = 0): boolean {
  return (
    point.x >= rect.x - padding &&
    point.x <= rectRight(rect) + padding &&
    point.y >= rect.y - padding &&
    point.y <= rectBottom(rect) + padding
  );
}

export function clampRectToBounds(rect: Rect, bounds: SizedBounds): Rect {
  const width = Math.max(1, Math.min(Math.round(rect.width), Math.round(bounds.width)));
  const height = Math.max(1, Math.min(Math.round(rect.height), Math.round(bounds.height)));
  const maxX = bounds.x + bounds.width - width;
  const maxY = bounds.y + bounds.height - height;
  return {
    x: Math.min(Math.max(Math.round(rect.x), bounds.x), maxX),
    y: Math.min(Math.max(Math.round(rect.y), bounds.y), maxY),
    width,
    height,
  };
}

/**
 * 以光标为中心取一小块截图区域，并夹在工作区内。
 * 区域必须小：一是 OCR 快，二是“只看光标附近”隐私上更容易解释。
 */
export function regionAroundPoint(
  point: Point,
  width: number,
  height: number,
  bounds: SizedBounds,
): Rect {
  return clampRectToBounds(
    {
      x: Math.round(point.x - width / 2),
      y: Math.round(point.y - height / 2),
      width,
      height,
    },
    bounds,
  );
}

/**
 * 根据当前显示器工作区决定“截多大一块”。
 *
 * 不能固定 340×180：在 1024×768 上太大，在 4K 上又相对太小。
 * 经验值：
 * - 宽度取工作区的 26%，限制在 260–420 DIP；约 18–28 个汉字宽；
 * - 高度取宽度的 52%，限制在 140–230 DIP；约 6–10 行，够定位光标所在行；
 * - 至少给工作区留 16 DIP 边距，极小屏幕也不会超出。
 *
 * 返回值是 DIP（逻辑像素），平台层再按 DPI 换算成物理像素；
 * 所以 100%/150%/200% 缩放共用同一套逻辑，不会因为缩放而截偏。
 */
export function captureSizeForWorkArea(work: SizedBounds): { width: number; height: number } {
  const maxWidth = Math.max(180, work.width - 16);
  const idealWidth = Math.round(work.width * 0.26);
  const width = Math.round(Math.max(200, Math.min(420, Math.max(260, idealWidth), maxWidth)));

  const maxHeight = Math.max(120, work.height - 16);
  const idealHeight = Math.round(width * 0.52);
  const height = Math.round(Math.max(140, Math.min(230, idealHeight, maxHeight)));

  return { width, height };
}

function splitChars(text: string): string[] {
  return Array.from(text);
}

function isLatinGapChar(char: string): boolean {
  return LATIN_RE.test(char) || /[0-9]/.test(char);
}

function shouldKeepSpace(previous: string | undefined, next: string | undefined): boolean {
  return Boolean(
    previous &&
      next &&
      isLatinGapChar(previous) &&
      isLatinGapChar(next) &&
      !CJK_GAP_RE.test(previous) &&
      !CJK_GAP_RE.test(next),
  );
}

interface FlatChar {
  text: string;
  rect: Rect;
  spaceBefore: boolean;
}

function flattenRawChars(raw: RawOcrChar[]): FlatChar[] {
  const out: FlatChar[] = [];
  let pendingSpace = false;

  for (const rawChar of raw) {
    const text = rawChar.text ?? '';
    const codePoints = splitChars(text);
    if (codePoints.length === 0) continue;
    if (codePoints.every((char) => /\s/.test(char))) {
      pendingSpace = true;
      continue;
    }

    const rect = cleanRect(rawChar.bbox);
    // Windows OCR 有时把两个字并进一个 word（英文常见），按宽度均分，
    // 保证 text 与 chars 一一对应，光标定位不会错位。
    const charWidth = codePoints.length > 0 ? rect.width / codePoints.length : rect.width;
    codePoints.forEach((char, index) => {
      if (/\s/.test(char)) {
        pendingSpace = true;
        return;
      }
      out.push({
        text: char,
        rect: {
          x: rect.x + charWidth * index,
          y: rect.y,
          width: charWidth,
          height: rect.height,
        },
        spaceBefore: pendingSpace,
      });
      pendingSpace = false;
    });
  }

  return out;
}

function estimateCharsFromLine(line: RawOcrLine): FlatChar[] {
  const text = (line.text ?? '').replace(/\s+/g, ' ').trim();
  const chars = splitChars(text);
  if (chars.length === 0) return [];
  const rect = cleanRect(line.bbox);
  const charWidth = rect.width / chars.length;
  return chars.map((char, index) => ({
    text: char,
    rect: { x: rect.x + charWidth * index, y: rect.y, width: charWidth, height: rect.height },
    spaceBefore: char === ' ',
  }));
}

/**
 * 把平台 OCR 结果归一化。优先使用平台给出的逐字框：
 * - Windows WinRT 每个汉字一个 word，框最准；
 * - macOS Vision 我们能拿到每个字符的 boundingBox；
 * - 退而求其次才按整行等分，此时定位会粗略一些，但不会崩。
 */
export function normalizeOcrPage(raw: RawOcrPage): OcrPage {
  const lines: OcrLine[] = [];

  for (const rawLine of raw.lines) {
    const flat = rawLine.chars && rawLine.chars.length > 0
      ? flattenRawChars(rawLine.chars)
      : estimateCharsFromLine(rawLine);
    if (flat.length === 0) continue;

    const chars: OcrChar[] = [];
    const rects: Rect[] = [];

    flat.forEach((entry, index) => {
      const previous = flat[index - 1];
      if (entry.spaceBefore && previous && shouldKeepSpace(previous.text, entry.text)) {
        chars.push({
          text: ' ',
          rect: {
            x: rectRight(previous.rect),
            y: previous.rect.y,
            width: 0,
            height: previous.rect.height,
          },
        });
      }
      chars.push({ text: entry.text, rect: entry.rect });
      rects.push(entry.rect);
    });

    const text = chars.map((char) => char.text).join('');
    if (!text.trim()) continue;
    const rect = rects.length > 0 ? unionRects(rects) : cleanRect(rawLine.bbox);
    lines.push({ text, rect, chars });
  }

  return {
    width: Math.max(1, Math.round(finite(raw.width, 1))),
    height: Math.max(1, Math.round(finite(raw.height, 1))),
    lines,
  };
}

function lineDistance(point: Point, line: OcrLine): number {
  const dx = Math.max(line.rect.x - point.x, 0, point.x - rectRight(line.rect));
  const dy = Math.max(line.rect.y - point.y, 0, point.y - rectBottom(line.rect));
  return Math.hypot(dx, dy);
}

export interface CharCandidate {
  line: OcrLine;
  index: number;
  char: OcrChar;
  score: number;
}

/**
 * 找光标下的字。
 *
 * 容许一点误差：OCR 框和真实字形通常差 1–3px，手指/鼠标也不会刚好停在
 * 字中心，所以先找框内，再找 10px 内最近的字；超过阈值就当作“这里没字”，
 * 不弹窗。
 */
export function findCharAtPoint(page: OcrPage, point: Point): CharCandidate | null {
  let best: CharCandidate | null = null;

  for (const line of page.lines) {
    if (lineDistance(point, line) > 14) continue;
    line.chars.forEach((char, index) => {
      if (!isLookupChar(char.text)) return;
      const inside = pointInRect(point, char.rect, 2);
      const distance = distanceToRect(point, char.rect);
      if (!inside && distance > 9) return;
      // 垂直线差权重更高，避免在两行之间选错行。
      const dx = Math.max(char.rect.x - point.x, 0, point.x - rectRight(char.rect));
      const dy = Math.max(char.rect.y - point.y, 0, point.y - rectBottom(char.rect));
      const score = inside ? 0 : dx + dy * 4;
      if (!best || score < best.score) {
        best = { line, index, char, score };
      }
    });
  }

  return best;
}

export interface LexiconLike {
  has(word: string): boolean;
}

/*
 * 中文分词兜底。
 *
 * 词表能覆盖“验证码/挂号/窗口”这类常用词，但屏幕上的词远不止词表。
 * 如果词表没命中，就退到 Intl.Segmenter（浏览器/Node 自带 ICU）按词切分，
 * 例如“今天很暖和”会切出“暖和”，而不是只取“暖”一个字。
 *
 * Intl.Segmenter 不存在时（很老的运行时）再退回单字，不影响基本朗读。
 */
interface SegmentPart {
  segment: string;
  index: number;
  isWordLike?: boolean;
}

interface WordSegmenterLike {
  segment(input: string): Iterable<SegmentPart>;
}

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'word' },
) => WordSegmenterLike;

const SegmenterCtor = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;

const chineseWordSegmenter: WordSegmenterLike | null = (() => {
  if (!SegmenterCtor) return null;
  try {
    return new SegmenterCtor('zh-CN', { granularity: 'word' });
  } catch {
    return null;
  }
})();

function intlWordAt(
  text: string,
  index: number,
): { start: number; end: number; text: string } | null {
  if (!chineseWordSegmenter) return null;
  try {
    for (const part of chineseWordSegmenter.segment(text)) {
      const start = part.index;
      const end = start + part.segment.length;
      if (index < start) break;
      if (index < start || index >= end) continue;
      if (part.isWordLike === false) return null;
      const chars = Array.from(part.segment);
      if (chars.length < 2 || chars.length > 8) return null;
      if (!chars.every((char) => isCjk(char))) return null;
      return { start, end, text: part.segment };
    }
  } catch {
    return null;
  }
  return null;
}

function isCjkAt(text: string, index: number): boolean {
  const char = text[index];
  return Boolean(char && isCjk(char));
}

function expandLatin(text: string, index: number): { start: number; end: number } {
  let start = index;
  let end = index + 1;
  while (start > 0 && LATIN_WORD_RE.test(text[start - 1] ?? '')) start -= 1;
  while (end < text.length && LATIN_WORD_RE.test(text[end] ?? '')) end += 1;
  return { start, end };
}

/**
 * 在光标所在字的基础上，优先取“整词”。
 *
 * 顺序：
 * 1. 本机词表最长匹配（人工词条优先，如“验证码”“挂号”）；
 * 2. Intl.Segmenter 中文分词（词表没覆盖的词，如“暖和”“辽阔”）；
 * 3. 单字兜底（确实没有词边界时才只取一个字）。
 *
 * 这样光标停在“暖”上会查“暖和”，而不是只念“暖”；停在“码”上会查“验证码”。
 */
export function expandWordAt(
  lineText: string,
  charIndex: number,
  lexicon: LexiconLike,
  maxWordLength = 4,
): { text: string; kind: LookupKind; start: number; end: number } {
  const char = lineText[charIndex];
  if (!char) return { text: '', kind: 'char', start: charIndex, end: charIndex };

  if (isLatinLetter(char)) {
    const span = expandLatin(lineText, charIndex);
    return {
      text: lineText.slice(span.start, span.end),
      kind: 'latin',
      start: span.start,
      end: span.end,
    };
  }

  if (!isCjk(char)) {
    return { text: char, kind: 'char', start: charIndex, end: charIndex + 1 };
  }

  let best: { start: number; end: number; length: number } | null = null;
  const maxLength = Math.max(2, Math.min(8, Math.floor(maxWordLength)));
  for (let length = maxLength; length >= 2; length -= 1) {
    const earliest = Math.max(0, charIndex - length + 1);
    const latest = Math.min(charIndex, lineText.length - length);
    for (let start = earliest; start <= latest; start += 1) {
      const end = start + length;
      let allCjk = true;
      for (let cursor = start; cursor < end; cursor += 1) {
        if (!isCjkAt(lineText, cursor)) {
          allCjk = false;
          break;
        }
      }
      if (!allCjk) continue;
      const word = lineText.slice(start, end);
      if (!lexicon.has(word)) continue;
      // 同一长度下，优先选择离光标更近的词（词中心距离最小）。
      const center = (start + end - 1) / 2;
      const distance = Math.abs(center - charIndex);
      if (!best || distance < Math.abs((best.start + best.end - 1) / 2 - charIndex)) {
        best = { start, end, length };
      }
    }
    if (best) break;
  }

  // 词表没命中（或只命中一个更短的词）时，用系统分词拿整词。
  // 例：“今天很暖和” → “暖和”；“医院挂号” → 词表已命中“挂号”，不再拆。
  const segmented = intlWordAt(lineText, charIndex);
  if (segmented && (!best || segmented.text.length > best.end - best.start)) {
    best = { start: segmented.start, end: segmented.end, length: segmented.text.length };
  }

  if (best) {
    const word = lineText.slice(best.start, best.end);
    if (IGNORED_WORDS.has(word) && !lexicon.has(word)) {
      return { text: '', kind: 'char', start: charIndex, end: charIndex + 1 };
    }
    return {
      text: word,
      kind: 'word',
      start: best.start,
      end: best.end,
    };
  }

  if (isIgnoredSingle(char) && !lexicon.has(char)) {
    return { text: '', kind: 'char', start: charIndex, end: charIndex + 1 };
  }

  return { text: char, kind: 'char', start: charIndex, end: charIndex + 1 };
}

/**
 * 取词主入口：光标像素坐标 + OCR 页 + 词表 → 要查的目标。
 * 返回 null 表示“这里没有值得弹窗的字”，调用方应把已有小窗收起来。
 */
export function lookupAtPoint(
  page: OcrPage,
  point: Point,
  lexicon: LexiconLike,
  maxWordLength = 4,
): LookupTarget | null {
  const hit = findCharAtPoint(page, point);
  if (!hit) return null;
  const expanded = expandWordAt(hit.line.text, hit.index, lexicon, maxWordLength);
  if (!expanded.text) return null;

  const first = hit.line.chars[expanded.start];
  const last = hit.line.chars[Math.max(expanded.start, expanded.end - 1)];
  const rects = hit.line.chars
    .slice(expanded.start, expanded.end)
    .map((char) => char.rect)
    .filter((rect) => rect.width > 0);

  return {
    text: expanded.text,
    kind: expanded.kind,
    lineText: hit.line.text.trim(),
    charIndex: expanded.start,
    charRect: first ? first.rect : hit.char.rect,
    lineRect: last ? unionRects(rects.length > 0 ? rects : [hit.line.rect]) : hit.line.rect,
    point,
  };
}

/** 悬浮窗防重复查询的 key：词 + 光标所在的大致位置。 */
export function lookupKey(target: LookupTarget): string {
  return `${target.text}@${Math.round(target.point.x / 4)},${Math.round(target.point.y / 4)}`;
}

export function emptyKnowledge(word: string): WordKnowledge {
  return {
    word,
    pinyin: null,
    definition: null,
    example: null,
    source: 'none',
    sourceLabel: '还不知道',
    generated: false,
    confidence: 'low',
    updatedAt: Date.now(),
  };
}

/** 去掉 HTML、控制字符和 URL；大模型返回的内容不能直接塞进 UI。 */
export function sanitizeKnowledgeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  let text = value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (URL_RE.test(text)) return null;
  if (text.length > maxLength) text = `${text.slice(0, maxLength)}…`;
  return text;
}

export function sanitizePinyin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 40) return null;
  if (!PINYIN_RE.test(text)) return null;
  return text;
}

function sourceLabelFor(source: KnowledgeSource, label?: string): string {
  if (label) return label;
  switch (source) {
    case 'card':
      return '本机字卡';
    case 'glossary':
      return '本机词表';
    case 'corpus':
      return '语料库';
    case 'llm':
      return '电脑生成';
    case 'mixed':
      return '本机 + 电脑';
    default:
      return '还不知道';
  }
}

export function makeKnowledge(
  word: string,
  fields: Partial<Omit<WordKnowledge, 'word'>> = {},
): WordKnowledge {
  const source = fields.source ?? 'none';
  return {
    word,
    pinyin: fields.pinyin ?? null,
    definition: fields.definition ?? null,
    example: fields.example ?? null,
    source,
    sourceLabel: fields.sourceLabel ?? sourceLabelFor(source),
    generated: fields.generated ?? source === 'llm',
    confidence: fields.confidence ?? 'medium',
    updatedAt: fields.updatedAt ?? Date.now(),
  };
}

/**
 * 合并多来源知识：默认“先到先得”，即本机字卡/语料库优先，大模型只补空缺。
 * 这样将来接入爬虫语料时，模型内容永远不会盖掉有来源的人工内容。
 */
export function mergeKnowledge(
  base: WordKnowledge,
  extra: WordKnowledge,
  options: { preferExtra?: boolean } = {},
): WordKnowledge {
  const take = <T>(current: T | null, next: T | null): T | null =>
    next !== null && (current === null || options.preferExtra) ? next : current;

  const pinyin = take(base.pinyin, extra.pinyin);
  const definition = take(base.definition, extra.definition);
  const example = take(base.example, extra.example);

  const sameSource = base.source === extra.source;
  const source: KnowledgeSource = sameSource ? base.source : 'mixed';
  const labels = Array.from(new Set([base.sourceLabel, extra.sourceLabel].filter(Boolean)));
  const changed = pinyin !== base.pinyin || definition !== base.definition || example !== base.example;

  return {
    word: base.word,
    pinyin,
    definition,
    example,
    source,
    sourceLabel: sameSource ? base.sourceLabel : labels.join(' + '),
    generated: base.generated || extra.generated,
    // 只要这次合并用到了 extra 的字段，就采用 extra 的置信度；
    // 否则保持 base，避免“补了个例句”把整条知识的可信度改掉。
    confidence: changed ? extra.confidence : base.confidence,
    updatedAt: Math.max(base.updatedAt, extra.updatedAt),
  };
}

export function isKnowledgeEmpty(knowledge: WordKnowledge): boolean {
  return !knowledge.pinyin && !knowledge.definition && !knowledge.example;
}

/** 给大模型提示用的短上下文：一行最多 80 字，避免把整屏文字发出去。 */
export function contextForModel(target: LookupTarget, maxLength = 80): string {
  const line = target.lineText.replace(/\s+/g, ' ').trim();
  return line.length > maxLength ? line.slice(0, maxLength) : line;
}

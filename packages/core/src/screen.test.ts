import { describe, expect, it } from 'vitest';
import {
  captureSizeForWorkArea,
  clampRectToBounds,
  contextForModel,
  emptyKnowledge,
  findCharAtPoint,
  lookupAtPoint,
  makeKnowledge,
  mergeKnowledge,
  normalizeOcrPage,
  regionAroundPoint,
  sanitizeKnowledgeText,
  sanitizePinyin,
  type RawOcrPage,
} from './screen.js';

/** 造一个和 WinRT 形状一致的行：每个汉字一个 word 框。 */
function lineFromChars(chars: string[], x: number, y: number, size = 30): RawOcrPage['lines'][number] {
  return {
    text: chars.join(' '),
    chars: chars.map((char, index) => ({
      text: char,
      bbox: { x: x + index * (size + 2), y, width: size, height: size },
    })),
  };
}

function pageWithText(text: string): RawOcrPage {
  const chars = Array.from(text);
  return {
    width: 800,
    height: 200,
    lines: [lineFromChars(chars, 20, 40)],
  };
}

function centerOf(text: string, index: number, startX = 20, size = 30): { x: number; y: number } {
  return { x: startX + index * (size + 2) + size / 2, y: 40 + size / 2 };
}

describe('OCR normalization', () => {
  it('drops OCR spaces between Chinese characters and keeps boxes aligned', () => {
    const page = normalizeOcrPage(pageWithText('验证码'));
    expect(page.lines).toHaveLength(1);
    expect(page.lines[0]!.text).toBe('验证码');
    expect(page.lines[0]!.chars).toHaveLength(3);
    expect(page.lines[0]!.chars[1]!.text).toBe('证');
    expect(page.lines[0]!.rect.width).toBeGreaterThan(60);
  });

  it('keeps a space between Latin words but not around Chinese', () => {
    const page = normalizeOcrPage({
      width: 400,
      height: 100,
      lines: [
        {
          text: 'Sign in 验证码',
          chars: [
            { text: 'S', bbox: { x: 0, y: 0, width: 10, height: 20 } },
            { text: 'i', bbox: { x: 10, y: 0, width: 10, height: 20 } },
            { text: 'g', bbox: { x: 20, y: 0, width: 10, height: 20 } },
            { text: 'n', bbox: { x: 30, y: 0, width: 10, height: 20 } },
            { text: ' ', bbox: { x: 40, y: 0, width: 5, height: 20 } },
            { text: 'i', bbox: { x: 45, y: 0, width: 10, height: 20 } },
            { text: 'n', bbox: { x: 55, y: 0, width: 10, height: 20 } },
            { text: '验', bbox: { x: 70, y: 0, width: 20, height: 20 } },
            { text: '证', bbox: { x: 90, y: 0, width: 20, height: 20 } },
            { text: '码', bbox: { x: 110, y: 0, width: 20, height: 20 } },
          ],
        },
      ],
    });
    expect(page.lines[0]!.text).toContain('Sign in');
    expect(page.lines[0]!.text).toContain('验证码');
    expect(page.lines[0]!.text).not.toContain('验 证');
  });

  it('falls back to equal-width boxes when the platform gives no per-char boxes', () => {
    const page = normalizeOcrPage({
      width: 200,
      height: 60,
      lines: [{ text: '医院挂号', bbox: { x: 10, y: 10, width: 160, height: 30 } }],
    });
    expect(page.lines[0]!.chars).toHaveLength(4);
    expect(page.lines[0]!.chars[0]!.rect.width).toBe(40);
    expect(page.lines[0]!.text).toBe('医院挂号');
  });
});

describe('cursor lookup', () => {
  const lexicon = new Set(['验证码', '密码', '医院', '挂号', '窗口', '药']);

  it('finds the character under the cursor', () => {
    const page = normalizeOcrPage(pageWithText('验证码'));
    const hit = findCharAtPoint(page, centerOf('验证码', 1));
    expect(hit?.char.text).toBe('证');
  });

  it('expands to the longest lexicon word containing the cursor', () => {
    const page = normalizeOcrPage(pageWithText('请输入验证码'));
    const target = lookupAtPoint(page, centerOf('请输入验证码', 4), lexicon);
    expect(target?.text).toBe('验证码');
    expect(target?.kind).toBe('word');
    expect(target?.lineText).toBe('请输入验证码');
  });

  it('uses the word even when the cursor is on the last character', () => {
    const page = normalizeOcrPage(pageWithText('请输入验证码'));
    const target = lookupAtPoint(page, centerOf('请输入验证码', 5), lexicon);
    expect(target?.text).toBe('验证码');
  });

  it('falls back to a single known character', () => {
    const page = normalizeOcrPage(pageWithText('药'));
    const target = lookupAtPoint(page, centerOf('药', 0), lexicon);
    expect(target?.text).toBe('药');
    expect(target?.kind).toBe('char');
  });

  it('uses Intl.Segmenter to pick a whole word not in the lexicon', () => {
    const page = normalizeOcrPage(pageWithText('今天很暖和'));
    const target = lookupAtPoint(page, centerOf('今天很暖和', 3), lexicon);
    expect(target?.text).toBe('暖和');
    expect(target?.kind).toBe('word');

    const page2 = normalizeOcrPage(pageWithText('辽阔的草原'));
    const target2 = lookupAtPoint(page2, centerOf('辽阔的草原', 1), lexicon);
    expect(target2?.text).toBe('辽阔');
  });

  it('prefers a longer curated lexicon word over the segmenter', () => {
    // ICU 可能把“验证码”切成“验证”+“码”；词表里的“验证码”更长，应优先。
    const page = normalizeOcrPage(pageWithText('请输入验证码'));
    const target = lookupAtPoint(page, centerOf('请输入验证码', 4), lexicon);
    expect(target?.text).toBe('验证码');
  });

  it('ignores grammatical particles that would only annoy the user', () => {
    const page = normalizeOcrPage(pageWithText('我的'));
    expect(lookupAtPoint(page, centerOf('我的', 0), lexicon)).toBeNull();
  });

  it('returns null on punctuation and empty space', () => {
    const page = normalizeOcrPage(pageWithText('好，'));
    expect(lookupAtPoint(page, centerOf('好，', 1), lexicon)).toBeNull();
    expect(lookupAtPoint(page, { x: 700, y: 300 }, lexicon)).toBeNull();
  });

  it('expands English words for later translation', () => {
    const page = normalizeOcrPage(pageWithText('Password'));
    const target = lookupAtPoint(page, centerOf('Password', 3), lexicon);
    expect(target?.text).toBe('Password');
    expect(target?.kind).toBe('latin');
  });

  it('keeps the context short enough for a model prompt', () => {
    const page = normalizeOcrPage(pageWithText('请 输 入 验 证 码 后 再 点 下 一 步'));
    const target = lookupAtPoint(page, centerOf('请输入验证码后再点下一步', 4), lexicon);
    expect(target).not.toBeNull();
    expect(contextForModel(target!, 8)).toHaveLength(8);
  });
});

describe('region math', () => {
  it('centers a small capture region on the cursor', () => {
    const rect = regionAroundPoint({ x: 500, y: 400 }, 340, 180, {
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    });
    expect(rect).toEqual({ x: 330, y: 310, width: 340, height: 180 });
  });

  it('clamps at screen edges and on tiny screens', () => {
    const left = regionAroundPoint({ x: 4, y: 4 }, 340, 180, {
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    });
    expect(left.x).toBe(0);
    expect(left.y).toBe(0);

    const tiny = clampRectToBounds({ x: 50, y: 50, width: 900, height: 900 }, {
      x: 0,
      y: 0,
      width: 320,
      height: 200,
    });
    expect(tiny).toEqual({ x: 0, y: 0, width: 320, height: 200 });
  });

  it('scales the capture window with the display work area', () => {
    expect(captureSizeForWorkArea({ x: 0, y: 0, width: 800, height: 600 })).toEqual({
      width: 260,
      height: 140,
    });
    expect(captureSizeForWorkArea({ x: 0, y: 0, width: 1024, height: 768 })).toEqual({
      width: 266,
      height: 140,
    });
    expect(captureSizeForWorkArea({ x: 0, y: 0, width: 1280, height: 800 })).toEqual({
      width: 333,
      height: 173,
    });
    expect(captureSizeForWorkArea({ x: 0, y: 0, width: 1920, height: 1080 })).toEqual({
      width: 420,
      height: 218,
    });
    expect(captureSizeForWorkArea({ x: 0, y: 0, width: 3440, height: 1440 })).toEqual({
      width: 420,
      height: 218,
    });
  });

  it('never lets the capture window exceed a small work area', () => {
    const size = captureSizeForWorkArea({ x: 0, y: 0, width: 240, height: 180 });
    expect(size.width).toBeLessThanOrEqual(240);
    expect(size.height).toBeLessThanOrEqual(180);
  });
});

describe('knowledge merging', () => {
  it('never lets a generated definition override a local card', () => {
    const local = makeKnowledge('验证码', {
      pinyin: 'yàn zhèng mǎ',
      definition: '手机上收到的一串数字，只能自己用。',
      source: 'card',
      confidence: 'high',
    });
    const llm = makeKnowledge('验证码', {
      definition: '一条短信里的数字。',
      example: '银行发来的验证码，不要告诉别人。',
      source: 'llm',
      confidence: 'medium',
    });
    const merged = mergeKnowledge(local, llm);
    expect(merged.definition).toBe('手机上收到的一串数字，只能自己用。');
    expect(merged.example).toBe('银行发来的验证码，不要告诉别人。');
    expect(merged.generated).toBe(true);
    expect(merged.source).toBe('mixed');
    expect(merged.sourceLabel).toContain('本机');
    expect(merged.sourceLabel).toContain('电脑');
  });

  it('starts empty and only marks generated when model content is used', () => {
    const empty = emptyKnowledge('窗口');
    expect(empty.definition).toBeNull();
    const local = makeKnowledge('窗口', { definition: '办事的柜台。', source: 'glossary' });
    const merged = mergeKnowledge(local, empty);
    expect(merged.definition).toBe('办事的柜台。');
    expect(merged.generated).toBe(false);
  });
});

describe('model output sanitation', () => {
  it('strips HTML and rejects links', () => {
    expect(sanitizeKnowledgeText('<b>存钱的地方</b>', 20)).toBe('存钱的地方');
    expect(sanitizeKnowledgeText('点 https://example.com 领取', 40)).toBeNull();
    expect(sanitizeKnowledgeText('   ', 20)).toBeNull();
  });

  it('accepts tone-marked pinyin and rejects explanations', () => {
    expect(sanitizePinyin('yàn zhèng mǎ')).toBe('yàn zhèng mǎ');
    expect(sanitizePinyin('这是拼音')).toBeNull();
  });
});

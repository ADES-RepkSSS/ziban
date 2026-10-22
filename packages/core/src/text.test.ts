import { describe, expect, it } from 'vitest';
import {
  buildCharTimings,
  charIndexAtElapsed,
  cleanForSpeech,
  estimateSpeechMs,
  findUnknownChars,
  hasChinese,
  pickChineseVoice,
  splitForSpeech,
  splitSentences,
} from './text.js';

describe('sentence splitting', () => {
  it('keeps Chinese punctuation and drops empty lines', () => {
    expect(splitSentences('第一句。第二句！\n\n第三句？')).toEqual(['第一句。', '第二句！', '第三句？']);
  });

  it('handles text without final punctuation', () => {
    expect(splitSentences('没有标点的一句话')).toEqual(['没有标点的一句话']);
    expect(splitSentences('   ')).toEqual([]);
  });

  it('splits long sentences for TTS without losing text', () => {
    const long = '请先到一楼大厅挂号，然后到二楼三号诊室看病，缴费请到一楼窗口，取药请到药房，最后再回家休息。';
    const chunks = splitForSpeech(long, 18);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(long);
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true);
  });
});

describe('highlight timeline', () => {
  it('orders per-character timings monotonically', () => {
    const timings = buildCharTimings('药品', 1);
    expect(timings).toHaveLength(2);
    expect(timings[0]!.startMs).toBeLessThan(timings[1]!.startMs);
    expect(charIndexAtElapsed(timings, 0)).toBe(0);
    expect(charIndexAtElapsed(timings, timings[1]!.startMs + 1)).toBe(1);
  });

  it('runs slower at a slower rate', () => {
    expect(estimateSpeechMs('药品', 0.65)).toBeGreaterThan(estimateSpeechMs('药品', 1));
  });
});

describe('voice selection', () => {
  it('prefers an offline Mandarin voice', () => {
    const voice = pickChineseVoice([
      { name: 'English', lang: 'en-US' },
      { name: 'Microsoft Xiaoxiao Online', lang: 'zh-CN', localService: false },
      { name: 'Microsoft Huihui', lang: 'zh-CN', localService: true },
    ]);
    expect(voice?.name).toBe('Microsoft Huihui');
  });

  it('falls back to any Chinese voice, and null when none', () => {
    expect(pickChineseVoice([{ name: 'Ting-Ting', lang: 'zh-TW' }])?.name).toBe('Ting-Ting');
    expect(pickChineseVoice([{ name: 'Samantha', lang: 'en-US' }])).toBeNull();
  });
});

describe('text hygiene', () => {
  it('cleans invisible characters and markdown noise', () => {
    expect(cleanForSpeech('# 标题\n\n\n正文\u200b')).toBe('标题\n\n正文');
  });

  it('detects Chinese content', () => {
    expect(hasChinese('请到二号窗口')).toBe(true);
    expect(hasChinese('hello world')).toBe(false);
  });

  it('finds unlearned characters once each', () => {
    expect(findUnknownChars('药品和医院', new Set(['药']))).toEqual(['品', '和', '医', '院']);
  });
});

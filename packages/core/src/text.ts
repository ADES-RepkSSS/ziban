/**
 * 文本与朗读节奏的纯函数。
 * 逐字高亮需要“每个字大概读多久”，浏览器 TTS 的 boundary 事件在中文下并不可靠，
 * 因此这里提供可预测的兜底时间轴。
 */

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

const SENTENCE_ENDERS = new Set(['。', '！', '？', '!', '?', '；', ';', '\n']);
const COMMA_ENDERS = new Set(['，', ',', '、', '：', ':']);

/** 按中文句末标点切句，保留标点。用于“逐句朗读/逐句解释”。 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const result: string[] = [];
  let buffer = '';
  for (const char of normalized) {
    buffer += char;
    if (SENTENCE_ENDERS.has(char)) {
      const sentence = buffer.trim();
      if (sentence) result.push(sentence);
      buffer = '';
    }
  }
  const tail = buffer.trim();
  if (tail) result.push(tail);
  return result;
}

/**
 * 把长句再切成适合 TTS 的短块（默认 42 字）。
 * Chrome/Edge 对超长 utterance 有截断问题，逐块读还能同步高亮。
 */
export function splitForSpeech(text: string, maxChars = 42): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      chunks.push(sentence);
      continue;
    }

    let buffer = '';
    for (const char of sentence) {
      buffer += char;
      if ((COMMA_ENDERS.has(char) || SENTENCE_ENDERS.has(char)) && buffer.length >= maxChars / 2) {
        chunks.push(buffer.trim());
        buffer = '';
      } else if (buffer.length >= maxChars) {
        chunks.push(buffer.trim());
        buffer = '';
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
  }

  return chunks.filter(Boolean);
}

export function isHan(char: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(char);
}

function isAsciiWord(char: string): boolean {
  return /[A-Za-z0-9]/.test(char);
}

function isPause(char: string): boolean {
  return /[，,、：:；;。！？!?]/.test(char);
}

/** 每个字符的朗读时长（毫秒），用于没有 boundary 事件时的逐字高亮。 */
export function charDuration(char: string, rate = 1): number {
  const safeRate = Math.min(1.5, Math.max(0.4, rate || 1));
  let base: number;
  if (isHan(char)) base = 245;
  else if (isAsciiWord(char)) base = 125;
  else if (char === ' ') base = 55;
  else if (/[。！？!?]/.test(char)) base = 330;
  else if (isPause(char)) base = 210;
  else if (char === '\n') base = 280;
  else base = 130;
  return base / safeRate;
}

export interface CharTiming {
  char: string;
  index: number;
  startMs: number;
  durationMs: number;
}

/** 生成逐字时间轴；末尾额外留 250ms，避免最后一个字一闪而过。 */
export function buildCharTimings(text: string, rate = 1): CharTiming[] {
  let cursor = 260;
  return Array.from(text).map((char, index) => {
    const durationMs = charDuration(char, rate);
    const timing = { char, index, startMs: cursor, durationMs };
    cursor += durationMs;
    return timing;
  });
}

export function estimateSpeechMs(text: string, rate = 1): number {
  const timings = buildCharTimings(text, rate);
  const last = timings[timings.length - 1];
  return Math.max(700, (last ? last.startMs + last.durationMs : 0) + 500);
}

/** 在给定时间点，应该高亮第几个字。 */
export function charIndexAtElapsed(timings: CharTiming[], elapsedMs: number): number {
  if (timings.length === 0) return -1;
  let result = 0;
  for (const timing of timings) {
    if (elapsedMs >= timing.startMs) result = timing.index;
    else break;
  }
  return result;
}

/**
 * 挑一个中文语音。优先本机离线语音，避免“默认动作联网”；
 * 名称偏好只作为同等条件下的加分，不硬编码某个平台。
 */
export function pickChineseVoice<T extends VoiceLike>(voices: T[]): T | null {
  const preferredNames = [
    'xiaoxiao',
    'xiaoyi',
    'huihui',
    'tingting',
    'meijia',
    'yunxi',
    'yunjian',
    'google 普通话',
    'google zh',
    'microsoft',
  ];

  let best: { voice: T; score: number } | null = null;
  for (const voice of voices) {
    const lang = (voice.lang || '').toLowerCase().replace('_', '-');
    if (!lang.startsWith('zh')) continue;

    let score = 100;
    if (lang.startsWith('zh-cn') || lang === 'zh') score += 20;
    if (voice.localService) score += 25;
    if (voice.default) score += 5;

    const lowerName = voice.name.toLowerCase();
    const nameIndex = preferredNames.findIndex((name) => lowerName.includes(name));
    if (nameIndex >= 0) score += 30 - nameIndex;

    if (!best || score > best.score) best = { voice, score };
  }
  return best?.voice ?? null;
}

/** 把网页/微信里常见的全角空格、零宽字符、Markdown 符号清理掉，读起来更顺。 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[#>*\-+]\s?/gm, '')
    .trim();
}

/** 粗略判断是否中文内容；用于语音选择与界面提示。 */
export function hasChinese(text: string): boolean {
  const chars = Array.from(text.replace(/\s/g, ''));
  if (chars.length === 0) return false;
  const han = chars.filter(isHan).length;
  return han / chars.length >= 0.2;
}

/**
 * 找出句子中最难的字，用于“这几个字还没学过”的提示。
 * 只做字形统计，不做语义判断。
 */
export function findUnknownChars(text: string, knownChars: Set<string>, limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const char of text) {
    if (!isHan(char) || knownChars.has(char) || seen.has(char)) continue;
    seen.add(char);
    result.push(char);
    if (result.length >= limit) break;
  }
  return result;
}

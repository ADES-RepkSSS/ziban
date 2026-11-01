/**
 * 词卡单字频率统计的纯函数。
 *
 * 统计口径见 docs/14-card-char-frequency.md：
 * - 默认只统计卡片目标词（text；批次文件用 word）里的汉字；
 * - 一个字每出现一次计 1 次；同一张卡里出现多次，只让“卡数”加 1；
 * - 排序：次数降序 → 卡数降序 → 首次出现顺序 → 码点。
 *
 * 这里不读文件、不打印，方便单独理解和复用；读文件在
 * scripts/card-char-frequency.mjs。
 */

export const HAN_PATTERN = /\p{Script=Han}/u;

export const SUPPORTED_FIELDS = ['text', 'meaning', 'sentence', 'alt'];

const FIELD_ALIASES = new Map([
  ['text', 'text'],
  ['word', 'text'],
  ['target', 'text'],
  ['meaning', 'meaning'],
  ['sentence', 'sentence'],
  ['alt', 'alt'],
  ['image.alt', 'alt'],
  ['image_alt', 'alt'],
  ['all', 'all'],
]);

export function isHanCharacter(char) {
  return HAN_PATTERN.test(char);
}

/**
 * 把文本拆成要统计的单字。
 * 默认只保留汉字；includeNonHan 时连标点、字母、数字也保留，但不保留空白。
 */
export function extractCharacters(value, { includeNonHan = false } = {}) {
  if (typeof value !== 'string' || value.length === 0) return [];

  const characters = [];
  for (const char of value.normalize('NFC')) {
    if (isHanCharacter(char)) {
      characters.push(char);
    } else if (includeNonHan && !/\s/u.test(char)) {
      characters.push(char);
    }
  }
  return characters;
}

/**
 * 默认口径下会被跳过的非汉字数量（用于摘要提示）。
 * includeNonHan 时不再有“跳过”的非汉字；空白始终不算单字。
 */
export function countSkippedNonHan(value, { includeNonHan = false } = {}) {
  if (typeof value !== 'string' || includeNonHan) return 0;
  let skipped = 0;
  for (const char of value.normalize('NFC')) {
    if (!isHanCharacter(char) && !/\s/u.test(char)) skipped += 1;
  }
  return skipped;
}

export function normalizeFields(fields = ['text']) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('至少需要一个统计字段');
  }

  const normalized = [];
  for (const raw of fields) {
    const key = String(raw).trim().toLowerCase();
    const canonical = FIELD_ALIASES.get(key);
    if (!canonical) {
      throw new Error(
        `未知统计字段「${raw}」；可选：${SUPPORTED_FIELDS.join(' / ')} / all`,
      );
    }

    const expanded = canonical === 'all' ? SUPPORTED_FIELDS : [canonical];
    for (const field of expanded) {
      if (!normalized.includes(field)) normalized.push(field);
    }
  }
  return normalized;
}

/** 卡片显示词：优先 text，批次文件用 word。 */
export function getCardText(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  for (const key of ['text', 'word']) {
    if (typeof raw[key] === 'string' && raw[key].trim()) return raw[key].trim();
  }
  return '';
}

export function looksLikeCard(raw) {
  return Boolean(getCardText(raw));
}

export function normalizeCard(raw, { source = '(未知来源)', index = 0 } = {}) {
  const word = getCardText(raw);
  if (!word) throw new Error('缺少非空的 text/word');

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '',
    word,
    meaning: typeof raw.meaning === 'string' ? raw.meaning : '',
    sentence: typeof raw.sentence === 'string' ? raw.sentence : '',
    alt:
      (typeof raw.image?.alt === 'string' && raw.image.alt) ||
      (typeof raw.image_alt === 'string' && raw.image_alt) ||
      (typeof raw.alt === 'string' && raw.alt) ||
      '',
    source,
    index,
  };
}

/**
 * 同一 id 且同一个词，视为同一张卡的副本，只保留先读到的一张；
 * 同一 id 但词不同，说明拿错了版本，直接报错而不是悄悄算错。
 * 没有 id 的临时卡片不参与去重。
 */
export function dedupeCards(cards, { dedupe = true } = {}) {
  if (!dedupe) return { cards: [...cards], duplicates: [] };

  const byId = new Map();
  const unique = [];
  const duplicates = [];

  for (const card of cards) {
    if (!card.id) {
      unique.push(card);
      continue;
    }

    const kept = byId.get(card.id);
    if (!kept) {
      byId.set(card.id, card);
      unique.push(card);
      continue;
    }

    if (kept.word !== card.word) {
      throw new Error(
        `卡片 id 冲突：${card.id} 在 ${kept.source} 第 ${kept.index + 1} 条是「${kept.word}」，` +
          `在 ${card.source} 第 ${card.index + 1} 条是「${card.word}」；请只保留一个版本。`,
      );
    }

    duplicates.push({
      id: card.id,
      word: card.word,
      kept: kept.source,
      skipped: card.source,
    });
  }

  return { cards: unique, duplicates };
}

function fieldValue(card, field) {
  if (field === 'text') return card.word;
  if (field === 'meaning') return card.meaning;
  if (field === 'sentence') return card.sentence;
  if (field === 'alt') return card.alt;
  return '';
}

/**
 * 统计每张卡选定字段里的单字。
 *
 * count       出现次数（同一张卡同一字段里出现两次算两次）
 * cardCount   包含这个字的卡片张数（同一张卡只算一次）
 * firstSeen   第一次遇到这个字的顺序，用于同频排序
 * firstCard   第一次遇到这个字时那张卡的目标词
 */
export function countCards(cards, { fields = ['text'], includeNonHan = false } = {}) {
  const normalizedFields = normalizeFields(fields);
  const stats = new Map();
  let totalOccurrences = 0;
  let skippedNonHan = 0;
  let sequence = 0;

  for (const card of cards) {
    const cardCharacters = new Set();

    for (const field of normalizedFields) {
      const value = fieldValue(card, field);
      if (!value) continue;

      skippedNonHan += countSkippedNonHan(value, { includeNonHan });
      for (const char of extractCharacters(value, { includeNonHan })) {
        let entry = stats.get(char);
        if (!entry) {
          entry = {
            char,
            count: 0,
            cardCount: 0,
            firstSeen: sequence,
            firstCard: card.word,
          };
          sequence += 1;
          stats.set(char, entry);
        }
        entry.count += 1;
        totalOccurrences += 1;
        cardCharacters.add(char);
      }
    }

    for (const char of cardCharacters) {
      stats.get(char).cardCount += 1;
    }
  }

  return {
    entries: [...stats.values()],
    cards: cards.length,
    uniqueChars: stats.size,
    totalOccurrences,
    skippedNonHan,
    fields: normalizedFields,
  };
}

export function sortFrequency(entries) {
  return [...entries].sort(
    (a, b) =>
      b.count - a.count ||
      b.cardCount - a.cardCount ||
      a.firstSeen - b.firstSeen ||
      (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0),
  );
}

export function selectFrequency(entries, { min = 1, top = 0 } = {}) {
  const filtered = entries.filter((entry) => entry.count >= min);
  return top > 0 ? filtered.slice(0, top) : filtered;
}

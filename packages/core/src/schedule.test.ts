import { describe, expect, it } from 'vitest';
import {
  completeCard,
  createInitialProgress,
  ensureSession,
  findFinishedSessionToday,
  intervalForSeen,
  learningOrder,
  localDateKey,
  normalizeProgress,
  pickSessionCards,
  startAnotherSession,
} from './index.js';
import type { Card, SceneId } from './types.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 22, 9, 0, 0).getTime(); // 本地时间 2026-10-22 09:00

let cardOrder = 0;

function card(id: string, scene: SceneId, level: 1 | 2 = 1): Card {
  return {
    id,
    text: '字',
    chars: ['字'],
    pinyin: ['zì'],
    level,
    scene,
    meaning: '一个字',
    meaning_source: { dict: 'self', entry: id },
    sentence: '这是一个字。',
    image: { file: 'x.svg', lib: 'self', license: 'CC-BY-SA-4.0' },
    status: 'draft',
    gen: { model: 'human', prompt_ver: 'seed@0', hash: 'seed' },
    order: cardOrder++,
  };
}

const deck: Card[] = [
  card('h1', 'health'),
  card('h2', 'health'),
  card('h3', 'health'),
  card('h4', 'health'),
  card('m1', 'money'),
  card('m2', 'money'),
  card('s1', 'safety'),
  card('t1', 'travel'),
];

describe('learning order', () => {
  it('keeps the editorial order within a scene and starts with health', () => {
    const shuffled = [deck[2]!, deck[0]!, deck[4]!, deck[1]!];
    expect(learningOrder(shuffled).map((item) => item.id)).toEqual(['h1', 'h2', 'h3', 'm1']);
  });
});

describe('session picking', () => {
  it('picks exactly three new cards in learning order', () => {
    const progress = createInitialProgress();
    const picked = pickSessionCards(deck, progress, NOW);
    expect(picked.map((item) => item.id)).toEqual(['h1', 'h2', 'h3']);
  });

  it('does not pad a short new-card batch with reviews', () => {
    const progress = createInitialProgress();
    progress.cards['h4'] = {
      cardId: 'h4',
      seen: 1,
      lastSeenAt: NOW - DAY,
      dueAt: NOW - 1,
      intervalDays: 1,
    };
    // h1/h2 已被学过，只剩 h3 是新卡；复习最多 1 张，不凑满 3 张。
    progress.cards['h1'] = { cardId: 'h1', seen: 1, lastSeenAt: NOW - DAY, dueAt: NOW + DAY, intervalDays: 1 };
    progress.cards['h2'] = { cardId: 'h2', seen: 1, lastSeenAt: NOW - DAY, dueAt: NOW + DAY, intervalDays: 1 };
    const picked = pickSessionCards([deck[0]!, deck[1]!, deck[2]!, deck[3]!], progress, NOW);
    expect(picked.map((item) => item.id)).toEqual(['h3', 'h4']);
  });

  it('resumes the same session on the same day', () => {
    const progress = createInitialProgress();
    const first = ensureSession(deck, progress, NOW);
    const second = ensureSession(deck, first.progress, NOW + 60_000);
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.cardIds).toEqual(first.session.cardIds);
  });

  it('starts a new session on a new day', () => {
    const progress = createInitialProgress();
    const first = ensureSession(deck, progress, NOW);
    const second = ensureSession(deck, first.progress, NOW + DAY);
    expect(second.created).toBe(true);
    expect(second.session.id).not.toBe(first.session.id);
  });
});

describe('completion', () => {
  it('marks the session finished and schedules the card for tomorrow', () => {
    const started = ensureSession(deck, createInitialProgress(), NOW);
    let progress = started.progress;
    const session = started.session;
    for (const id of session.cardIds) progress = completeCard(progress, id, NOW + 1000);

    expect(progress.session?.completedIds).toEqual(session.cardIds);
    expect(progress.session?.finishedAt).toBe(NOW + 1000);
    expect(progress.stats.sessionsFinished).toBe(1);
    expect(progress.stats.cardsFinished).toBe(3);
    expect(progress.cards['h1']?.intervalDays).toBe(1);
    expect(progress.cards['h1']?.dueAt).toBe(NOW + 1000 + DAY);
    expect(findFinishedSessionToday(progress, NOW + 2000)?.id).toBe(session.id);
  });

  it('does not double count a card completed twice', () => {
    const started = ensureSession(deck, createInitialProgress(), NOW);
    let progress = started.progress;
    const session = started.session;
    const id = session.cardIds[0]!;
    progress = completeCard(progress, id, NOW);
    progress = completeCard(progress, id, NOW);
    expect(progress.stats.cardsFinished).toBe(1);
    expect(progress.session?.completedIds).toEqual([id]);
  });

  it('grows intervals gently with repeated exposure', () => {
    expect(intervalForSeen(1)).toBe(1);
    expect(intervalForSeen(2)).toBe(3);
    expect(intervalForSeen(3)).toBe(7);
    expect(intervalForSeen(99)).toBe(60);
  });

  it('can start another batch on the same day', () => {
    const started = ensureSession(deck, createInitialProgress(), NOW);
    let progress = started.progress;
    for (const id of started.session.cardIds) progress = completeCard(progress, id, NOW);
    const next = startAnotherSession(deck, progress, NOW + 5000);
    expect(next.session.id).not.toBe(started.session.id);
    expect(next.session.cardIds).not.toContain('h1');
  });
});

describe('defensive storage', () => {
  it('returns defaults for garbage', () => {
    expect(normalizeProgress(null)).toEqual(createInitialProgress());
    expect(normalizeProgress('nope')).toEqual(createInitialProgress());
    expect(normalizeProgress({ cards: { a: { seen: 'x' } } }).cards).toEqual({});
  });

  it('repairs a partial record and clamps the rate', () => {
    const fixed = normalizeProgress({
      onboarded: true,
      cards: { h1: { seen: 2, dueAt: 123, lastSeenAt: 100, intervalDays: 3 } },
      settings: { rate: 99, showPinyin: true, textScale: 'huge', voiceName: 42 },
      stats: { cardsFinished: -4 },
    });
    expect(fixed.onboarded).toBe(true);
    expect(fixed.cards['h1']?.cardId).toBe('h1');
    expect(fixed.settings.rate).toBe(1.2);
    expect(fixed.settings.showPinyin).toBe(true);
    expect(fixed.settings.textScale).toBe('normal');
    expect(fixed.settings.voiceName).toBeNull();
    expect(fixed.stats.cardsFinished).toBe(0);
  });

  it('drops an invalid saved session instead of crashing the learn page', () => {
    const fixed = normalizeProgress({
      session: { id: 'x', date: '2026-10-22', cardIds: 'nope', completedIds: [] },
    });
    expect(fixed.session).toBeNull();
  });

  it('uses a local calendar date, not UTC', () => {
    const lateNight = new Date(2026, 9, 22, 23, 30, 0).getTime();
    expect(localDateKey(lateNight)).toBe('2026-10-22');
  });
});

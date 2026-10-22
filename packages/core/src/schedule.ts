import {
  DEFAULT_SETTINGS,
  SCENE_ORDER,
  type Card,
  type DailySession,
  type ProgressState,
  type UserSettings,
} from './types.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const NEW_CARDS_PER_SESSION = 3;
export const MAX_REVIEWS_PER_SESSION = 3;

export function localDateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialProgress(): ProgressState {
  return {
    version: 1,
    onboarded: false,
    cards: {},
    session: null,
    lastSessionDate: null,
    settings: { ...DEFAULT_SETTINGS },
    stats: { sessionsFinished: 0, cardsFinished: 0 },
  };
}

/** 1 → 1 天，2 → 3 天，3 → 7 天……温和的间隔重复，不做对错考试。 */
export function intervalForSeen(seen: number): number {
  const table = [1, 3, 7, 14, 30, 60];
  const index = Math.min(Math.max(seen, 1), table.length) - 1;
  return table[index] ?? 60;
}

/**
 * 场景顺序优先；同一场景内保留内容编辑在 YAML 里排好的教学顺序，
 * 只把更基础的 level 放前面。不要按 id 排序——那会把“药、医院、挂号”
 * 打乱成字母序。
 */
export function learningOrder(cards: Card[]): Card[] {
  const sceneRank = new Map(SCENE_ORDER.map((id, index) => [id, index]));
  const sourceRank = new Map(cards.map((card, index) => [card.id, card.order ?? index]));
  return [...cards].sort((a, b) => {
    const sceneA = sceneRank.get(a.scene) ?? 99;
    const sceneB = sceneRank.get(b.scene) ?? 99;
    if (sceneA !== sceneB) return sceneA - sceneB;
    if (a.level !== b.level) return a.level - b.level;
    return (sourceRank.get(a.id) ?? 0) - (sourceRank.get(b.id) ?? 0);
  });
}

function isActiveSession(session: DailySession | null, now: number): session is DailySession {
  return Boolean(
    session &&
      session.date === localDateKey(now) &&
      session.completedIds.length < session.cardIds.length,
  );
}

/**
 * 选择这一次要认的 3 个新字，再加最多 3 张到期的复习卡。
 * 新卡按场景顺序取，保证第一次打开是“看病”场景，语义有上下文。
 */
export function pickSessionCards(
  cards: Card[],
  progress: ProgressState,
  now: number = Date.now(),
): Card[] {
  const ordered = learningOrder(cards);
  const fresh = ordered.filter((card) => !progress.cards[card.id]);
  const due = ordered
    .filter((card) => {
      const memory = progress.cards[card.id];
      return Boolean(memory && memory.dueAt <= now);
    })
    .sort((a, b) => (progress.cards[a.id]?.dueAt ?? 0) - (progress.cards[b.id]?.dueAt ?? 0));

  const picked: Card[] = [];
  for (const card of fresh.slice(0, NEW_CARDS_PER_SESSION)) picked.push(card);

  // 每次最多 3 张复习。新卡不足 3 张时也不拿复习凑满——不制造压力。
  for (const card of due.slice(0, MAX_REVIEWS_PER_SESSION)) {
    if (!picked.some((item) => item.id === card.id)) picked.push(card);
  }

  if (picked.length === 0) {
    // 全部学完、也还没有到期：给三张最久没看的，保持手感。
    const stale = [...ordered].sort((a, b) => {
      const lastA = progress.cards[a.id]?.lastSeenAt ?? 0;
      const lastB = progress.cards[b.id]?.lastSeenAt ?? 0;
      return lastA - lastB;
    });
    picked.push(...stale.slice(0, NEW_CARDS_PER_SESSION));
  }

  return picked;
}

/**
 * 保证当前有一个可用的会话：
 * - 今天还没完成的会话，原样续上；
 * - 今天已完成，返回它（界面展示“今天认完了”）；
 * - 没有今天的会话，新建一个。
 */
export function ensureSession(
  cards: Card[],
  progress: ProgressState,
  now: number = Date.now(),
): { progress: ProgressState; session: DailySession; created: boolean } {
  const date = localDateKey(now);
  if (progress.session && progress.session.date === date) {
    return { progress, session: progress.session, created: false };
  }

  const picked = pickSessionCards(cards, progress, now);
  const session: DailySession = {
    id: `session-${now}`,
    date,
    cardIds: picked.map((card) => card.id),
    completedIds: [],
    startedAt: now,
  };

  return {
    progress: { ...progress, session, lastSessionDate: date },
    session,
    created: true,
  };
}

/** 今天完成过的会话；用于重新打开时直接看到“认完了”，而不是又开一批新卡。 */
export function findFinishedSessionToday(
  progress: ProgressState,
  now: number = Date.now(),
): DailySession | null {
  const session = progress.session;
  if (
    session &&
    session.date === localDateKey(now) &&
    session.completedIds.length >= session.cardIds.length &&
    session.cardIds.length > 0
  ) {
    return session;
  }
  return null;
}

export function activeSession(progress: ProgressState, now: number = Date.now()): DailySession | null {
  return isActiveSession(progress.session, now) ? progress.session : null;
}

/** 开始“再认三个”：保留历史，替换当前会话。 */
export function startAnotherSession(
  cards: Card[],
  progress: ProgressState,
  now: number = Date.now(),
): { progress: ProgressState; session: DailySession } {
  const picked = pickSessionCards(cards, progress, now);
  const session: DailySession = {
    id: `session-${now}`,
    date: localDateKey(now),
    cardIds: picked.map((card) => card.id),
    completedIds: [],
    startedAt: now,
  };
  return {
    progress: {
      ...progress,
      session,
      lastSessionDate: session.date,
    },
    session,
  };
}

/**
 * 一张卡听完、按下“下一个”后调用。
 * 不记录对错，只记录“见过”，并排到 1/3/7/14/30 天后。
 */
export function completeCard(
  progress: ProgressState,
  cardId: string,
  now: number = Date.now(),
): ProgressState {
  const previous = progress.cards[cardId];
  const seen = (previous?.seen ?? 0) + 1;
  const intervalDays = intervalForSeen(seen);
  const memory = {
    cardId,
    seen,
    lastSeenAt: now,
    dueAt: now + intervalDays * DAY_MS,
    intervalDays,
  };

  const session = progress.session;
  if (!session || !session.cardIds.includes(cardId)) {
    return {
      ...progress,
      cards: { ...progress.cards, [cardId]: memory },
      stats: { ...progress.stats, cardsFinished: progress.stats.cardsFinished + 1 },
    };
  }

  const alreadyCompleted = session.completedIds.includes(cardId);
  const completedIds = alreadyCompleted ? session.completedIds : [...session.completedIds, cardId];
  const finished = completedIds.length >= session.cardIds.length;
  const nextSession: DailySession = {
    ...session,
    completedIds,
    ...(finished && !session.finishedAt ? { finishedAt: now } : {}),
  };

  return {
    ...progress,
    cards: { ...progress.cards, [cardId]: memory },
    session: nextSession,
    stats: {
      sessionsFinished:
        progress.stats.sessionsFinished +
        (finished && !session.finishedAt ? 1 : 0),
      cardsFinished:
        progress.stats.cardsFinished + (alreadyCompleted ? 0 : 1),
    },
  };
}

export function updateSettings(progress: ProgressState, patch: Partial<UserSettings>): ProgressState {
  return {
    ...progress,
    settings: {
      ...progress.settings,
      ...patch,
      rate: clamp(patch.rate ?? progress.settings.rate, 0.5, 1.2),
    },
  };
}

export function markOnboarded(progress: ProgressState): ProgressState {
  return { ...progress, onboarded: true };
}

export function learnedCards(progress: ProgressState): string[] {
  return Object.values(progress.cards)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .map((memory) => memory.cardId);
}

export function dueCount(progress: ProgressState, now: number = Date.now()): number {
  return Object.values(progress.cards).filter((memory) => memory.dueAt <= now).length;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 防御 localStorage 里的旧数据/手改数据，缺字段一律补默认值。 */
export function normalizeProgress(raw: unknown): ProgressState {
  const base = createInitialProgress();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<ProgressState>;

  const cards: ProgressState['cards'] = {};
  if (data.cards && typeof data.cards === 'object') {
    for (const [id, value] of Object.entries(data.cards)) {
      if (!value || typeof value !== 'object') continue;
      const memory = value as Partial<ProgressState['cards'][string]>;
      if (typeof memory.seen !== 'number' || typeof memory.dueAt !== 'number') continue;
      cards[id] = {
        cardId: id,
        seen: Math.max(1, Math.round(memory.seen)),
        lastSeenAt: Number(memory.lastSeenAt) || 0,
        dueAt: Number(memory.dueAt) || 0,
        intervalDays: Number(memory.intervalDays) || 1,
      };
    }
  }

  const session =
    data.session &&
    typeof data.session === 'object' &&
    typeof data.session.id === 'string' &&
    typeof data.session.date === 'string' &&
    Array.isArray(data.session.cardIds) &&
    data.session.cardIds.every((id) => typeof id === 'string') &&
    Array.isArray(data.session.completedIds) &&
    data.session.completedIds.every((id) => typeof id === 'string')
      ? {
          id: data.session.id,
          date: data.session.date,
          cardIds: data.session.cardIds,
          completedIds: data.session.completedIds,
          startedAt: Number(data.session.startedAt) || 0,
          ...(typeof data.session.finishedAt === 'number'
            ? { finishedAt: data.session.finishedAt }
            : {}),
        }
      : null;

  const rawSettings = (
    data.settings && typeof data.settings === 'object' ? data.settings : {}
  ) as Partial<UserSettings>;
  const settings = {
    rate: clamp(Number(rawSettings.rate ?? DEFAULT_SETTINGS.rate), 0.5, 1.2),
    showPinyin: rawSettings.showPinyin === true,
    textScale: rawSettings.textScale === 'large' ? ('large' as const) : ('normal' as const),
    voiceName: typeof rawSettings.voiceName === 'string' ? rawSettings.voiceName : null,
  };

  return {
    ...base,
    onboarded: Boolean(data.onboarded),
    cards,
    session,
    lastSessionDate: typeof data.lastSessionDate === 'string' ? data.lastSessionDate : null,
    settings,
    stats: {
      sessionsFinished: Math.max(0, Number(data.stats?.sessionsFinished) || 0),
      cardsFinished: Math.max(0, Number(data.stats?.cardsFinished) || 0),
    },
  };
}

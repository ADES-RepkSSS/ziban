/**
 * 字伴核心类型。
 *
 * 纪律：core 不依赖 DOM、React、网络或任何平台 API，
 * 这样同一套学习与内容逻辑可以同时跑在 Web、Electron、测试里。
 */

export const SCENE_IDS = [
  'health',
  'money',
  'travel',
  'home',
  'contact',
  'gov',
  'shopping',
  'safety',
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneMeta {
  id: SceneId;
  /** 面向老人的场景名，尽量短、口语。 */
  name: string;
  /** 卡片筛选条上的短名。 */
  short: string;
  description: string;
}

/** 顺序即“每天三个字”的默认学习顺序：先救命，再日常。 */
export const SCENE_META: Record<SceneId, SceneMeta> = {
  health: { id: 'health', name: '看病买药', short: '看病', description: '挂号、医生、药、医保' },
  money: { id: 'money', name: '取钱转账', short: '取钱', description: '取钱、密码、转账、确认' },
  travel: { id: 'travel', name: '出门坐车', short: '出门', description: '公交、地铁、上车、扫码' },
  home: { id: 'home', name: '家里使用', short: '家里', description: '开关、大小、声音、温度' },
  contact: { id: 'contact', name: '联系家人', short: '联系', description: '微信、电话、语音、消息' },
  gov: { id: 'gov', name: '办事', short: '办事', description: '身份证、社保、窗口、提交' },
  shopping: { id: 'shopping', name: '买东西', short: '买东西', description: '付款、多少钱、打折、买' },
  safety: { id: 'safety', name: '防骗', short: '防骗', description: '验证码、中奖、免费、挂断' },
};

export const SCENE_ORDER: SceneId[] = [
  'health',
  'money',
  'safety',
  'contact',
  'home',
  'travel',
  'gov',
  'shopping',
];

export type CardLevel = 1 | 2 | 3;
export type CardStatus = 'draft' | 'machine_ok' | 'human_ok' | 'published' | 'retired';

export interface MeaningSource {
  dict: 'zhwiktionary' | 'cc-cedict' | 'self';
  entry: string;
  rev?: string;
}

export interface SentenceSource {
  corpus: 'health_faq' | 'gov_site' | 'oss_docs' | 'volunteer_cc0' | 'self';
  doc?: string;
}

export interface CardImage {
  file: string;
  lib: string;
  license: string;
  alt?: string;
  candidates?: string[];
}

export interface CardReview {
  redteam?: { pass?: boolean; rounds?: number; last?: string };
  human?: { by: string; at?: string; note?: string };
}

export interface CardGen {
  model: string;
  prompt_ver: string;
  hash: string;
}

export interface Card {
  id: string;
  text: string;
  chars: string[];
  pinyin: string[];
  level: CardLevel;
  scene: SceneId;
  meaning: string;
  meaning_source: MeaningSource;
  sentence?: string;
  sentence_source?: SentenceSource;
  image: CardImage;
  confusables?: string[];
  status: CardStatus;
  review?: CardReview;
  gen: CardGen;
  /** 构建时由 content pipeline 注入，指向 public 下的图片。 */
  imageUrl?: string;
  /** 构建时注入的 YAML 顺序，保证换一种排序输入也能还原编辑顺序。 */
  order?: number;
}

export interface CardDeck {
  version: number;
  cards: Card[];
  /** 内容构建时间只用于诊断，不参与渲染。 */
  builtAt?: string;
}

export interface CardMemory {
  cardId: string;
  seen: number;
  lastSeenAt: number;
  dueAt: number;
  intervalDays: number;
}

export interface DailySession {
  id: string;
  date: string;
  cardIds: string[];
  completedIds: string[];
  startedAt: number;
  finishedAt?: number;
}

export interface UserSettings {
  /** 朗读速度倍率，0.5–1.2。默认偏慢。 */
  rate: number;
  /** 拼音只给家人/志愿者看，默认关闭。 */
  showPinyin: boolean;
  textScale: 'normal' | 'large';
  /** 选中的中文语音名称；null 表示自动选择。 */
  voiceName: string | null;
}

export interface ProgressState {
  version: 1;
  onboarded: boolean;
  cards: Record<string, CardMemory>;
  session: DailySession | null;
  lastSessionDate: string | null;
  settings: UserSettings;
  stats: {
    sessionsFinished: number;
    cardsFinished: number;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  rate: 0.85,
  showPinyin: false,
  textScale: 'normal',
  voiceName: null,
};

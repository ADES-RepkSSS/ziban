/**
 * 本机词表：字伴的 50 张字卡 + 离线口语词表 + 常见界面词 + pinyin-pro。
 *
 * 设计目标：
 * - 不联网就能解释“验证码、余额、窗口、下载、验证码……”这些屏幕高频词；
 * - 单字至少能显示拼音（用 pinyin-pro，MIT，离线），不会出现“只会念却连拼音都没有”；
 * - 释义只用本机内容；没把握时 definition=null，让大模型或 UI 的“只会念”兜底。
 *
 * 以后爬虫/语料库产出的词条，不要塞进这个文件；走 corpus.ts 的 JSON 文件，
 * 这样内容可独立更新、可审校、可替换，不重新打包。
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pinyin as toPinyin } from 'pinyin-pro';
import {
  emptyKnowledge,
  isCjk,
  makeKnowledge,
  PLAIN_TERMS,
  sanitizePinyin,
  type Card,
  type CardDeck,
  type WordKnowledge,
} from '@ziban/core';

export interface LocalLexiconOptions {
  appPath: string;
  resourcesPath?: string;
  envDeckPath?: string;
  onLog?: (message: string) => void;
}

export interface LocalLexiconStats {
  cards: number;
  terms: number;
  deckLoaded: boolean;
  warning: string | null;
}

/**
 * 屏幕/界面高频词。全部是项目组按日常口语手写的原型内容（source: self），
 * 不是从词典/语料库抄的；需要走内容审校后才能算正式内容。
 *
 * 只收“老人在屏幕上会看到、但字卡还没教”的词；不要在这里堆成语/文学词。
 */
const SCREEN_TERMS: Array<{ term: string; plain: string }> = [
  { term: '确定', plain: '看好了，就按这个。' },
  { term: '关闭', plain: '把这个窗口收起来。' },
  { term: '打开', plain: '点一下，让它出来。' },
  { term: '保存', plain: '把改好的东西存起来。' },
  { term: '删除', plain: '把这个东西去掉。' },
  { term: '返回', plain: '回到上一个地方。' },
  { term: '下一步', plain: '接着往下走。' },
  { term: '上一步', plain: '回到前面一步。' },
  { term: '登录', plain: '输入名字和密码，进自己的页面。' },
  { term: '注册', plain: '第一次用，给自己开一个账号。' },
  { term: '账号', plain: '你在软件里的名字。' },
  { term: '下载', plain: '把网上的东西存到电脑里。' },
  { term: '安装', plain: '把软件放进电脑，让它能用。' },
  { term: '更新', plain: '换成新的版本。' },
  { term: '设置', plain: '调声音、字大小的地方。' },
  { term: '通知', plain: '提醒你的一条消息。' },
  { term: '文件', plain: '电脑里存的一份东西。' },
  { term: '文件夹', plain: '放文件的地方。' },
  { term: '网络', plain: '让电脑连上外面。' },
  { term: '连接', plain: '让两个东西接上。' },
  { term: '复制', plain: '把字先存到一边。' },
  { term: '粘贴', plain: '把刚复制的字放到这里。' },
  { term: '搜索', plain: '找东西。' },
  { term: '帮助', plain: '告诉你怎么用。' },
  { term: '退出', plain: '关掉这个软件。' },
  { term: '同意', plain: '说“可以”。' },
  { term: '拒绝', plain: '说“不可以”。' },
  { term: '稍后', plain: '等一会儿再说。' },
  { term: '继续', plain: '接着做。' },
  { term: '支付', plain: '把钱付出去。' },
  { term: '收款', plain: '把钱收进来。' },
  { term: '订单', plain: '你买东西的记录。' },
  { term: '收货地址', plain: '东西送到哪里。' },
  { term: '输入', plain: '把字打进去。' },
  { term: '输入框', plain: '可以打字的白框。' },
  { term: '按钮', plain: '按一下就能做事的地方。' },
  { term: '菜单', plain: '一列可以选的东西。' },
  { term: '图标', plain: '代表一个功能的小图。' },
  { term: '桌面', plain: '电脑打开后的主屏幕。' },
  { term: '回收站', plain: '删掉的东西先放这里。' },
  { term: '重启', plain: '关掉再打开。' },
  { term: '关机', plain: '把电脑关掉。' },
  { term: '卸载', plain: '把软件从电脑里去掉。' },
  { term: '病毒', plain: '会弄坏电脑的坏程序。' },
  { term: '隐私', plain: '不想让别人知道的事。' },
  { term: '权限', plain: '让不让软件做一件事。' },
  { term: '用户名', plain: '你在软件里的名字。' },
  { term: '手机号', plain: '你的手机号码。' },
  { term: '验证', plain: '看看是不是真的。' },
  { term: '点击', plain: '用手指或鼠标按一下。' },
  { term: '双击', plain: '连着按两下。' },
  { term: '音量', plain: '声音有多大。' },
  { term: '静音', plain: '让声音暂时不响。' },
  { term: '亮度', plain: '屏幕有多亮。' },
  { term: '充电', plain: '给电脑或手机补电。' },
  { term: '电量', plain: '还剩多少电。' },
  { term: '无线网', plain: '不用线就能上的网。' },
  { term: '银行卡', plain: '存钱取钱用的卡。' },
  { term: '存钱', plain: '把钱放进银行。' },
  { term: '取钱', plain: '把银行里的钱拿出来。' },
  { term: '手续费', plain: '办事要交的一点钱。' },
  { term: '到账', plain: '钱已经到了。' },
  { term: '退款', plain: '把钱退回来。' },
  { term: '预约', plain: '先定好时间。' },
  { term: '排队', plain: '按顺序等着。' },
  { term: '护士', plain: '帮医生照顾病人的人。' },
  { term: '说明书', plain: '讲怎么用的一张纸。' },
  { term: '剂量', plain: '一次吃多少。' },
  { term: '副作用', plain: '吃了药以后不舒服。' },
  { term: '过敏', plain: '身体对一样东西受不了。' },
  { term: '血压', plain: '血在身体里推的力量。' },
  { term: '体温', plain: '身体有多热。' },
  { term: '发烧', plain: '身体比平常热。' },
  { term: '急诊', plain: '很急的病，马上看。' },
  { term: '柜台', plain: '办事的桌子。' },
  { term: '号码', plain: '排队或找人用的数字。' },
  { term: '退休', plain: '不上班了，领养老金。' },
  { term: '养老金', plain: '老了以后每月领的钱。' },
  { term: '居委会', plain: '管小区事情的地方。' },
  { term: '物业', plain: '管小区维修的人。' },
  { term: '电梯', plain: '上下楼的箱子。' },
  { term: '楼梯', plain: '一层层上下的台阶。' },
  { term: '站台', plain: '等车的地方。' },
  { term: '乘车码', plain: '坐车用的二维码。' },
  { term: '打车', plain: '叫一辆车来。' },
  { term: '司机', plain: '开车的人。' },
  { term: '路线', plain: '车要走的道。' },
  { term: '红绿灯', plain: '管车停走的小灯。' },
  { term: '斑马线', plain: '过马路的地方。' },
  { term: '语音', plain: '说话的声音。' },
  { term: '视频', plain: '能看见人的通话。' },
  { term: '朋友圈', plain: '朋友发消息的地方。' },
  { term: '拉黑', plain: '不让一个人再发消息。' },
  { term: '扫一扫', plain: '用手机照一下二维码。' },
  { term: '付款码', plain: '买东西给别人扫的码。' },
  { term: '钱包', plain: '放钱的地方。' },
  { term: '零钱', plain: '一点一点的钱。' },
  { term: '提现', plain: '把钱从手机里拿出来。' },
  { term: '绑定', plain: '把卡和手机连起来。' },
  { term: '解绑', plain: '把连好的东西分开。' },
  { term: '网页', plain: '电脑上能看的一页内容。' },
  { term: '浏览器', plain: '用来看网页的软件。' },
  { term: '提醒', plain: '到时间告诉你。' },
  { term: '日历', plain: '记日子的地方。' },
  { term: '闹钟', plain: '到点会响的钟。' },
];

function pinyinOf(text: string): string | null {
  const cjk = Array.from(text).filter((char) => isCjk(char)).join('');
  if (!cjk) return null;
  try {
    const result = toPinyin(cjk, {
      toneType: 'symbol',
      type: 'string',
      separator: ' ',
      nonZh: 'removed',
    });
    return sanitizePinyin(result);
  } catch {
    return null;
  }
}

function readDeck(paths: string[]): { cards: Card[]; path: string | null } {
  for (const candidate of paths) {
    if (!candidate || !existsSync(candidate)) continue;
    try {
      const raw = JSON.parse(readFileSync(candidate, 'utf8')) as CardDeck;
      if (Array.isArray(raw.cards)) return { cards: raw.cards, path: candidate };
    } catch {
      // 换下一个候选路径。
    }
  }
  return { cards: [], path: null };
}

export class LocalLexicon {
  private readonly entries = new Map<string, WordKnowledge>();
  private readonly charPinyin = new Map<string, string>();
  readonly maxWordLength: number;
  readonly stats: LocalLexiconStats;

  constructor(cards: Card[], deckPath: string | null, onLog?: (message: string) => void) {
    const now = Date.now();

    for (const card of cards) {
      if (typeof card.text !== 'string' || !card.text.trim()) continue;
      const chars = Array.isArray(card.chars) ? card.chars : Array.from(card.text);
      const pinyins = Array.isArray(card.pinyin) ? card.pinyin : [];
      chars.forEach((char, index) => {
        const py = pinyins[index];
        if (py && !this.charPinyin.has(char)) this.charPinyin.set(char, py);
      });

      const fullPinyin = pinyins.length > 0 ? pinyins.join(' ') : pinyinOf(card.text);
      this.entries.set(card.text, {
        word: card.text,
        pinyin: sanitizePinyin(fullPinyin ?? ''),
        definition: typeof card.meaning === 'string' ? card.meaning : null,
        example: typeof card.sentence === 'string' ? card.sentence : null,
        source: 'card',
        sourceLabel: '本机字卡',
        generated: false,
        confidence: 'high',
        updatedAt: now,
      });
    }

    const addTerm = (term: string, plain: string): void => {
      if (!term || this.entries.has(term)) return; // 字卡优先，不覆盖人工内容
      this.entries.set(term, {
        word: term,
        pinyin: pinyinOf(term),
        definition: plain,
        example: null,
        source: 'glossary',
        sourceLabel: '本机词表',
        generated: false,
        confidence: 'medium',
        updatedAt: now,
      });
    };

    for (const item of PLAIN_TERMS) addTerm(item.term, item.plain);
    for (const item of SCREEN_TERMS) addTerm(item.term, item.plain);

    let maxWordLength = 2;
    for (const word of this.entries.keys()) {
      maxWordLength = Math.max(maxWordLength, Array.from(word).length);
    }
    this.maxWordLength = Math.min(8, maxWordLength);
    this.stats = {
      cards: cards.length,
      terms: this.entries.size,
      deckLoaded: Boolean(deckPath),
      warning: deckPath
        ? null
        : '没找到字卡内容，只能先用本机词表和拼音。请让家里人运行 pnpm content:build。',
    };

    onLog?.(
      deckPath
        ? `本机词表加载：${cards.length} 张字卡 + ${this.entries.size - cards.length} 个词条（${deckPath}）`
        : '本机字卡没找到；仍可用离线词表。',
    );
  }

  has(word: string): boolean {
    return this.entries.has(word);
  }

  get size(): number {
    return this.entries.size;
  }

  /** 取一条知识；未知词至少给拼音，绝不给编造的释义。 */
  getKnowledge(word: string): WordKnowledge {
    const entry = this.entries.get(word);
    if (entry) {
      return {
        ...entry,
        pinyin: entry.pinyin ?? this.pinyinFor(word),
        updatedAt: Date.now(),
      };
    }

    const pinyin = this.pinyinFor(word);
    if (pinyin) {
      return makeKnowledge(word, {
        pinyin,
        source: 'none',
        sourceLabel: '本机拼音',
        confidence: 'low',
      });
    }

    return emptyKnowledge(word);
  }

  pinyinFor(text: string): string | null {
    const entry = this.entries.get(text);
    if (entry?.pinyin) return entry.pinyin;

    const fromCards = Array.from(text)
      .map((char) => this.charPinyin.get(char) ?? null)
      .filter((value): value is string => Boolean(value));
    if (fromCards.length > 0 && fromCards.length === Array.from(text).length) {
      return sanitizePinyin(fromCards.join(' '));
    }

    return pinyinOf(text);
  }

  /** 给单测/调试用；返回词表里所有词，不要在 UI 每帧调用。 */
  words(): string[] {
    return Array.from(this.entries.keys());
  }
}

export function loadLocalLexicon(options: LocalLexiconOptions): LocalLexicon {
  const candidates = [
    options.envDeckPath ?? '',
    path.join(options.appPath, 'apps/web/src/content/cards.generated.json'),
    path.join(options.appPath, 'resources/cards.generated.json'),
    options.resourcesPath ? path.join(options.resourcesPath, 'cards.generated.json') : '',
    path.join(__dirname, '..', '..', '..', 'resources', 'cards.generated.json'),
  ];
  const deck = readDeck(candidates);
  return new LocalLexicon(deck.cards, deck.path, options.onLog);
}

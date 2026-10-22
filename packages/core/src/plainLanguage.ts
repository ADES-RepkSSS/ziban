/**
 * 离线“讲一讲”：把办事/银行/手机里常见的书面词，换成老人听得懂的口语。
 *
 * 这不是大模型，也不假装是。它只解释词表里确实有的词；遇到没把握的句子，
 * 明确说“只会念，讲不好”，绝不编。以后接入本地模型时，保持同样的接口。
 */

export interface PlainTerm {
  term: string;
  plain: string;
  kind: 'action' | 'object' | 'official' | 'warning';
}

export const PLAIN_TERMS: PlainTerm[] = [
  { term: '验证码', plain: '手机上收到的一串数字，只能自己用。', kind: 'warning' },
  { term: '转账', plain: '把钱从你的卡里送到别人的卡里。', kind: 'action' },
  { term: '冻结账户', plain: '你的钱暂时不能用了。', kind: 'warning' },
  { term: '冻结', plain: '暂时不能用了。', kind: 'warning' },
  { term: '账户', plain: '你在银行存钱的地方。', kind: 'object' },
  { term: '余额', plain: '卡里还剩多少钱。', kind: 'object' },
  { term: '金额', plain: '一共多少钱。', kind: 'object' },
  { term: '逾期', plain: '过了说好的时间。', kind: 'official' },
  { term: '核实', plain: '再确认一遍是不是真的。', kind: 'action' },
  { term: '点击链接', plain: '用手指按一下那段蓝色的字。', kind: 'action' },
  { term: '链接', plain: '能跳到另一个页面的字。', kind: 'object' },
  { term: '二维码', plain: '黑白小方块，用手机照一下就能用。', kind: 'object' },
  { term: '扫码', plain: '用手机对着方块图照一下。', kind: 'action' },
  { term: '短信', plain: '手机上收到的短消息。', kind: 'object' },
  { term: '挂号', plain: '看病前先拿一个号。', kind: 'action' },
  { term: '诊室', plain: '医生给你看病的房间。', kind: 'object' },
  { term: '缴费', plain: '把该付的钱交上去。', kind: 'action' },
  { term: '药房', plain: '拿药的地方。', kind: 'object' },
  { term: '身份证', plain: '证明你是谁的小卡片。', kind: 'object' },
  { term: '社保', plain: '老了以后领的钱。', kind: 'object' },
  { term: '医保', plain: '看病能少花钱的卡。', kind: 'object' },
  { term: '激活', plain: '让它能用。', kind: 'action' },
  { term: '办理', plain: '把一件事做成。', kind: 'action' },
  { term: '窗口', plain: '办事的柜台。', kind: 'object' },
  { term: '提交', plain: '把材料交上去。', kind: 'action' },
  { term: '居民', plain: '住在这里的人。', kind: 'object' },
  { term: '社区', plain: '你家附近的一片地方。', kind: 'object' },
  { term: '活动中心', plain: '大家在一起活动的地方。', kind: 'object' },
  { term: '获取', plain: '拿到。', kind: 'action' },
  { term: '位置信息', plain: '你在哪里。', kind: 'object' },
  { term: '允许', plain: '说“可以”。', kind: 'action' },
  { term: '不允许', plain: '说“不可以”。', kind: 'action' },
  { term: '密码', plain: '取钱前要按的几个数字。', kind: 'object' },
  { term: '确认', plain: '看好了，就按这个。', kind: 'action' },
  { term: '取消', plain: '不想做了，就按这个。', kind: 'action' },
  { term: '免费', plain: '不要钱。', kind: 'object' },
  { term: '中奖', plain: '说你得了奖品。', kind: 'warning' },
  { term: '挂断', plain: '把电话关掉。', kind: 'action' },
  { term: '银行', plain: '存钱、取钱的地方。', kind: 'object' },
  { term: '警察', plain: '管坏事的人。', kind: 'object' },
];

export interface TermHit {
  term: PlainTerm;
  start: number;
  end: number;
}

/** 长词优先，避免“冻结账户”被“冻结”拆开解释。 */
export function findTerms(text: string): TermHit[] {
  const occupied = new Array<boolean>(text.length).fill(false);
  const hits: TermHit[] = [];
  const sorted = [...PLAIN_TERMS].sort((a, b) => b.term.length - a.term.length);

  for (const term of sorted) {
    let from = 0;
    while (from <= text.length - term.term.length) {
      const start = text.indexOf(term.term, from);
      if (start < 0) break;
      const end = start + term.term.length;
      let free = true;
      for (let i = start; i < end; i += 1) {
        if (occupied[i]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let i = start; i < end; i += 1) occupied[i] = true;
        hits.push({ term, start, end });
      }
      from = start + term.term.length;
    }
  }

  return hits.sort((a, b) => a.start - b.start);
}

export interface SentenceExplanation {
  terms: PlainTerm[];
  /** null 表示词表里没有能解释的词；这时只能念，不能装懂。 */
  plain: string | null;
}

export function explainSentence(sentence: string): SentenceExplanation {
  const hits = findTerms(sentence);
  const unique = dedupe(hits.map((hit) => hit.term));
  if (unique.length === 0) return { terms: [], plain: null };

  // 先讲风险词（验证码、冻结账户），再讲普通词；最多三个，避免一口气说太多。
  const warnings = unique.filter((term) => term.kind === 'warning');
  const ordinary = unique.filter((term) => term.kind !== 'warning');
  const terms = [...warnings, ...ordinary].slice(0, 3);
  const parts = terms.map((term) => `${term.term}，就是${stripPeriod(term.plain)}`);
  return { terms, plain: `${parts.join('。')}。` };
}

function stripPeriod(text: string): string {
  return text.replace(/[。；;]\s*$/, '');
}

function dedupe(terms: PlainTerm[]): PlainTerm[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    if (seen.has(term.term)) return false;
    seen.add(term.term);
    return true;
  });
}

export interface RiskNote {
  level: 'caution' | 'danger';
  title: string;
  advice: string;
}

const RISK_PATTERNS: RegExp[] = [
  /点击(一下)?(链接|网址)/,
  /(安全账户|公检法|中奖|免费领|冻结账户)/,
  /(转账|汇款)/,
  /(验证码|密码).{0,8}(给别人|告诉|发给)/,
  /(输入|告诉|发给).{0,6}(密码|验证码)/,
  /https?:\/\/|www\./i,
];

/**
 * 给屏幕文字做一道很轻的安全提示。
 * 不判断“是不是诈骗”，只提醒“这句话里有高风险动作，先别急着按”。
 */
export function assessRisk(text: string): RiskNote | null {
  const hasMoneyOrAccount = /(转账|汇款|账户|余额|银行|付款|验证码)/.test(text);
  const hits = RISK_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (hits === 0) return null;

  if (hits >= 2 || (hasMoneyOrAccount && /(链接|中奖|冻结|安全账户|公检法)/.test(text))) {
    return {
      level: 'danger',
      title: '先别急着按',
      advice: '这句话里提到了钱、验证码或链接，可能是骗人的。先问家里人，或者打一一零。',
    };
  }

  return {
    level: 'caution',
    title: '看清楚再按',
    advice: '这句话里提到了转账或者密码。拿不准的时候，先不要按。',
  };
}

const MEDICAL_PATTERN = /((一次|一天|每顿).{0,4}(片|粒|次|袋))|剂量|停药|偏方/;

export function medicalCaution(text: string): RiskNote | null {
  if (!MEDICAL_PATTERN.test(text)) return null;
  return {
    level: 'caution',
    title: '吃药要问医生',
    advice: '药怎么吃，要听医生的。不要照着屏幕上的字自己加量。',
  };
}

/** 一段文字里所有能解释的词；用于“挑出难词”。 */
export function collectTerms(text: string): PlainTerm[] {
  return dedupe(findTerms(text).map((hit) => hit.term));
}

/** 三句话摘要：只用于自带文章（人工撰写）；粘贴文本不自动编摘要。 */
export function summarizeSentences(sentences: string[], max = 3): string[] {
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, max);
}

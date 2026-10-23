/**
 * 知识管线：把“本机字卡/词表 → 语料库 → 大模型”串起来。
 *
 * 优先级（冲突时）：
 *   人工字卡  >  语料库  >  本机词表  >  大模型补缺
 *
 * 大模型只“补空”，不覆盖已有的人工释义；但例句/拼音本地没有时可以补。
 * 以后接爬虫，只要把 JSON 丢进 userData/corpus，就会自动进入这条管线，
 * UI / 缓存 / 小窗都不用改。
 */

import {
  assessRisk,
  emptyKnowledge,
  makeKnowledge,
  medicalCaution,
  mergeKnowledge,
  type LookupTarget,
  type RiskNote,
  type WordKnowledge,
} from '@ziban/core';
import type { LlmStatus } from '@ziban/core';
import { LocalLexicon } from './localLexicon.js';
import { CorpusStore } from './corpus.js';
import { KnowledgeCache, buildLlmCacheKey } from './cache.js';
import { LlmClient, LlmError, type LlmConfig } from './llm.js';

export interface LocalLookupResult {
  knowledge: WordKnowledge;
  risk: RiskNote | null;
  /** 本地没有释义或例句，值得问一次大模型。 */
  needsLlm: boolean;
}

export interface KnowledgeResult extends LocalLookupResult {
  /** 给老人看的补充说明；不要用“失败/错误”。 */
  warning: string | null;
}

/**
 * OCR 错字可能让整行风险正则漏掉“告诉/转账”等关键词；目标词本身是敏感词时
 * 给一条保守提醒，宁可多提醒一次，也不让老人直接照着屏幕操作。
 */
const SENSITIVE_TARGETS = new Set([
  '验证码', '密码', '转账', '汇款', '中奖', '免费', '挂断', '银行', '警察',
  '社保', '医保', '付款', '支付', '收款', '余额', '冻结', '链接', '二维码',
]);

export interface KnowledgeServiceOptions {
  lexicon: LocalLexicon;
  corpus: CorpusStore;
  cache: KnowledgeCache;
  getLlmConfig: () => LlmConfig;
  onLog?: (message: string) => void;
}

export class KnowledgeService {
  private readonly options: KnowledgeServiceOptions;
  private activeAbort: AbortController | null = null;

  constructor(options: KnowledgeServiceOptions) {
    this.options = options;
  }

  /** 合并本机 + 语料库的取词词典；hover 用它做最长匹配。 */
  readonly targetLexicon = {
    has: (word: string): boolean =>
      this.options.lexicon.has(word) || this.options.corpus.has(word),
  };

  get maxWordLength(): number {
    let max = this.options.lexicon.maxWordLength;
    for (const word of this.options.corpus.words()) {
      max = Math.max(max, Array.from(word).length);
    }
    return Math.min(8, max);
  }

  private get llmConfig(): LlmConfig {
    return this.options.getLlmConfig();
  }

  get llmStatus(): LlmStatus {
    const config = this.llmConfig;
    if (!config.enabled) {
      return {
        enabled: false,
        configured: false,
        message: '电脑讲解没打开；本机词表也能讲常用词。',
      };
    }
    if (!config.endpoint || !config.model || !config.apiKey) {
      return {
        enabled: true,
        configured: false,
        message: '电脑讲解打开了，但网址、模型名或密钥还没填全。',
      };
    }
    return { enabled: true, configured: true, message: null };
  }

  /**
   * 同步取本机知识；UI 可以先立刻弹小窗（拼音 + 字卡释义），
   * 再异步等大模型补例句，老人不用盯着空窗等网络。
   */
  localLookup(target: LookupTarget): LocalLookupResult {
    const local = this.options.lexicon.getKnowledge(target.text);
    const corpus = this.options.corpus.get(target.text);
    let knowledge: WordKnowledge;

    if (local.source === 'card') {
      knowledge = corpus ? mergeKnowledge(local, corpus) : local;
    } else if (corpus) {
      knowledge = { ...corpus, pinyin: corpus.pinyin ?? local.pinyin };
    } else {
      knowledge = local;
    }

    if (!knowledge.pinyin) {
      const pinyin = this.options.lexicon.pinyinFor(target.text);
      if (pinyin) knowledge = { ...knowledge, pinyin };
    }

    if (!knowledge.definition && !knowledge.example && target.kind === 'latin') {
      knowledge = makeKnowledge(target.text, {
        pinyin: null,
        source: 'none',
        sourceLabel: '还不能讲',
        confidence: 'low',
      });
    }

    let risk = assessRisk(target.lineText) ?? medicalCaution(target.lineText);
    if (!risk && SENSITIVE_TARGETS.has(target.text)) {
      risk = {
        level: 'caution',
        title: '拿不准就问家里人',
        advice: '这个词和钱、证件或验证码有关。先别急着按，问一下家里人。',
      };
    }
    return {
      knowledge,
      risk,
      needsLlm:
        Boolean(this.llmStatus.configured) &&
        (!knowledge.definition || !knowledge.example || target.kind === 'latin'),
    };
  }

  /** 大模型补全；调用前先 localLookup。会取消上一次未完成的请求。 */
  async enrich(target: LookupTarget, local: LocalLookupResult): Promise<KnowledgeResult> {
    const config = this.llmConfig;
    if (!this.llmStatus.configured || !config.enabled) {
      return {
        ...local,
        warning:
          local.knowledge.definition || local.knowledge.example
            ? null
            : '这个字我只会念，还讲不好。可以让家里人打开“电脑讲解”。',
      };
    }

    const context = target.lineText;
    const cacheKey = buildLlmCacheKey(target.text, context, config.shareContext);
    const cached = this.options.cache.get(cacheKey);
    if (cached) {
      return {
        ...local,
        knowledge: mergeKnowledge(local.knowledge, cached),
        warning: null,
      };
    }

    this.activeAbort?.abort();
    const controller = new AbortController();
    this.activeAbort = controller;

    try {
      const client = new LlmClient(config);
      const generated = await client.lookup(
        target.text,
        config.shareContext ? context : '',
        controller.signal,
      );
      if (!generated) {
        return {
          ...local,
          warning:
            local.knowledge.definition || local.knowledge.example
              ? null
              : '电脑这次也讲不好，先听读音。',
        };
      }
      this.options.cache.set(cacheKey, generated);
      return {
        ...local,
        knowledge: mergeKnowledge(local.knowledge, generated),
        warning:
          generated.confidence === 'low'
            ? '这是电脑猜的，不一定对。拿不准就问家里人。'
            : null,
      };
    } catch (error) {
      if (error instanceof LlmError && error.code === 'ABORTED') {
        return { ...local, warning: null };
      }
      const message =
        error instanceof LlmError
          ? error.message
          : '电脑讲解没连上，先听本机的解释。';
      this.options.onLog?.(`电脑讲解不可用：${message}`);
      return {
        ...local,
        warning:
          local.knowledge.definition || local.knowledge.example
            ? '电脑讲解暂时没连上，先看本机的解释。'
            : message,
      };
    } finally {
      if (this.activeAbort === controller) this.activeAbort = null;
    }
  }

  /** 一步到位的便捷方法；手动热键/冒烟测试用。 */
  async lookup(target: LookupTarget): Promise<KnowledgeResult> {
    const local = this.localLookup(target);
    if (!local.needsLlm) {
      return {
        ...local,
        warning:
          local.knowledge.definition || local.knowledge.example
            ? null
            : '这个字我只会念，还讲不好。',
      };
    }
    return this.enrich(target, local);
  }

  async testLlm(): Promise<{ ok: boolean; message: string; latencyMs: number | null }> {
    if (!this.llmStatus.configured) {
      return { ok: false, message: this.llmStatus.message ?? '电脑讲解还没设置好。', latencyMs: null };
    }
    return new LlmClient(this.llmConfig).test();
  }

  clearCache(): void {
    this.options.cache.clear();
  }

  get cacheSize(): number {
    return this.options.cache.size;
  }

  dispose(): void {
    this.activeAbort?.abort();
    this.activeAbort = null;
    this.options.cache.dispose();
    this.options.corpus.dispose();
  }
}

/** 没有网络/没有语料时也能构造一个最小知识，便于 UI 稳定渲染。 */
export function fallbackKnowledge(word: string): LocalLookupResult {
  return { knowledge: emptyKnowledge(word), risk: null, needsLlm: false };
}

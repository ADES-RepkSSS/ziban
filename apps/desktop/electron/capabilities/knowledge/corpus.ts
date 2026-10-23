/**
 * 语料库文件加载器（为后续爬虫/语料库预留的稳定接口）。
 *
 * 目录：<userData>/corpus/*.json
 * 结构校验：schema/corpus.schema.json（仓库根目录）
 * 给 AI/内容同学的制作说明：docs/10-corpus-handoff.md
 * 格式：
 * {
 *   "version": 1,
 *   "name": "社区办事词表",
 *   "license": "CC-BY-SA-4.0",
 *   "entries": [
 *     {
 *       "word": "验证码",
 *       "pinyin": "yàn zhèng mǎ",
 *       "definition": "手机上收到的一串数字，只能自己用。",
 *       "example": "银行发来的验证码，不要告诉别人。",
 *       "source": "community-2026-10"
 *     }
 *   ]
 * }
 *
 * 规则：
 * - 只读本地文件，不联网；爬虫负责写这个目录，字伴只负责读；
 * - 词条必须带 definition；没有把握的字段留空，不要编；
 * - 同名冲突由 knowledge/service.ts 决定优先级：字卡 > 语料库 > 本机词表 > 大模型。
 * - 文件变更会自动重载（防抖 500ms），方便开发时直接改 JSON 看效果。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { isCjk, sanitizeKnowledgeText, sanitizePinyin, type WordKnowledge } from '@ziban/core';

interface CorpusFile {
  version?: number;
  name?: string;
  license?: string;
  entries?: Array<{
    word?: string;
    pinyin?: string;
    definition?: string;
    example?: string;
    source?: string;
  }>;
}

export interface CorpusStats {
  files: number;
  entries: number;
  warnings: string[];
}

export class CorpusStore {
  private readonly dir: string;
  private readonly onLog?: (message: string) => void;
  private entries = new Map<string, WordKnowledge>();
  private watcher: FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;
  readonly stats: CorpusStats = { files: 0, entries: 0, warnings: [] };

  constructor(userDataPath: string, onLog?: (message: string) => void) {
    this.dir = path.join(userDataPath, 'corpus');
    this.onLog = onLog;
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch {
      // 目录建不了就当作没有语料库。
    }
    this.load();
    this.watch();
  }

  get directory(): string {
    return this.dir;
  }

  private load(): void {
    const next = new Map<string, WordKnowledge>();
    const warnings: string[] = [];
    let files = 0;

    if (!existsSync(this.dir)) {
      this.entries = next;
      return;
    }

    let names: string[] = [];
    try {
      names = readdirSync(this.dir).filter((name) => name.toLowerCase().endsWith('.json'));
    } catch {
      names = [];
    }

    for (const name of names) {
      const filePath = path.join(this.dir, name);
      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf8')) as CorpusFile;
        if (!Array.isArray(raw.entries)) {
          warnings.push(`${name}: 没有 entries 数组`);
          continue;
        }
        files += 1;
        for (const item of raw.entries) {
          // 先判长度再截断：超过 8 字的词直接丢弃，不能静默变成另一个词。
          // （lint 也会提前拒绝；这里是运行时的最后一道防线。）
          const trimmed = typeof item.word === 'string' ? item.word.trim() : '';
          const word = Array.from(trimmed).length > 8 ? '' : trimmed;
          if (!word) continue;
          const definition = sanitizeKnowledgeText(item.definition, 120);
          if (!definition) continue;
          const example = sanitizeKnowledgeText(item.example, 120);
          const pinyin = sanitizePinyin(item.pinyin ?? '');
          // auto- 前缀 = 机器审校（docs/10 §9.2）：不能冒充人工高可信内容，
          // UI 会显示“机器审校 · <name> · 不一定对”，并降为 medium 置信度。
          const isAuto = typeof item.source === 'string' && item.source.startsWith('auto-');
          next.set(word, {
            word,
            pinyin,
            definition,
            example,
            source: 'corpus',
            sourceLabel: isAuto
              ? `机器审校 · ${raw.name ?? '语料库'}`
              : raw.name
                ? `语料库 · ${raw.name}`
                : '语料库',
            generated: isAuto,
            confidence: isAuto ? 'medium' : 'high',
            updatedAt: Date.now(),
          });
        }
      } catch (error) {
        warnings.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.entries = next;
    this.stats.files = files;
    this.stats.entries = next.size;
    this.stats.warnings = warnings;
    if (warnings.length > 0) {
      this.onLog?.(`语料库有 ${warnings.length} 个文件没读进来：${warnings.slice(0, 3).join('；')}`);
    } else if (next.size > 0) {
      this.onLog?.(`语料库加载：${next.size} 条（${files} 个文件）`);
    }
  }

  private watch(): void {
    try {
      this.watcher = watch(this.dir, { persistent: false }, () => {
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => this.load(), 500);
      });
      this.watcher.on('error', () => {
        // 目录被删/权限变化时不崩溃；下次启动再加载。
      });
    } catch {
      // 某些文件系统不支持 watch；不影响启动时加载。
    }
  }

  get(word: string): WordKnowledge | null {
    const entry = this.entries.get(word);
    return entry ? { ...entry, updatedAt: Date.now() } : null;
  }

  has(word: string): boolean {
    return this.entries.has(word);
  }

  /** 词表合并用：把语料库词条加入取词词表。 */
  words(): string[] {
    return Array.from(this.entries.keys());
  }

  /** 测试/爬虫写完文件后可手动触发。 */
  reload(): void {
    this.load();
  }

  dispose(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = null;
    this.watcher?.close();
    this.watcher = null;
  }
}

/** 语料库词条合法性（导出给脚本/测试复用）。 */
export function isCorpusWord(word: string): boolean {
  return Array.from(word).every((char) => isCjk(char)) && Array.from(word).length <= 8;
}

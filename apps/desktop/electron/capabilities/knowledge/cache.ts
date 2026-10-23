/**
 * 本机知识缓存（只缓存大模型结果，本机词表本身已经很快）。
 *
 * 目的：
 * - 同一个词反复看，不重复花钱/等网络；
 * - 断网时还能看到上一次的解释（标注仍是“电脑生成”）。
 *
 * 隐私：缓存只存在本机 userData 目录，不上传；设置页提供“清除缓存”。
 * 过期：7 天；最多 400 条，超过按最近使用时间淘汰。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WordKnowledge } from '@ziban/core';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 400;

interface CacheFile {
  version: 1;
  entries: Record<string, WordKnowledge>;
}

function djb2(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function buildLlmCacheKey(word: string, context: string, shareContext: boolean): string {
  return `llm:${word}:${djb2(shareContext ? context : '')}`;
}

function isValidEntry(value: unknown): value is WordKnowledge {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WordKnowledge>;
  return typeof entry.word === 'string' && typeof entry.updatedAt === 'number';
}

export class KnowledgeCache {
  private readonly filePath: string;
  private entries = new Map<string, WordKnowledge>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(userDataPath: string) {
    // 不要用 userData/cache：Windows/macOS 文件系统不区分大小写，会和 Chromium
    // 自己的 Cache 目录撞在一起。用 ziban-cache 单独放。
    this.filePath = path.join(userDataPath, 'ziban-cache', 'lookup-cache.json');
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<CacheFile>;
      if (!raw.entries || typeof raw.entries !== 'object') return;
      const now = Date.now();
      for (const [key, value] of Object.entries(raw.entries)) {
        if (!isValidEntry(value)) continue;
        if (now - value.updatedAt > TTL_MS) continue;
        this.entries.set(key, value);
      }
    } catch {
      // 缓存坏了不影响功能，下一次写入会覆盖。
    }
  }

  get(key: string): WordKnowledge | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > TTL_MS) {
      this.entries.delete(key);
      return null;
    }
    // 刷新 LRU 顺序：Map 的插入顺序即淘汰顺序。
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { ...entry };
  }

  set(key: string, knowledge: WordKnowledge): void {
    this.entries.delete(key);
    this.entries.set(key, { ...knowledge, updatedAt: Date.now() });
    this.prune();
    this.scheduleFlush();
  }

  private prune(): void {
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 1200);
  }

  flush(): void {
    try {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      const payload: CacheFile = {
        version: 1,
        entries: Object.fromEntries(this.entries),
      };
      const temp = `${this.filePath}.tmp`;
      writeFileSync(temp, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 });
      renameSync(temp, this.filePath);
    } catch {
      // 写不进去就只保留内存缓存。
    }
  }

  clear(): void {
    this.entries.clear();
    this.flush();
  }

  get size(): number {
    return this.entries.size;
  }

  dispose(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.flush();
  }
}

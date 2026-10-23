import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CorpusStore } from './corpus';
import { LocalLexicon } from './localLexicon';
import { KnowledgeCache } from './cache';
import { KnowledgeService } from './service';

/**
 * 语料库加载器与运行时 JSON 的兼容性测试。
 * 重点：auto- 前缀必须降级为“机器审校”，不能冒充人工 high confidence。
 */

const roots: string[] = [];

function makeStore(files: Record<string, unknown>): CorpusStore {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ziban-corpus-'));
  roots.push(root);
  mkdirSync(path.join(root, 'corpus'), { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(path.join(root, 'corpus', name), JSON.stringify(data), 'utf8');
  }
  return new CorpusStore(root);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('CorpusStore', () => {
  it('把 auto- 语料标成机器审校，并降到 medium', () => {
    const store = makeStore({
      'hospital.json': {
        version: 1,
        name: '医院办事词表',
        license: 'CC-BY-SA-4.0',
        entries: [
          {
            word: '候诊',
            definition: '挂完号，坐着等医生叫你。',
            example: '请在候诊区坐着等叫号。',
            source: 'auto-hospital-2026-11',
          },
        ],
      },
    });

    const entry = store.get('候诊');
    expect(entry).not.toBeNull();
    expect(entry?.sourceLabel).toBe('机器审校 · 医院办事词表');
    expect(entry?.generated).toBe(true);
    expect(entry?.confidence).toBe('medium');
    // 省略 pinyin 时必须是 null，运行时才能用 pinyin-pro 兜底。
    expect(entry?.pinyin).toBeNull();
    store.dispose();
  });

  it('非 auto- 语料仍按人工高可信显示', () => {
    const store = makeStore({
      'community.json': {
        version: 1,
        name: '社区词表',
        entries: [{ word: '候诊', definition: '挂完号，坐着等医生叫你。', source: 'community-2026-10' }],
      },
    });

    const entry = store.get('候诊');
    expect(entry?.sourceLabel).toBe('语料库 · 社区词表');
    expect(entry?.generated).toBe(false);
    expect(entry?.confidence).toBe('high');
    store.dispose();
  });

  it('加载 release 目录全部 293 条，并让知识管线返回机器审校来源', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ziban-corpus-release-'));
    roots.push(root);
    mkdirSync(path.join(root, 'corpus'), { recursive: true });
    const releaseDir = path.join(process.cwd(), 'corpus', 'release');
    for (const file of readdirSync(releaseDir).filter((name) => name.endsWith('.json'))) {
      cpSync(path.join(releaseDir, file), path.join(root, 'corpus', file));
    }

    const corpus = new CorpusStore(root);
    expect(corpus.stats.entries).toBe(293);
    expect(corpus.get('候诊')?.sourceLabel).toBe('机器审校 · 医院办事词表');

    const lexicon = new LocalLexicon([], null);
    const cache = new KnowledgeCache(path.join(root, 'cache'));
    const service = new KnowledgeService({
      lexicon,
      corpus,
      cache,
      getLlmConfig: () => ({
        enabled: false,
        endpoint: '',
        model: '',
        apiKey: null,
        shareContext: false,
      }),
    });
    const result = service.localLookup({
      text: '候诊',
      kind: 'word',
      lineText: '请在候诊区坐着等叫号',
      charIndex: 2,
      charRect: { x: 0, y: 0, width: 10, height: 10 },
      lineRect: { x: 0, y: 0, width: 100, height: 10 },
      point: { x: 5, y: 5 },
    });
    expect(result.knowledge.source).toBe('corpus');
    expect(result.knowledge.sourceLabel).toContain('机器审校');
    expect(result.knowledge.definition).toContain('坐着等');
    expect(result.needsLlm).toBe(false);
    service.dispose();
  });

  it('丢弃超过 8 字的词和空释义，避免运行时静默截断', () => {
    const store = makeStore({
      'bad.json': {
        version: 1,
        name: '坏词表',
        entries: [
          { word: '一二三四五六七八九', definition: '超过八个字应该被丢弃。' },
          { word: '空释义', definition: '   ' },
          { word: '正常', definition: '这个可以加载。' },
        ],
      },
    });

    expect(store.has('一二三四五六七八九')).toBe(false);
    expect(store.has('空释义')).toBe(false);
    expect(store.get('正常')?.definition).toBe('这个可以加载。');
    expect(store.stats.entries).toBe(1);
    store.dispose();
  });
});

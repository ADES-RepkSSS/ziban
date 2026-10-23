#!/usr/bin/env node
/**
 * 从 workbench 的 drafts + review.jsonl 生成 corpus/release/<theme>.json。
 *
 * 规则（docs/字伴-语料批处理与自动审核-交接手册.md 第 9 节）：
 * - 只有 review.final === 'release' 的词条进入运行时 JSON；
 * - 一个主题一个文件，name 取自 manifest.release_name，license 固定 CC-BY-SA-4.0；
 * - source 以 auto- 开头，运行时 UI 会标“机器审校”；
 * - 只输出 schema 允许的字段；没有把握的 pinyin 一律省略（运行时用 pinyin-pro 兜底）。
 *
 * 用法：node scripts/corpus-build.mjs [--dry-run]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const workbench = path.join(ROOT, 'corpus/workbench');
const releaseDir = path.join(ROOT, 'corpus/release');
if (!dryRun) mkdirSync(releaseDir, { recursive: true });

const batches = readdirSync(workbench, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(workbench, entry.name, 'manifest.json')))
  .map((entry) => entry.name)
  .sort();

const summary = [];
const seen = new Map();
let failed = false;

for (const batch of batches) {
  const dir = path.join(workbench, batch);
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const drafts = readJsonl(path.join(dir, 'drafts.jsonl'));
  const reviewFile = path.join(dir, 'review.jsonl');
  if (!existsSync(reviewFile)) {
    console.error('✗ ' + batch + ' 没有 review.jsonl，先跑 node scripts/corpus-review.mjs');
    failed = true;
    continue;
  }
  const reviews = new Map(readJsonl(reviewFile).map((record) => [record.word, record]));
  const entries = [];
  let dropped = 0;
  for (const draft of drafts) {
    const review = reviews.get(draft.word);
    if (!review || review.final !== 'release') {
      dropped += 1;
      continue;
    }
    if (seen.has(draft.word)) {
      console.error('✗ 跨文件重复：' + draft.word + '（' + seen.get(draft.word) + ' / ' + batch + '）');
      failed = true;
      continue;
    }
    seen.set(draft.word, batch);
    const entry = {
      word: draft.word,
      definition: draft.definition,
      example: draft.example,
      source: manifest.release_source,
    };
    if (draft.pinyin) entry.pinyin = draft.pinyin;
    entries.push(entry);
  }
  const output = {
    version: 1,
    name: manifest.release_name,
    license: 'CC-BY-SA-4.0',
    entries,
  };
  const file = path.join(releaseDir, manifest.theme + '.json');
  if (!dryRun) writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
  summary.push({ theme: manifest.theme, released: entries.length, dropped });
  console.log('· ' + manifest.theme + '：release ' + entries.length + '，drop ' + dropped + ' → ' + path.relative(ROOT, file).replace(/\\/g, '/'));
}

const total = summary.reduce((sum, item) => sum + item.released, 0);
console.log('\n' + (dryRun ? '（dry-run，未写文件）' : '已生成 ' + summary.length + ' 个文件') + '：共 ' + total + ' 条');
if (failed) process.exit(1);

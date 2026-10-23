#!/usr/bin/env node
/**
 * 把 Judge A/B/C 的评审记录、硬 lint 结果合并成每个批次的 review.jsonl，
 * 并按 docs/字伴-语料批处理与自动审核-交接手册.md 第 8 节的规则给出 final。
 *
 * 用法：
 *   node scripts/corpus-review.mjs            # 合并并写 corpus/workbench/<batch>/review.jsonl
 *   node scripts/corpus-review.mjs --dry-run  # 只打印统计，不写文件
 *
 * 输入：
 *   corpus/workbench/<batch>/manifest.json
 *   corpus/workbench/<batch>/drafts.jsonl
 *   corpus/workbench/reviews/judge*.jsonl   （每行一条 word + scores + decision）
 *
 * 输出：corpus/workbench/<batch>/review.jsonl
 *
 * 注意：这里只是“机器审校”的汇总，不是人工审校；final=release 也只表示可进实验语料。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const DIMENSIONS = ['accuracy', 'plainness', 'tone', 'safety', 'scenario', 'necessity'];

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ── 1. 跑硬 lint，拿逐条结果 ─────────────────────────────
const reportFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'ziban-corpus-')), 'lint.json');
const lint = spawnSync(process.execPath, ['scripts/corpus-lint.mjs', '--drafts', '--report', reportFile], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (!existsSync(reportFile)) {
  console.error('✗ 硬 lint 没有产出报告，先单独跑 node scripts/corpus-lint.mjs --drafts');
  process.exit(2);
}
const lintReport = JSON.parse(readFileSync(reportFile, 'utf8'));
const lintByWord = new Map();
for (const file of lintReport.files) {
  const batch = path.basename(path.dirname(file.file));
  for (const item of file.items) {
    if (!item.word) continue;
    lintByWord.set(batch + '#' + item.word, item);
  }
}
if (lint.status !== 0) {
  console.log('· 硬 lint 有失败项，相关词条会直接 drop（见下）');
}

// ── 2. 读评审 ────────────────────────────────────────────
const reviewsDir = path.join(ROOT, 'corpus/workbench/reviews');
const judgeFiles = existsSync(reviewsDir)
  ? readdirSync(reviewsDir).filter((name) => name.endsWith('.jsonl')).sort()
  : [];
const resolutionsFile = path.join(ROOT, 'corpus/workbench/resolutions.json');
const resolutions = existsSync(resolutionsFile) ? JSON.parse(readFileSync(resolutionsFile, 'utf8')) : {};
const judgesByWord = new Map();
for (const name of judgeFiles) {
  const id = (name.match(/judge([A-Za-z0-9]+)/i)?.[1] ?? name.replace(/\.jsonl$/, '')).toUpperCase();
  for (const record of readJsonl(path.join(reviewsDir, name))) {
    if (!record.word) continue;
    const key = (record.batch_id ?? '') + '#' + record.word;
    if (!judgesByWord.has(key)) judgesByWord.set(key, []);
    judgesByWord.get(key).push({
      id: record.judge ?? id,
      scores: record.scores ?? {},
      decision: record.decision ?? 'revise',
      hard_reject: Boolean(record.hard_reject),
      reason: record.reason ?? '',
    });
  }
}

// ── 3. 逐条判定 ──────────────────────────────────────────
/**
 * 判定。与手册的差异：评审记录可能针对修改前的文本（评审跑在改稿之前），
 * 所以“评审提了问题”不等于“现在还有问题”。凡是按意见改过或确认误判的，
 * 必须在 corpus/workbench/resolutions.json 里留一条可审计的说明，才允许 release。
 */
function decide(lintItem, judges, resolution) {
  if (!lintItem) return { final: 'drop', reason: '没有 lint 记录' };
  if (lintItem.errors.length > 0) {
    return { final: 'drop', reason: 'hard lint：' + lintItem.errors.map((e) => e.rule).join('、') };
  }
  if (judges.length === 0) return { final: 'pending', reason: '还没有评审记录' };

  const safetyReject = judges.some((judge) => (judge.scores.safety ?? 5) <= 2);
  if (safetyReject) return { final: 'drop', reason: '安全类低分（≤2），不发布' };

  const hardReject = judges.some((judge) => judge.hard_reject || judge.decision === 'reject');
  if (hardReject) {
    if (resolution?.override === 'false-positive') {
      return { final: 'release', reason: '评审误判，已核对：' + resolution.note };
    }
    return { final: 'drop', reason: '评审 hard reject，未处理' };
  }

  const passes = judges.filter((judge) => judge.decision === 'pass').length;
  const allScores = judges.flatMap((judge) => DIMENSIONS.map((dim) => judge.scores[dim] ?? 0));
  const minScore = Math.min(...allScores);
  if (passes === judges.length && minScore >= 4) {
    return { final: 'release', reason: '评审通过（' + judges.length + ' 份）' };
  }

  if (resolution) {
    return { final: 'release', reason: '已处理评审意见：' + resolution.note };
  }
  return { final: 'drop', reason: '评审有低分/保留意见，未处理（' + passes + '/' + judges.length + ' 通过）' };
}

// ── 4. 写 review.jsonl ───────────────────────────────────
const workbench = path.join(ROOT, 'corpus/workbench');
const batchDirs = readdirSync(workbench, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(workbench, entry.name, 'manifest.json')))
  .map((entry) => entry.name)
  .sort();

const stats = { release: 0, drop: 0, pending: 0 };
for (const batch of batchDirs) {
  const dir = path.join(workbench, batch);
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const drafts = readJsonl(path.join(dir, 'drafts.jsonl'));
  const records = [];
  for (const draft of drafts) {
    const key = batch + '#' + draft.word;
    const lintItem = lintByWord.get(key);
    const judges = judgesByWord.get(key) ?? [];
    const resolution = resolutions[draft.word] ?? null;
    const decision = decide(lintItem, judges, resolution);
    records.push({
      batch_id: batch,
      word: draft.word,
      draft_id: draft.draft_id,
      hard_lint: lintItem && lintItem.errors.length === 0 ? 'pass' : 'fail',
      coverage: lintItem?.coverage ?? null,
      judges,
      resolution,
      final: decision.final,
      reason: decision.reason,
      reviewed_at: new Date().toISOString(),
    });
    stats[decision.final] += 1;
  }
  if (!dryRun) {
    writeFileSync(path.join(dir, 'review.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }
  const counts = records.reduce((acc, r) => ((acc[r.final] = (acc[r.final] ?? 0) + 1), acc), {});
  console.log('· ' + batch + '：' + JSON.stringify(counts));
}

console.log('\n' + (dryRun ? '（dry-run，未写文件）' : '已写 review.jsonl') + '：release ' + stats.release + '，drop ' + stats.drop + '，pending ' + stats.pending);

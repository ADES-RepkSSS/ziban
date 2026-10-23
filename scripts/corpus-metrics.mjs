#!/usr/bin/env node
/**
 * 生成每个批次的 metrics.md（交接手册第 11 节要求）。
 * 输入：corpus/workbench/<batch>/{manifest.json,drafts.jsonl,review.jsonl}
 * 输出：corpus/workbench/<batch>/metrics.md
 *
 * 用法：node scripts/corpus-metrics.mjs
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workbench = path.join(ROOT, 'corpus/workbench');

function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function hanLength(text) {
  return Array.from(String(text ?? '')).filter((c) => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(c)).length;
}

function avg(values) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

const batches = readdirSync(workbench, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(workbench, entry.name, 'manifest.json')))
  .map((entry) => entry.name)
  .sort();

for (const batch of batches) {
  const dir = path.join(workbench, batch);
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const drafts = readJsonl(path.join(dir, 'drafts.jsonl'));
  const reviews = readJsonl(path.join(dir, 'review.jsonl'));
  const prefilters = readJsonl(path.join(workbench, 'dropped.jsonl')).filter(
    (record) => record.theme === manifest.theme,
  );
  const byWord = new Map(reviews.map((record) => [record.word, record]));

  const finals = { release: 0, drop: 0, pending: 0 };
  const dropReasons = new Map();
  const judgePass = { pass: 0, revise: 0, reject: 0 };
  let safetyFive = 0;
  for (const record of reviews) {
    finals[record.final] = (finals[record.final] ?? 0) + 1;
    if (record.final === 'drop') {
      const key = String(record.reason).replace(/：.*$/, '').slice(0, 24);
      dropReasons.set(key, (dropReasons.get(key) ?? 0) + 1);
    }
    for (const judge of record.judges ?? []) {
      judgePass[judge.decision] = (judgePass[judge.decision] ?? 0) + 1;
      if (judge.scores?.safety === 5) safetyFive += 1;
    }
  }

  const defLengths = drafts.map((draft) => hanLength(draft.definition));
  const exLengths = drafts.map((draft) => hanLength(draft.example));
  const shortWords = drafts.filter((draft) => Array.from(draft.word).length <= 4).length;
  const withPinyin = drafts.filter((draft) => draft.pinyin).length;
  const coverages = reviews.map((record) => record.coverage).filter((v) => typeof v === 'number');
  const lowCoverage = coverages.filter((v) => v < 0.95).length;
  const releasedDrafts = drafts.filter((draft) => byWord.get(draft.word)?.final === 'release');
  const releasedDef = releasedDrafts.map((draft) => hanLength(draft.definition));
  const releasedEx = releasedDrafts.map((draft) => hanLength(draft.example));

  const lines = [
    '# ' + batch + ' · 批次指标',
    '',
    '> 机器审校草稿，不是人工审校，也没有老人测试。',
    '',
    '## 批次参数',
    '',
    '| 项 | 值 |',
    '|---|---|',
    '| 主题 | ' + manifest.theme + ' |',
    '| 风险层 | ' + manifest.risk_tier + ' |',
    '| 提示词版本 | ' + manifest.prompt_version + ' |',
    '| 生成模型 | ' + manifest.generator_model + ' |',
    '| 冻结词数 | ' + drafts.length + ' |',
    '',
    '## 流水线结果',
    '',
    '| 指标 | 值 |',
    '|---|---|',
    '| 候选数（含预筛丢弃） | ' + (drafts.length + prefilters.length) + ' |',
    '| Step 0 预筛丢弃 | ' + prefilters.length + ' |',
    '| release | ' + finals.release + ' |',
    '| drop | ' + finals.drop + ' |',
    '| pending | ' + finals.pending + ' |',
    '| 2–4 字词占比 | ' + (drafts.length ? Math.round((shortWords / drafts.length) * 1000) / 10 : 0) + '% |',
    '| 带拼音 | ' + withPinyin + ' 条（本批全部省略，运行时 pinyin-pro 兜底） |',
    '| 释义平均字数 | ' + avg(defLengths) + ' |',
    '| 例句平均字数 | ' + avg(exLengths) + ' |',
    '| release 释义平均字数 | ' + avg(releasedDef) + ' |',
    '| release 例句平均字数 | ' + avg(releasedEx) + ' |',
    '| 释义用字覆盖率均值 | ' + (coverages.length ? Math.round(avg(coverages) * 1000) / 10 : 0) + '% |',
    '| 覆盖率 <95% 的条数 | ' + lowCoverage + ' |',
    '| 评审记录数 | ' + reviews.reduce((sum, record) => sum + (record.judges?.length ?? 0), 0) + ' |',
    '| 评审 pass / revise / reject | ' + judgePass.pass + ' / ' + judgePass.revise + ' / ' + judgePass.reject + ' |',
    '| safety=5 的评审次数 | ' + safetyFive + ' |',
    '',
    '## drop 原因分布',
    '',
  ];
  if (prefilters.length > 0) {
    lines.push('### Step 0 预筛（本机词/近义重复）', '', '| 词 | 原因 |', '|---|---|');
    for (const record of prefilters) lines.push('| ' + record.word + ' | ' + record.reason + ' |');
    lines.push('');
  }
  lines.push('### 评审阶段 drop', '');
  if (dropReasons.size === 0) {
    lines.push('（无）');
  } else {
    lines.push('| 原因 | 条数 |', '|---|---|');
    for (const [reason, count] of [...dropReasons.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push('| ' + reason + ' | ' + count + ' |');
    }
  }
  lines.push(
    '',
    '## 读法',
    '',
    '- release 只代表“机器评审没发现明显问题”，不代表词义已经人工核对。',
    '- 覆盖率按目标词本身的字豁免；其他表外字会拉低覆盖率。',
    '- 拼音一律省略：语料拼音会覆盖本机 pinyin-pro，写错比不写更糟。',
    '',
  );
  writeFileSync(path.join(dir, 'metrics.md'), lines.join('\n'));
  console.log('· ' + batch + '：release ' + finals.release + ' / ' + drafts.length);
}

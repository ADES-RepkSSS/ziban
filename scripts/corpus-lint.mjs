#!/usr/bin/env node
/**
 * 字伴语料硬 lint（docs/字伴-语料批处理与自动审核-交接手册.md 第 6 节的可执行版本）。
 *
 * 用法：
 *   node scripts/corpus-lint.mjs                    # 检查 corpus/release/*.json
 *   node scripts/corpus-lint.mjs --drafts           # 检查 corpus/workbench/<batch>/drafts.jsonl
 *   node scripts/corpus-lint.mjs --report out.json  # 额外写机器可读报告
 *
 * 退出码：0 通过（允许 warning）；1 有 hard fail；2 用法/环境错误。
 *
 * 规则来源：
 * - schema/corpus.schema.json（字段白名单、长度）
 * - apps/desktop/electron/capabilities/knowledge/corpus.ts（运行时截断/清洗行为）
 * - corpus/chars/common2000.txt（释义用字预算）
 * - content/cards/level1.yaml + localLexicon.ts（字卡/本机词去重）
 *
 * 本脚本只做确定性检查；语义准确性和“老人听不听得懂”必须走评审/人工，脚本不代替。
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const draftMode = args.includes('--drafts');
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : null;
if (reportIndex >= 0 && !reportPath) {
  console.error('用法：node scripts/corpus-lint.mjs [--drafts] [--report out.json]');
  process.exit(2);
}

// ── 词表与基线 ───────────────────────────────────────────
function loadChars() {
  const file = path.join(ROOT, 'corpus/chars/common2000.txt');
  if (!existsSync(file)) {
    console.error('✗ 缺少 corpus/chars/common2000.txt，无法检查用字覆盖率。');
    process.exit(2);
  }
  const text = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .join('')
    .replace(/\s+/g, '');
  return new Set(Array.from(text));
}

function loadDecks() {
  const yaml = readFileSync(path.join(ROOT, 'content/cards/level1.yaml'), 'utf8');
  const cards = Array.from(yaml.matchAll(/^ {2}text:\s*(\S+)/gm), (m) => m[1].trim());
  const lex = readFileSync(
    path.join(ROOT, 'apps/desktop/electron/capabilities/knowledge/localLexicon.ts'),
    'utf8',
  );
  const screenTerms = Array.from(lex.matchAll(/\{\s*term:\s*'([^']+)'/g), (m) => m[1]);
  // 本机词还有一半在 packages/core 的 PLAIN_TERMS 里；漏掉会误判“没重复”。
  const plain = readFileSync(path.join(ROOT, 'packages/core/src/plainLanguage.ts'), 'utf8');
  const plainTerms = Array.from(plain.matchAll(/\{\s*term:\s*'([^']+)'/g), (m) => m[1]);
  if (plainTerms.length < 30) {
    console.error('\u2717 从 plainLanguage.ts 只读到 ' + plainTerms.length + ' 条 PLAIN_TERMS，格式可能改了。');
    process.exit(2);
  }
  const local = [...screenTerms, ...plainTerms];
  if (cards.length < 50) {
    console.error('\u2717 从 content/cards/level1.yaml 只读到 ' + cards.length + ' 张字卡，格式可能改了。');
    process.exit(2);
  }
  if (local.length < 80) {
    console.error('\u2717 从 localLexicon.ts 只读到 ' + local.length + ' 条本机词，格式可能改了。');
    process.exit(2);
  }
  return { cards: new Set(cards), local: new Set(local), cardLen: cards.length, localLen: local.length };
}

const COMMON = loadChars();
const { cards, local } = loadDecks();

// 升级白名单：本机词默认不重复；只有这里列出的高风险词允许语料覆盖（本期为空）。
const UPGRADE_WHITELIST = new Set();

// ── 规则表 ───────────────────────────────────────────────
const ENTRY_FIELDS = new Set(['word', 'pinyin', 'definition', 'example', 'source']);
const TOP_FIELDS = new Set(['version', 'name', 'license', 'entries']);
const TONE_WORDS = ['错误', '失败', '你错了', '不对', '笨', '傻', '连这个都不懂', '蠢', '没用'];
const WRITTEN_WORDS = ['谓', '予以', '进行', '相关', '乃', '此项', '该项', '该笔', '其', '此'];
const RISK_WORD = /验证码|转账|冻结|退款|中奖|密码|链接|客服|汇款|安全账户|刷单|返利|投资|高息|屏幕共享|远程控制|个人信息|卡号|账户|保证金|退税|领奖|抽奖|熟人|冒充|诈骗|骗子|木马|贷款|征信/;
const CAUTION = /别|不要|不能|不用|先问|先别|小心|注意|拒绝|挂断|报警|问家里|问银行|问医生|没|未曾|不会/;
const DANGER_VERB = /输入|点击|点开|告诉|转给|发给|提供|共享|远程|下载|安装|打开|扫码|刷脸|汇款|转账|按一下|填/;
const CJK = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+$/;

function hanChars(text) {
  return Array.from(text).filter((c) => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(c));
}

function isHan(text) {
  return CJK.test(text);
}

function charLen(value) {
  return Array.from(value).length;
}

function pct(value, total) {
  return total === 0 ? 1 : value / total;
}

// ── 逐条检查 ─────────────────────────────────────────────
function checkEntry(entry, where, ctx) {
  const errors = [];
  const warnings = [];
  const notes = { coverage: null, tierC: [], exampleCoverage: null };
  const bad = (rule, message) => errors.push({ rule, message });
  const warn = (rule, message) => warnings.push({ rule, message });

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    bad('struct', '词条必须是对象');
    return { errors, warnings, notes };
  }
  // drafts.jsonl 允许带 batch_id/draft_id 等审计字段；运行时 JSON 只允许 schema 字段。
  if (!ctx.draftMode) {
    for (const key of Object.keys(entry)) {
      if (!ENTRY_FIELDS.has(key)) bad('struct', '出现 schema 外字段：' + key);
    }
  }

  const word = typeof entry.word === 'string' ? entry.word.trim() : '';
  if (!word) {
    bad('word', '缺少 word');
    return { errors, warnings, notes };
  }
  if (charLen(word) < 2) bad('word', 'word 少于 2 字：' + word);
  if (charLen(word) > 8) bad('word', 'word 超过 8 字（运行时会截断）：' + word);
  if (!isHan(word)) bad('word', 'word 必须是纯汉字：' + word);
  if (/\s/.test(word)) bad('word', 'word 含空白：' + word);
  if (ctx.cards.has(word)) bad('dup-card', '与字卡重复：' + word);
  if (ctx.local.has(word) && !UPGRADE_WHITELIST.has(word)) bad('dup-local', '与本机词表重复：' + word);
  if (ctx.seen.has(word)) bad('dup-cross', '重复：' + word + '（首次在 ' + ctx.seen.get(word) + '）');
  else ctx.seen.set(word, where);

  const def = typeof entry.definition === 'string' ? entry.definition.trim() : '';
  if (!def) {
    bad('definition', '缺少 definition');
  } else {
    const len = hanChars(def).length;
    if (len < 6) bad('definition', '释义汉字少于 6 个：' + word);
    if (len > 60) bad('definition', '释义超过 60 字（运行时截到 120）：' + word);
    // 手册把 12–40 当目标；10–11 个汉字的口语短句不算失败，<8 才提示。
    if (len < 8 || len > 40) warn('definition-length', '释义 ' + len + ' 个汉字，目标 12–40：' + word);
    if (/[A-Za-z0-9]/.test(def)) bad('ascii', '释义含英文/数字：' + word);
    if (/https?:\/\/|www\./i.test(def)) bad('url', '释义含网址：' + word);
    if (/<[^>]*>/.test(def)) bad('html', '释义含 HTML：' + word);
    if (/[（）()【】\[\]<>《》]/.test(def)) bad('bracket', '释义含括号（小窗会显得乱）：' + word);
    if (/[\u0000-\u001f\u007f]/.test(def)) bad('control', '释义含控制字符：' + word);
    for (const word of TONE_WORDS) {
      if (def.includes(word)) bad('tone', '释义含指责性词语「' + word + '」：' + entry.word);
    }
    for (const word of WRITTEN_WORDS) {
      if (def.includes(word)) warn('written', '释义含书面语「' + word + '」：' + entry.word);
    }
    if (def === word || new RegExp('^' + word + '(就是|是指|是)').test(def)) {
      bad('circular', '循环释义：' + word);
    }
    const hans = hanChars(def);
    const inside = hans.filter((c) => COMMON.has(c));
    const outside = hans.filter((c) => !COMMON.has(c));
    for (const c of outside) {
      if (!word.includes(c)) notes.tierC.push(c);
    }
    // 目标词本身的 Tier C 字不算覆盖缺口（docs 允许目标词含表外字）。
    const counted = hans.filter((c) => COMMON.has(c) || word.includes(c));
    const coverage = pct(counted.length, hans.length);
    notes.coverage = Number(coverage.toFixed(3));
    if (coverage < 0.9) bad('coverage', '释义用字覆盖率 ' + (coverage * 100).toFixed(1) + '% < 90%：' + word);
    else if (coverage < 0.95) warn('coverage', '释义用字覆盖率 ' + (coverage * 100).toFixed(1) + '% < 95%，必须重写一次：' + word);
    // 释义只需要挡住“祈使句式的操作指引”；解释“什么是点开”本身不算教操作。
    const imperativeRisk = /(请输入|请点击|请点开|请告诉|请把.{0,6}(验证码|密码|卡号|身份证)|告诉客服|点开链接|打开链接|共享屏幕|远程控制)/;
    if (RISK_WORD.test(word) && imperativeRisk.test(def) && !CAUTION.test(def)) {
      bad('safety', '风险词的释义像在教操作：' + word);
    }
  }

  if (entry.example !== undefined && entry.example !== null && entry.example !== '') {
    const ex = typeof entry.example === 'string' ? entry.example.trim() : '';
    if (typeof entry.example !== 'string') {
      bad('example', 'example 必须是字符串：' + word);
    } else if (!ex) {
      warn('example', 'example 是空字符串，建议删除字段：' + word);
    } else {
      const len = hanChars(ex).length;
      if (len < 6) bad('example', '例句汉字少于 6 个：' + word);
      if (len < 10) warn('example-length', '例句 ' + len + ' 个汉字，目标 10–40：' + word);
      if (len > 40) warn('example-length', '例句 ' + len + ' 个汉字，目标 10–40：' + word);
      if (len > 120) bad('example', '例句超过 120 字：' + word);
      if (/[A-Za-z0-9]/.test(ex)) bad('ascii', '例句含英文/数字：' + word);
      if (/https?:\/\/|www\./i.test(ex)) bad('url', '例句含网址：' + word);
      if (/<[^>]*>/.test(ex)) bad('html', '例句含 HTML：' + word);
      if (/[（）()【】\[\]<>《》]/.test(ex)) bad('bracket', '例句含括号：' + word);
      if (!/[。！？]$/.test(ex)) warn('example-ending', '例句没有句末标点：' + word);
      for (const word of TONE_WORDS) {
        if (ex.includes(word)) bad('tone', '例句含指责性词语「' + word + '」：' + entry.word);
      }
      // 把目标词本身从例句里去掉再找动词：解释“汇款要写对户名”不算教操作。
      const probe = ex.split(word).join('');
      if (RISK_WORD.test(word) && DANGER_VERB.test(probe) && !CAUTION.test(ex)) {
        bad('safety', '风险词的例句像在教操作：' + word);
      }
      const hans = hanChars(ex);
      const inside = hans.filter((c) => COMMON.has(c));
      notes.exampleCoverage = Number(pct(inside.length, hans.length).toFixed(3));
    }
  }

  if (entry.pinyin !== undefined && entry.pinyin !== null && entry.pinyin !== '') {
    const pin = typeof entry.pinyin === 'string' ? entry.pinyin.trim() : '';
    if (!pin) {
      warn('pinyin', 'pinyin 是空字符串，建议删除字段：' + word);
    } else {
      const syllables = pin.split(/\s+/);
      if (charLen(word) !== syllables.length) {
        warn('pinyin', '拼音音节数 ' + syllables.length + ' ≠ 字数 ' + charLen(word) + '：' + word);
      }
      if (charLen(pin) > 40) bad('pinyin', '拼音超过 40 字：' + word);
      if (!/^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜêɑɡ ]+$/.test(pin)) {
        bad('pinyin', '拼音含非法字符（用带声调拼音）：' + word);
      } else if (!/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(pin)) {
        warn('pinyin', '拼音没有声调：' + word);
      }
    }
  }

  if (entry.source !== undefined && entry.source !== null && entry.source !== '') {
    const source = String(entry.source);
    if (/https?:\/\/|www\./i.test(source)) bad('source', 'source 不能是网址：' + word);
    if (charLen(source) > 80) bad('source', 'source 超过 80 字：' + word);
    if (!ctx.draftMode && !source.startsWith('auto-')) {
      warn('source', 'source 不是 auto- 开头，UI 会当人工高可信内容：' + word);
    }
  } else if (!ctx.draftMode) {
    bad('source', '运行时 JSON 缺少 source；机器审校内容必须用 auto- 前缀：' + word);
  }

  return { errors, warnings, notes };
}

// ── 文件级检查 ───────────────────────────────────────────
function checkReleaseFile(name, data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: [{ rule: 'struct', message: name + '：顶层必须是对象' }], warnings };
  }
  for (const key of Object.keys(data)) {
    if (!TOP_FIELDS.has(key)) errors.push({ rule: 'struct', message: name + '：出现 schema 外字段 ' + key });
  }
  if (data.version !== 1) errors.push({ rule: 'version', message: name + '：version 必须是 1' });
  if (typeof data.name !== 'string' || !data.name) {
    errors.push({ rule: 'name', message: name + '：缺少 name（UI 来源标签要用）' });
  } else {
    if (charLen(data.name) > 40) errors.push({ rule: 'name', message: name + '：name 超过 40 字' });
    if (charLen(data.name) > 12) warnings.push({ rule: 'name', message: name + '：name 超过 12 字，小窗会占地方' });
  }
  if (typeof data.license !== 'string' || !data.license) {
    errors.push({ rule: 'license', message: name + '：缺少 license' });
  }
  if (!Array.isArray(data.entries)) {
    errors.push({ rule: 'entries', message: name + '：缺少 entries 数组' });
    return { errors, warnings };
  }
  if (data.entries.length === 0) errors.push({ rule: 'entries', message: name + '：entries 是空的' });
  if (data.entries.length > 5000) errors.push({ rule: 'entries', message: name + '：超过 5000 条' });
  return { errors, warnings };
}

// ── 收集输入 ─────────────────────────────────────────────
function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort()
    .map((name) => path.join(dir, name));
}

function listDraftFiles(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const drafts = path.join(full, 'drafts.jsonl');
    if (existsSync(drafts)) result.push(drafts);
  }
  return result.sort();
}

const inputs = draftMode
  ? listDraftFiles(path.join(ROOT, 'corpus/workbench')).map((file) => ({
      file,
      label: path.relative(ROOT, file).replace(/\\/g, '/'),
      fileErrors: [],
      fileWarnings: [],
      entries: readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return { __parseError: '第 ' + (index + 1) + ' 行 JSON 解析失败：' + error.message };
          }
        }),
    }))
  : listJsonFiles(path.join(ROOT, 'corpus/release')).map((file) => {
      const label = path.relative(ROOT, file).replace(/\\/g, '/');
      let data;
      try {
        data = JSON.parse(readFileSync(file, 'utf8'));
      } catch (error) {
        return {
          file,
          label,
          fileErrors: [{ rule: 'json', message: label + '：JSON 解析失败（' + error.message + '）' }],
          fileWarnings: [],
          entries: [],
        };
      }
      const checked = checkReleaseFile(label, data);
      return { file, label, fileErrors: checked.errors, fileWarnings: checked.warnings, entries: data.entries ?? [] };
    });

if (inputs.length === 0) {
  console.error('✗ 没有找到要检查的文件（' + (draftMode ? 'corpus/workbench/*/drafts.jsonl' : 'corpus/release/*.json') + '）');
  process.exit(2);
}

// ── 跑检查 ───────────────────────────────────────────────
const ctx = { cards, local, seen: new Map(), draftMode };
const report = { mode: draftMode ? 'drafts' : 'release', files: [], totals: { entries: 0, errors: 0, warnings: 0 } };
const seenIds = new Set();
let hasError = false;

for (const input of inputs) {
  const fileReport = { file: input.label, entries: 0, errors: input.fileErrors.length, warnings: input.fileWarnings.length, items: [] };
  if (input.fileErrors.length > 0) hasError = true;
  for (const entry of input.entries) {
    if (entry && typeof entry === 'object' && entry.__parseError) {
      fileReport.items.push({ word: null, errors: [{ rule: 'json', message: entry.__parseError }], warnings: [] });
      fileReport.errors += 1;
      hasError = true;
      continue;
    }
    const word = entry && typeof entry === 'object' ? String(entry.word ?? '') : '';
    const where = input.label + '#' + word;
    const checked = checkEntry(entry, where, ctx);
    fileReport.entries += 1;
    fileReport.errors += checked.errors.length;
    fileReport.warnings += checked.warnings.length;
    if (checked.errors.length > 0) hasError = true;
    fileReport.items.push({
      word: word || null,
      definition: entry && entry.definition ? entry.definition : null,
      errors: checked.errors,
      warnings: checked.warnings,
      coverage: checked.notes.coverage,
      exampleCoverage: checked.notes.exampleCoverage,
      tierC: checked.notes.tierC,
    });
    if (!draftMode && word) seenIds.add(word);
  }
  report.totals.entries += fileReport.entries;
  report.totals.errors += fileReport.errors;
  report.totals.warnings += fileReport.warnings;
  report.files.push(fileReport);

  const problems = fileReport.items.filter((item) => item.errors.length > 0 || item.warnings.length > 0);
  console.log('· ' + input.label + '：' + fileReport.entries + ' 条，' + fileReport.errors + ' 错，' + fileReport.warnings + ' 提醒');
  for (const item of problems.slice(0, 200)) {
    for (const error of item.errors) console.log('  ✗ [' + error.rule + '] ' + (item.word ?? '?') + '：' + error.message);
    for (const warning of item.warnings) console.log('  ⚠ [' + warning.rule + '] ' + (item.word ?? '?') + '：' + warning.message);
  }
}

// 字数分布（2–4 字占比 ≥80% 的目标）
if (!draftMode) {
  const lengths = [];
  for (const input of inputs) {
    for (const entry of input.entries) {
      if (entry && entry.word) lengths.push(charLen(String(entry.word)));
    }
  }
  const short = lengths.filter((len) => len >= 2 && len <= 4).length;
  const ratio = pct(short, lengths.length);
  report.totals.twoToFour = Number(ratio.toFixed(3));
  console.log('· 2–4 字词占比：' + (ratio * 100).toFixed(1) + '%（目标 ≥80%）');
  if (ratio < 0.8) {
    report.totals.warnings += 1;
    console.log('  ⚠ 2–4 字词占比低于 80%');
  }
}

report.ok = !hasError;
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(
  '\n' + (hasError ? '✗ 未通过' : '✓ 通过') + '：' + report.totals.entries + ' 条，' +
    report.totals.errors + ' 个 hard fail，' + report.totals.warnings + ' 个提醒。',
);
process.exit(hasError ? 1 : 0);

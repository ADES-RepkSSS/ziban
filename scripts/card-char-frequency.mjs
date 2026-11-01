#!/usr/bin/env node
/**
 * 词卡单字频率统计。
 *
 * 用法：node scripts/card-char-frequency.mjs [选项] [卡片文件或目录 ...]
 * 文档：docs/14-card-char-frequency.md
 *
 * 默认读取 content/cards/level*.yaml（50 张基线 + 500 张扩量 = 550 张），
 * 统计目标词（text；批次文件用 word）里的汉字，按出现次数从多到少输出。
 * 只读本地文件，不联网。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import {
  countCards,
  dedupeCards,
  looksLikeCard,
  normalizeCard,
  normalizeFields,
  selectFrequency,
  sortFrequency,
} from './lib/card-char-frequency.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INPUT = path.join(ROOT, 'content', 'cards');

// 目录扫描只认这几类文件，避免把 visuals/seed/预览当成卡片重复统计。
const CARD_FILE_PATTERN = /^(?:level\d+|cards)\.(?:ya?ml|json)$/i;
const BATCH_FILE_PATTERN = /\.out\.json$/i;
const SUPPORTED_FORMATS = ['text', 'tsv', 'csv', 'json', 'markdown'];

function splitOption(argument) {
  const index = argument.indexOf('=');
  if (index === -1) return [argument, null];
  return [argument.slice(0, index), argument.slice(index + 1)];
}

function parseInteger(name, value, { min = 0 } = {}) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${name} 需要一个整数，收到「${value}」`);
  }
  const number = Number(value);
  if (number < min) throw new Error(`${name} 不能小于 ${min}`);
  return number;
}

function parseArgs(argv) {
  const options = {
    inputs: [],
    fields: [],
    top: 0,
    min: 1,
    format: 'text',
    output: '',
    includeNonHan: false,
    dedupe: true,
    quiet: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--') {
      options.inputs.push(...argv.slice(index + 1));
      break;
    }
    if (argument === '-h' || argument === '--help') {
      options.help = true;
      continue;
    }

    const [name, inlineValue] = splitOption(argument);
    const readValue = () => {
      if (inlineValue !== null) {
        if (inlineValue === '') throw new Error(`${name} 缺少参数值`);
        return inlineValue;
      }
      index += 1;
      if (index >= argv.length) throw new Error(`${name} 缺少参数值`);
      return argv[index];
    };

    if (name === '-i' || name === '--input') {
      options.inputs.push(readValue());
    } else if (name === '-f' || name === '--field') {
      options.fields.push(readValue());
    } else if (name === '-t' || name === '--top') {
      options.top = parseInteger(name, readValue(), { min: 0 });
    } else if (name === '-m' || name === '--min') {
      options.min = parseInteger(name, readValue(), { min: 1 });
    } else if (name === '--format') {
      options.format = readValue().toLowerCase();
    } else if (name === '-o' || name === '--output') {
      options.output = readValue();
    } else if (name === '--include-non-han') {
      if (inlineValue !== null) throw new Error(`${name} 不带参数值`);
      options.includeNonHan = true;
    } else if (name === '--no-dedupe') {
      if (inlineValue !== null) throw new Error(`${name} 不带参数值`);
      options.dedupe = false;
    } else if (name === '-q' || name === '--quiet') {
      if (inlineValue !== null) throw new Error(`${name} 不带参数值`);
      options.quiet = true;
    } else if (argument.startsWith('-')) {
      throw new Error(`未知选项「${argument}」`);
    } else {
      options.inputs.push(argument);
    }
  }

  if (!SUPPORTED_FORMATS.includes(options.format)) {
    throw new Error(
      `未知输出格式「${options.format}」；可选：${SUPPORTED_FORMATS.join(' / ')}`,
    );
  }

  return options;
}

function printHelp() {
  console.log(`词卡单字频率统计（只读本地文件，不联网）

用法：
  node scripts/card-char-frequency.mjs [选项] [卡片文件或目录 ...]
  pnpm cards:chars -- [选项] [卡片文件或目录 ...]

默认读取 content/cards 下的 level*.yaml（550 张卡），统计目标词里的汉字。

选项：
  -i, --input <路径>      卡片文件或目录，可重复；目录只读 level*.yaml/yml、
                          cards.yaml/yml/json、*.out.json（不递归）
  -f, --field <字段>      text | meaning | sentence | alt | all，可重复；默认 text
  -t, --top <n>           只输出前 n 个；0 = 全部（默认）
  -m, --min <n>           只输出出现次数 >= n 的字；默认 1
      --format <格式>     text | tsv | csv | json | markdown；默认 text
  -o, --output <路径>     写入文件（UTF-8）；默认输出到 stdout
      --include-non-han   非汉字也计数（默认只计汉字）
      --no-dedupe         不按卡片 id 去重（默认去重）
  -q, --quiet             不打印摘要
  -h, --help              显示本帮助

示例：
  pnpm cards:chars
  pnpm cards:chars -- --top 30
  node scripts/card-char-frequency.mjs --format json --output work/char-stats/cards-550.json
  node scripts/card-char-frequency.mjs --input work/cards500/batches/batch-01.out.json
  node scripts/card-char-frequency.mjs --field text --field meaning --top 50

默认 text 输出每行「单字<TAB>出现次数」，按出现次数从多到少排列；
摘要写到 stderr，不污染 stdout。`);
}

function displayPath(file) {
  const relative = path.relative(process.cwd(), file);
  const display = relative && !relative.startsWith('..') ? relative : file;
  return display.split(path.sep).join('/');
}

function collectCardFiles(inputs) {
  const files = [];
  const seen = new Set();

  const addFile = (file) => {
    const absolute = path.resolve(file);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    files.push(absolute);
  };

  for (const input of inputs) {
    const absolute = path.resolve(process.cwd(), input);
    let stat;
    try {
      stat = fs.statSync(absolute);
    } catch {
      throw new Error(`找不到输入：${input}`);
    }

    if (stat.isFile()) {
      addFile(absolute);
      continue;
    }
    if (!stat.isDirectory()) {
      throw new Error(`输入不是文件或目录：${input}`);
    }

    const names = fs
      .readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter(
        (name) => CARD_FILE_PATTERN.test(name) || BATCH_FILE_PATTERN.test(name),
      )
      // 同一个目录同时有 cards.yaml 和 cards.json 时，优先保留 YAML（源文件），
      // 避免拿生成 JSON 覆盖人工维护的字段。
      .sort((a, b) => {
        const aJson = /\.json$/i.test(a) ? 1 : 0;
        const bJson = /\.json$/i.test(b) ? 1 : 0;
        return aJson - bJson || a.localeCompare(b, 'zh-Hans-CN', { numeric: true });
      });

    if (names.length === 0) {
      throw new Error(
        `目录里没有可读卡片文件：${input}（支持 level*.yaml/yml、cards.yaml/yml/json、*.out.json；也可以直接传文件）`,
      );
    }
    for (const name of names) addFile(path.join(absolute, name));
  }

  if (files.length === 0) throw new Error('没有可读的卡片文件');
  return files;
}

function readCardFile(file) {
  const display = displayPath(file);
  if (!/\.(?:ya?ml|json)$/i.test(file)) {
    throw new Error(`${display} 不是 .yaml/.yml/.json；本工具不支持 CSV`);
  }

  let text;
  try {
    text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    throw new Error(`读取失败 ${display}：${error.message}`);
  }

  let data;
  try {
    data = /\.json$/i.test(file) ? JSON.parse(text) : YAML.parse(text);
  } catch (error) {
    throw new Error(`解析失败 ${display}：${error.message}`);
  }

  const rawCards = Array.isArray(data)
    ? data
    : data && Array.isArray(data.cards)
      ? data.cards
      : null;

  if (!rawCards) {
    throw new Error(`${display} 不是卡片数组，也不是 { cards: [...] }`);
  }

  const cards = [];
  let ignored = 0;
  rawCards.forEach((raw, index) => {
    if (!looksLikeCard(raw)) {
      ignored += 1;
      return;
    }
    try {
      cards.push(normalizeCard(raw, { source: display, index }));
    } catch (error) {
      throw new Error(`${display} 第 ${index + 1} 条：${error.message}`);
    }
  });

  if (cards.length === 0) {
    throw new Error(`${display} 没有找到含 text/word 的卡片`);
  }

  return { cards, ignored };
}

function loadCards(inputs) {
  const files = collectCardFiles(inputs);
  const cards = [];
  const sources = [];
  let ignored = 0;

  for (const file of files) {
    const loaded = readCardFile(file);
    cards.push(...loaded.cards);
    sources.push(displayPath(file));
    ignored += loaded.ignored;
  }

  return { cards, sources, ignored };
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function formatText(entries) {
  return (
    entries.map((entry) => `${entry.char}\t${entry.count}`).join('\n') +
    (entries.length > 0 ? '\n' : '')
  );
}

function formatTsv(entries) {
  const lines = ['单字\t次数\t卡数'];
  for (const entry of entries) {
    lines.push(`${entry.char}\t${entry.count}\t${entry.cardCount}`);
  }
  return `${lines.join('\n')}\n`;
}

function formatCsv(entries) {
  const rows = [['单字', '次数', '卡数']];
  for (const entry of entries) {
    rows.push([entry.char, entry.count, entry.cardCount]);
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function formatMarkdown(entries, meta) {
  const { result, sources, fields, duplicates, includeNonHan } = meta;
  const lines = [
    '# 词卡单字频率',
    '',
    `> 统计字段：${fields.join(' + ')}；${includeNonHan ? '含非汉字' : '只计汉字'}。`,
    `> 输入：${sources.map((source) => `\`${source}\``).join('、')}`,
    '',
    '| 指标 | 值 |',
    '|---|---:|',
    `| 卡片 | ${result.cards} |`,
    `| 不同单字 | ${result.uniqueChars} |`,
    `| 总出现次数 | ${result.totalOccurrences} |`,
    `| 跳过非汉字 | ${result.skippedNonHan} |`,
    `| 去重跳过卡片 | ${duplicates.length} |`,
    `| 显示 | ${entries.length} / ${result.uniqueChars} |`,
    '',
    '| 排名 | 单字 | 出现次数 | 卡数 |',
    '|---:|---|---:|---:|',
  ];

  entries.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${markdownCell(entry.char)} | ${entry.count} | ${entry.cardCount} |`,
    );
  });

  lines.push(
    '',
    '> 排序：出现次数降序 → 卡数降序 → 首次出现顺序 → 码点。',
    '> 由 `scripts/card-char-frequency.mjs` 生成；说明见 `docs/14-card-char-frequency.md`。',
    '',
  );
  return lines.join('\n');
}

function formatJson(entries, meta) {
  const { result, sources, fields, duplicates, includeNonHan, min, top } = meta;
  const payload = {
    schemaVersion: 1,
    fields,
    includeNonHan,
    inputs: sources,
    cards: result.cards,
    uniqueChars: result.uniqueChars,
    totalOccurrences: result.totalOccurrences,
    skippedNonHan: result.skippedNonHan,
    duplicateCards: duplicates.length,
    shown: entries.length,
    filters: { min, top },
    counts: entries.map((entry) => ({
      char: entry.char,
      count: entry.count,
      cardCount: entry.cardCount,
      firstCard: entry.firstCard,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function formatOutput(format, entries, meta) {
  if (format === 'text') return formatText(entries);
  if (format === 'tsv') return formatTsv(entries);
  if (format === 'csv') return formatCsv(entries);
  if (format === 'markdown') return formatMarkdown(entries, meta);
  return formatJson(entries, meta);
}

function writeOutput(file, content, { csv = false } = {}) {
  const absolute = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  // 写 CSV 文件时加 BOM，Excel 打开中文才不会乱码；stdout 不加。
  fs.writeFileSync(absolute, csv ? `\uFEFF${content}` : content, 'utf8');
  return absolute;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const inputs = options.inputs.length > 0 ? options.inputs : [DEFAULT_INPUT];
  const fields = normalizeFields(options.fields.length > 0 ? options.fields : ['text']);

  const { cards, sources, ignored } = loadCards(inputs);
  const { cards: uniqueCards, duplicates } = dedupeCards(cards, {
    dedupe: options.dedupe,
  });
  if (uniqueCards.length === 0) throw new Error('没有卡片可统计');

  const result = countCards(uniqueCards, {
    fields,
    includeNonHan: options.includeNonHan,
  });
  const sorted = sortFrequency(result.entries);
  const entries = selectFrequency(sorted, {
    min: options.min,
    top: options.top,
  });

  const meta = {
    result,
    sources,
    fields,
    duplicates,
    includeNonHan: options.includeNonHan,
    min: options.min,
    top: options.top,
  };

  const output = formatOutput(options.format, entries, meta);
  if (options.output) {
    const written = writeOutput(options.output, output, {
      csv: options.format === 'csv',
    });
    if (!options.quiet) {
      console.error(`已写入 ${displayPath(written)}`);
    }
  } else {
    process.stdout.write(output);
  }

  if (!options.quiet) {
    const summary = [
      `✓ ${result.cards} 张卡`,
      `${result.uniqueChars} 个单字`,
      `${result.totalOccurrences} 次出现`,
      `字段 ${fields.join('+')}`,
      options.includeNonHan ? '含非汉字' : '只计汉字',
    ];
    if (options.min > 1 || options.top > 0) {
      summary.push(`显示 ${entries.length}/${result.uniqueChars}`);
    }
    if (duplicates.length > 0) summary.push(`跳过重复卡 ${duplicates.length}`);
    if (ignored > 0) summary.push(`忽略非卡片对象 ${ignored}`);
    if (result.skippedNonHan > 0) summary.push(`跳过非汉字 ${result.skippedNonHan}`);
    console.error(summary.join(' · '));
  }
}

try {
  main();
} catch (error) {
  console.error(`✗ ${error.message}`);
  console.error('  运行 node scripts/card-char-frequency.mjs --help 查看用法。');
  process.exitCode = 1;
}

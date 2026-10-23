#!/usr/bin/env node
/**
 * 校验外部语料库 JSON（apps/desktop 的 CorpusStore 读取的那份格式）。
 *
 * 用法：
 *   pnpm corpus:validate path/to/medical.json [more.json]
 *
 * 这不是 schema 的替代品；作者应先看 schema/corpus.schema.json。
 * 脚本只做“内容侧最容易犯的错”：版本、字段长度、重复词、HTML/网址、危险示例。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_WORD = 8;
const MAX_TEXT = 120;
const MAX_ENTRIES = 5000;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('用法：pnpm corpus:validate <file.json> [more.json]');
  process.exit(2);
}

const errors = [];
const warnings = [];
const seen = new Map();

function charLength(value) {
  return Array.from(value).length;
}

function hasMarkup(value) {
  return /<\s*\/?\s*[a-z][^>]*>/i.test(value);
}

function hasUrl(value) {
  return /(?:https?:\/\/|www\.)/i.test(value);
}

function validateText(value, label, { required = false, max = MAX_TEXT } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push(`${label}：不能为空`);
    return;
  }
  if (typeof value !== 'string') {
    errors.push(`${label}：必须是字符串`);
    return;
  }
  const text = value.trim();
  if (!text) {
    if (required) errors.push(`${label}：不能为空`);
    return;
  }
  if (charLength(text) > max) errors.push(`${label}：超过 ${max} 字`);
  if (hasMarkup(text)) errors.push(`${label}：不要包含 HTML`);
  if (hasUrl(text)) errors.push(`${label}：不要包含网址`);
}

for (const file of files) {
  const display = path.relative(process.cwd(), file) || file;
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${display}：JSON 解析失败（${error.message}）`);
    continue;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`${display}：顶层必须是对象`);
    continue;
  }
  if (data.version !== 1) errors.push(`${display}：version 必须是 1`);
  if (data.name !== undefined) validateText(data.name, `${display} name`, { max: 40 });
  if (data.license !== undefined) validateText(data.license, `${display} license`, { max: 40 });
  if (!Array.isArray(data.entries)) {
    errors.push(`${display}：缺少 entries 数组`);
    continue;
  }
  if (data.entries.length > MAX_ENTRIES) {
    errors.push(`${display}：entries 超过 ${MAX_ENTRIES} 条`);
  }
  if (data.entries.length === 0) warnings.push(`${display}：entries 是空的`);

  data.entries.forEach((entry, index) => {
    const at = `${display} [${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${at}：词条必须是对象`);
      return;
    }
    const word = typeof entry.word === 'string' ? entry.word.trim() : '';
    if (!word) {
      errors.push(`${at}：缺少 word`);
    } else {
      if (charLength(word) > MAX_WORD) errors.push(`${at} word：超过 ${MAX_WORD} 字`);
      if (/\s/.test(word)) errors.push(`${at} word：不要包含空白`);
      if (/[<>/\\]/.test(word)) errors.push(`${at} word：不要包含标点/HTML`);
      if (charLength(word) === 1) warnings.push(`${at} word：单字，建议改成 2–4 字词`);
      if (seen.has(word)) {
        errors.push(`${at} word：重复“${word}”（首次在 ${seen.get(word)}）`);
      } else {
        seen.set(word, at);
      }
    }

    validateText(entry.definition, `${at} definition`, { required: true });
    validateText(entry.example, `${at} example`);
    validateText(entry.pinyin, `${at} pinyin`, { max: 40 });
    validateText(entry.source, `${at} source`, { max: 80 });

    // 风险词：只提醒，不判错；审校的人要特别看这些。
    const risky = /验证码|转账|冻结|退款|中奖|密码|链接|客服|汇款/.test(word);
    if (risky && entry.example && /(输入|点击|告诉|转给|发给)/.test(entry.example)) {
      warnings.push(`${at}：风险词的例句包含操作动词，请人工确认是否在教危险操作`);
    }
  });
}

if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} 条提醒：`);
  for (const warning of warnings.slice(0, 40)) console.warn(`  - ${warning}`);
  if (warnings.length > 40) console.warn(`  ... 还有 ${warnings.length - 40} 条`);
}

if (errors.length > 0) {
  console.error(`✗ ${errors.length} 个错误：`);
  for (const error of errors.slice(0, 50)) console.error(`  - ${error}`);
  if (errors.length > 50) console.error(`  ... 还有 ${errors.length - 50} 个`);
  process.exit(1);
}

const total = files.reduce((sum, file) => {
  try {
    return sum + (JSON.parse(readFileSync(file, 'utf8')).entries?.length ?? 0);
  } catch {
    return sum;
  }
}, 0);
console.log(`✓ 语料库检查通过：${files.length} 个文件，${total} 条词条。`);

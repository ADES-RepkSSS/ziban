import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const root = process.cwd();
const file = path.join(root, 'content', 'cards', 'level2.yaml');
const data = JSON.parse(fs.readFileSync(path.join(root, 'work', 'char-audit', 'rebalance-data.json'), 'utf8'));
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const starts = [];
for (let i = 0; i < lines.length; i += 1) {
  if (/^- id: /.test(lines[i])) starts.push(i);
}
if (!starts.length) throw new Error('no card blocks');
const header = lines.slice(0, starts[0]).join('\n');
const blocks = [];
for (let i = 0; i < starts.length; i += 1) {
  const end = i + 1 < starts.length ? starts[i + 1] : lines.length;
  blocks.push(lines.slice(starts[i], end).join('\n').replace(/\n+$/, ''));
}
const parsed = YAML.parse(text);
const byId = new Map(parsed.map((c) => [c.id, c]));

const q = (s) => JSON.stringify(s);
const blockFor = (c) => {
  const pinyin = c.pinyin.map(q).join(', ');
  return [
    `- id: ${c.id}`,
    `  text: ${c.text}`,
    `  chars: [${c.chars.join(', ')}]`,
    `  pinyin: [${pinyin}]`,
    `  level: ${c.level}`,
    `  scene: ${c.scene}`,
    `  meaning: ${c.meaning}`,
    `  meaning_source: { dict: self, entry: ${c.text}, rev: "rebalance-2026-11" }`,
    `  sentence: ${c.sentence}`,
    `  sentence_source: { corpus: self, doc: "rebalance-2026-11" }`,
    `  image: { file: ${c.image}, lib: self, license: CC-BY-SA-4.0, alt: ${q(c.imageAlt)} }`,
    '  status: draft',
    `  gen: { model: deepseek-flash, prompt_ver: "rebalance@1", hash: "rebalance-${c.id}" }`,
  ].join('\n');
};

const replaceById = new Map(data.replacements.map((r) => [r.id, r]));
const remove = new Set(data.removeIds);
if (remove.size !== data.removeIds.length) throw new Error('duplicate remove id');
const out = [];
for (const block of blocks) {
  const id = block.match(/^- id: (\S+)/)?.[1];
  if (!id) throw new Error('block without id');
  if (remove.has(id)) continue;
  if (replaceById.has(id)) {
    out.push(blockFor(replaceById.get(id)));
    continue;
  }
  out.push(block);
}
for (const a of data.additions) {
  if (remove.has(a.id) || replaceById.has(a.id)) throw new Error(`new id conflicts: ${a.id}`);
  if (out.some((b) => b.includes(`- id: ${a.id}\n`))) throw new Error(`duplicate id block: ${a.id}`);
  out.push(blockFor(a));
}
const result = `${header}\n\n${out.join('\n\n')}\n`;
const check = YAML.parse(result);
if (check.length !== 500) throw new Error(`expected 500 cards in level2, got ${check.length}`);
const ids = new Set(check.map((c) => c.id));
if (ids.size !== check.length) throw new Error('duplicate ids');
const texts = new Set(check.map((c) => c.text));
if (texts.size !== check.length) throw new Error('duplicate texts');
for (const c of check) {
  if (c.text !== c.chars.join('')) throw new Error(`${c.id}: text/chars mismatch`);
  if (c.pinyin.length !== c.chars.length) throw new Error(`${c.id}: pinyin count mismatch`);
}
fs.writeFileSync(file, result, 'utf8');

const map = [];
for (const r of data.replacements) map.push({ id: r.id, from: byId.get(r.id)?.text, to: r.text, kind: 'replace' });
for (const id of data.removeIds) map.push({ id, from: byId.get(id)?.text, to: null, kind: 'remove' });
for (const a of data.additions) map.push({ id: a.id, from: null, to: a.text, kind: 'add' });
fs.writeFileSync(path.join(root, 'work', 'char-audit', 'rebalance-map.json'), `${JSON.stringify(map, null, 2)}\n`);
console.log(JSON.stringify({ cards: check.length, removed: data.removeIds.length, replaced: data.replacements.length, added: data.additions.length }, null, 2));

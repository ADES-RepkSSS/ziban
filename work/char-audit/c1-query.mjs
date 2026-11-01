import fs from 'node:fs';
const cards = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const freq = new Map();
for (const c of cards) for (const ch of c.chars) freq.set(ch, (freq.get(ch) || 0) + 1);
const charsetRaw = fs.readFileSync('corpus/chars/common2000.txt', 'utf8');
const allowed = new Set();
for (const line of charsetRaw.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  for (const ch of line.trim()) allowed.add(ch);
}
const chars = process.argv[2] || '';
const rows = [...chars].map((ch) => `${ch}\t${freq.get(ch) ?? 0}\t${allowed.has(ch) ? 'ok' : 'NOT-IN-2000'}`);
console.log(rows.join('\n'));

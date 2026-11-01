import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const base = new Map(rows.map((r) => [r.id, r]));
const freqOf = (list) => {
  const f = new Map();
  for (const r of list) for (const ch of r.chars) f.set(ch, (f.get(ch) || 0) + 1);
  return f;
};
const baseFreq = freqOf(rows);
const sorted0 = [...baseFreq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const P1 = ['w_498', 'w_144', 'w_178', 'w_203', 'w_489', 'w_293', 'w_491', 'w_137', 'w_120', 'w_262', 'w_190', 'w_186', 'w_188'];
const P2 = ['w_360', 'w_380', 'w_389', 'w_369', 'w_046', 'w_321', 'w_331', 'w_097', 'w_098', 'w_122', 'w_101', 'w_139', 'w_057', 'w_147'];
const ALL = [...P1, ...P2];
const REPL = ['心脏', '省钱', '卧室'];
const ADD = ['高血压', '体温', '牙刷', '护工', '退烧', '中医', '血压计', '假牙', '养老院', '手脚'];

function stat(list, label) {
  const f = freqOf(list);
  const total = [...f.values()].reduce((a, b) => a + b, 0);
  const sorted = [...f.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const counts = [...f.values()].sort((a, b) => a - b);
  const mean = total / f.size;
  let sa = 0;
  for (const x of counts) for (const y of counts) sa += Math.abs(x - y);
  const gini = sa / (2 * counts.length * counts.length * mean);
  const single = counts.filter((n) => n === 1).length;
  const b24 = counts.filter((n) => n >= 2 && n <= 4);
  console.log(`\n=== ${label} ===`);
  console.log(`cards=${list.length} chars=${f.size} occ=${total} max=${sorted[0][1]} mean=${mean.toFixed(2)} Gini=${gini.toFixed(3)}`);
  console.log(`singles=${single}(${(single / f.size * 100).toFixed(1)}%) band2-4=${b24.length}ch/${b24.reduce((a, b) => a + b, 0)}occ(${(b24.reduce((a, b) => a + b, 0) / total * 100).toFixed(1)}%)`);
  console.log('top14: ' + sorted.slice(0, 14).map(([c, n]) => `${c}${n}`).join(' '));
  return { f, sorted, total, single, gini, cards: list.length };
}

const s0 = stat(rows, 'S0 现状');
const s1 = stat(rows.filter((r) => !P1.includes(r.id)), 'S1 只做 P1 (13 张)');
const s2 = stat(rows.filter((r) => !ALL.includes(r.id)), 'S2 P1+P2 (27 张)');
const addCards = ADD.map((w, i) => ({ id: `x_${i}`, text: w, chars: [...w], scene: 'new', level: 2 }));
const s3 = stat([...rows.filter((r) => !ALL.includes(r.id)), ...addCards], 'S3 27 删 + 10 补字 (532 张)');

console.log('\n=== projectedTop ===');
for (const [c, n] of sorted0.slice(0, 10)) console.log(`${c}\t${n} -> S1:${s1.f.get(c) ?? 0}\t S2:${s2.f.get(c) ?? 0}\t S3:${s3.f.get(c) ?? 0}`);
console.log('\nS2 top20: ' + s2.sorted.slice(0, 20).map(([c, n]) => `${c}${n}`).join(' '));
console.log('S3 chars lost: ' + [...baseFreq.keys()].filter((c) => !s2.f.has(c)).join(''));
console.log('unknown ids: ' + ALL.filter((id) => !base.has(id)).join(' ') || 'none');
console.log('\nremoved cards (id/text/total/chars):');
for (const id of ALL) { const r = base.get(id); console.log(`${id}\t${r.text}\t${r.total}\t${r.detail}`); }
const contrib = ALL.reduce((s, id) => s + [...base.get(id).chars].length, 0);
console.log(`\nremoved cards contribute ${contrib} occurrences (${(contrib / 1224 * 100).toFixed(1)}% of corpus)`);

fs.writeFileSync('work/char-audit/_f1-v2.json', JSON.stringify({
  P1, P2, REPL, ADD,
  s0: { cards: s0.cards, chars: s0.f.size, occ: s0.total, max: s0.sorted[0][1], single: s0.single, gini: +s0.gini.toFixed(3) },
  s1: { cards: s1.cards, chars: s1.f.size, occ: s1.total, max: s1.sorted[0][1], single: s1.single, gini: +s1.gini.toFixed(3) },
  s2: { cards: s2.cards, chars: s2.f.size, occ: s2.total, max: s2.sorted[0][1], single: s2.single, gini: +s2.gini.toFixed(3) },
  s3: { cards: s3.cards, chars: s3.f.size, occ: s3.total, max: s3.sorted[0][1], single: s3.single, gini: +s3.gini.toFixed(3) },
  top: sorted0.slice(0, 20).map(([c, n]) => ({ char: c, before: n, afterP1: s1.f.get(c) ?? 0, after: s2.f.get(c) ?? 0 })),
}, null, 1));

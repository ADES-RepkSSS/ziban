import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const P1 = ['w_498', 'w_144', 'w_178', 'w_203', 'w_489', 'w_293', 'w_491', 'w_137', 'w_120', 'w_262', 'w_190', 'w_186', 'w_188'];
const P2 = ['w_360', 'w_380', 'w_389', 'w_369', 'w_046', 'w_321', 'w_331', 'w_097', 'w_098', 'w_122', 'w_101', 'w_139', 'w_057', 'w_147'];
const ALL = new Set([...P1, ...P2]);
const freqOf = (list) => { const f = new Map(); for (const r of list) for (const ch of r.chars) f.set(ch, (f.get(ch) || 0) + 1); return f; };
const f0 = freqOf(rows);
const kept = rows.filter((r) => !ALL.has(r.id));
const f2 = freqOf(kept);
const hist = (f) => { const d = new Map(); for (const n of f.values()) d.set(n, (d.get(n) || 0) + 1); return [...d.entries()].sort((a, b) => b[0] - a[0]); };
console.log('HIST0 ' + hist(f0).map(([k, v]) => `${k}:${v}`).join(' '));
console.log('HIST2 ' + hist(f2).map(([k, v]) => `${k}:${v}`).join(' '));

// counts >= thresholds
for (const t of [1, 2, 3, 5, 8, 10]) {
  console.log(`>=${t}: chars ${[...f0.values()].filter((n) => n >= t).length} occ ${[...f0.values()].filter((n) => n >= t).reduce((a, b) => a + b, 0)}`);
}
// after
console.log('--- after ---');
for (const t of [1, 2, 3, 5, 8, 10]) {
  console.log(`>=${t}: chars ${[...f2.values()].filter((n) => n >= t).length} occ ${[...f2.values()].filter((n) => n >= t).reduce((a, b) => a + b, 0)}`);
}

// essential anchors per head char (kept cards only)
const top10 = [...f0.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c]) => c);
console.log('\n=== anchors per head char (kept) ===');
for (const c of top10) {
  const users = kept.filter((r) => r.chars.includes(c)).map((r) => r.text);
  console.log(`${c}(${f2.get(c)}): ${users.join(' ')}`);
}

// who is 5+ and growing after removal
const s2 = [...f2.entries()].sort((a, b) => b[1] - a[1]);
console.log('\ntop 20 after: ' + s2.slice(0, 20).map(([c, n]) => `${c}${n}`).join(' '));
console.log('next 10: ' + s2.slice(20, 30).map(([c, n]) => `${c}${n}`).join(' '));

// average card total before/after
console.log(`\navg total per card: before ${(rows.reduce((s, r) => s + [...r.chars].length, 0) / rows.length).toFixed(2)} after ${(kept.reduce((s, r) => s + [...r.chars].length, 0) / kept.length).toFixed(2)}`);

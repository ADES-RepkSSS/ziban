import fs from 'node:fs';

const md = fs.readFileSync('work/char-audit/frequency-plan.md', 'utf8');
const plan = JSON.parse(fs.readFileSync('work/char-audit/frequency-plan.json', 'utf8'));
const fail = [];
const ok = [];

// 1. every remove id present in MD
for (const r of plan.remove) if (!md.includes(r.id)) fail.push(`remove id not in MD: ${r.id} ${r.text}`);
ok.push(`remove ids in MD: ${plan.remove.length}/27`);

// 2. counts
const p1 = plan.remove.filter((r) => r.phase === 'P1').length;
const p2 = plan.remove.filter((r) => r.phase === 'P2').length;
if (p1 !== 13 || p2 !== 14) fail.push(`phase split ${p1}/${p2} != 13/14`);
ok.push(`phase split ${p1}/${p2}`);

// 3. no baseline card removed
if (plan.remove.some((r) => r.id.startsWith('c_'))) fail.push('baseline c_* card in remove list');
ok.push('no c_* baseline card removed');

// 4. projectedTop matches MD table rows
for (const p of plan.projectedTop.slice(0, 10)) {
  const re = new RegExp(`\\| ${p.char} \\| ${p.before} \\| ${p.afterP1} \\| \\*\\*${p.after}\\*\\* \\| -${p.before - p.after} \\|`);
  if (!re.test(md)) fail.push(`MD row mismatch for ${p.char}: expected ${p.before}/${p.afterP1}/${p.after}`);
}
ok.push('projectedTop rows match MD §8.2');

// 5. all remove cards are covered by reason + chars present in word
for (const r of plan.remove) {
  if (!r.reason || r.reason.length < 8) fail.push(`short reason: ${r.id}`);
  for (const c of r.chars) if (!r.text.includes(c)) fail.push(`char ${c} not in ${r.text}`);
  for (const c of Object.keys(r.highChars)) if (!r.text.includes(c)) fail.push(`highChar ${c} not in ${r.text}`);
}
ok.push('chars/highChars consistent with words');

// 6. keepHigh ids all exist in cards-with-freq and none removed
const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const ids = new Set(rows.map((r) => r.id));
const rm = new Set(plan.remove.map((r) => r.id));
for (const k of plan.keepHigh) {
  if (!ids.has(k.id)) fail.push(`keepHigh id missing: ${k.id}`);
  if (rm.has(k.id)) fail.push(`keepHigh id also removed: ${k.id} ${k.text}`);
}
ok.push(`keepHigh ${plan.keepHigh.length} ids exist and are not removed`);

// 7. addCandidates obey rule
for (const a of plan.addCandidates) {
  if (a.newChars.length) fail.push(`add has new chars: ${a.text}`);
  const is3 = [...a.text].length === 3;
  if (a.cost > (is3 ? 12 : 9)) fail.push(`add cost ${a.cost} too high: ${a.text}`);
  if (a.maxChar > (is3 ? 5 : 6)) fail.push(`add maxChar ${a.maxChar} too high: ${a.text}`);
}
ok.push(`addCandidates ${plan.addCandidates.length} obey selection rule`);

// 8. target / projection sanity
if (plan.target.max !== 10) fail.push('target.max != 10');
if (plan.projection.S2_removeP1P2.max !== 10) fail.push('S2 max != 10');
if (plan.projection.S2_removeP1P2.charsAt1 >= plan.baseline.charsAt1) fail.push('S2 did not reduce singletons');
ok.push(`target.max=${plan.target.max}, S2 max=${plan.projection.S2_removeP1P2.max}, singles ${plan.baseline.charsAt1}->${plan.projection.S2_removeP1P2.charsAt1}`);

// 9. required schema keys
for (const k of ['remove', 'keepHigh', 'target', 'projectedTop']) if (!(k in plan)) fail.push(`missing key ${k}`);
for (const k of ['id', 'text', 'reason', 'chars']) if (!(k in plan.remove[0])) fail.push(`remove[0] missing ${k}`);
for (const k of ['max', 'min', 'notes']) if (!(k in plan.target)) fail.push(`target missing ${k}`);
ok.push('required schema keys present');

console.log('PASS:\n  ' + ok.join('\n  '));
if (fail.length) { console.log('\nFAIL:\n  ' + fail.join('\n  ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

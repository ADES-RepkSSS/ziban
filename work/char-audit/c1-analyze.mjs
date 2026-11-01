import fs from 'node:fs';

const cards = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const freq = new Map();
for (const c of cards) {
  for (const ch of c.chars) freq.set(ch, (freq.get(ch) || 0) + 1);
}
const charsetRaw = fs.readFileSync('corpus/chars/common2000.txt', 'utf8');
const allowed = new Set();
const lines = charsetRaw.split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
for (const line of lines) for (const ch of line.trim()) allowed.add(ch);

const words = cards.map((c) => c.text);
const byFreq = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'));
const out = [];
out.push(`cards=${cards.length} uniqueChars=${freq.size} allowed=${allowed.size}`);
out.push('');
out.push('## TOP 40 单字');
out.push(byFreq.slice(0, 40).map(([ch, n], i) => `${i + 1}. ${ch} ${n}`).join('\n'));
out.push('');
out.push('## 频次 1 的字 (' + byFreq.filter(([, n]) => n === 1).length + ')');
out.push(byFreq.filter(([, n]) => n === 1).map(([ch]) => ch).join(''));
out.push('');
out.push('## 频次 2 的字 (' + byFreq.filter(([, n]) => n === 2).length + ')');
out.push(byFreq.filter(([, n]) => n === 2).map(([ch]) => ch).join(''));
out.push('');
out.push('## 频次 3 的字 (' + byFreq.filter(([, n]) => n === 3).length + ')');
out.push(byFreq.filter(([, n]) => n === 3).map(([ch]) => ch).join(''));
out.push('');
out.push('## 频次 4 的字 (' + byFreq.filter(([, n]) => n === 4).length + ')');
out.push(byFreq.filter(([, n]) => n === 4).map(([ch]) => ch).join(''));
out.push('');
const unused = [...allowed].filter((ch) => !freq.has(ch));
out.push('## 未用字 (freq 0, ' + unused.length + ')');
out.push(unused.join(''));
out.push('');
out.push('## 550 词（按场景）');
const scenes = ['health', 'money', 'travel', 'home', 'contact', 'gov', 'shopping', 'safety'];
for (const s of scenes) {
  const list = cards.filter((c) => c.scene === s);
  out.push(`### ${s} (${list.length})`);
  out.push(list.map((c) => `${c.text}(${c.total})`).join(' '));
}
out.push('');
out.push('## 全部 550 词拼音序');
out.push([...words].sort((a, b) => a.localeCompare(b, 'zh')).join(' '));

fs.writeFileSync('work/char-audit/c1-report.txt', out.join('\n'), 'utf8');
console.log('written');

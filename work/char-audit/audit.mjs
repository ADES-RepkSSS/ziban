import fs from 'node:fs';
import YAML from 'yaml';

const stats = JSON.parse(fs.readFileSync('work/char-stats/cards-550.json', 'utf8'));
const freq = new Map(stats.counts.map((x) => [x.char, x.count]));
const cards = [
  ...YAML.parse(fs.readFileSync('content/cards/level1.yaml', 'utf8')),
  ...YAML.parse(fs.readFileSync('content/cards/level2.yaml', 'utf8')),
];
const isHan = (ch) => /\p{Script=Han}/u.test(ch);
const rows = cards.map((c) => {
  const chars = [...c.text].filter(isHan);
  const detail = chars.map((ch) => `${ch}:${freq.get(ch) || 0}`).join(' ');
  const total = chars.reduce((s, ch) => s + (freq.get(ch) || 0), 0);
  return {
    id: c.id,
    text: c.text,
    scene: c.scene,
    level: c.level,
    chars: chars.join(''),
    total,
    max: Math.max(...chars.map((ch) => freq.get(ch) || 0)),
    detail,
    meaning: c.meaning,
    image: c.image.file,
  };
});
fs.writeFileSync('work/char-audit/cards-with-freq.json', JSON.stringify(rows, null, 2));
const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
const header = ['id', 'text', 'scene', 'level', 'chars', 'total', 'max', 'detail', 'meaning', 'image'];
const csv = [header, ...rows.map((r) => [r.id, r.text, r.scene, r.level, r.chars, r.total, r.max, r.detail, r.meaning, r.image])]
  .map((row) => row.map(esc).join(','))
  .join('\r\n');
fs.writeFileSync('work/char-audit/cards-with-freq.csv', `\ufeff${csv}\r\n`);

console.log(`rows ${rows.length}`);
console.log('top card totals');
console.log(rows.sort((a, b) => b.total - a.total).slice(0, 25).map((r) => `${r.total}\t${r.text}\t${r.detail}`).join('\n'));

// 按首字/尾字/结构粗分组，供相似词审计
const families = new Map();
for (const r of rows) {
  for (const size of [2, 3]) {
    for (let i = 0; i + size <= r.text.length; i += 1) {
      const key = r.text.slice(i, i + size);
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(r.text);
    }
  }
}
const repeated = [...families.entries()]
  .filter(([k, v]) => k.length >= 2 && new Set(v).size >= 3)
  .sort((a, b) => new Set(b[1]).size - new Set(a[1]).size)
  .slice(0, 80);
fs.writeFileSync(
  'work/char-audit/repeated-substrings.md',
  repeated.map(([k, v]) => `- ${k} (${new Set(v).size})：${[...new Set(v)].join('、')}`).join('\n'),
  'utf8',
);
console.log('\nrepeated substrings written');

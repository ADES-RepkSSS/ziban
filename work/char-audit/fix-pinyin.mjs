import fs from 'node:fs';
const p = 'content/cards/level2.yaml';
let t = fs.readFileSync(p, 'utf8');
const lines = t.split('\n');
let inCard = false;
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i] === '- id: w_046') inCard = true;
  else if (inCard && lines[i].startsWith('- id: ')) break;
  else if (inCard && lines[i].startsWith('  pinyin: ')) {
    lines[i] = '  pinyin: ["xīn", "zàng"]';
    break;
  }
}
fs.writeFileSync(p, lines.join('\n'));
console.log(lines.find((l) => l.includes('xīn')));

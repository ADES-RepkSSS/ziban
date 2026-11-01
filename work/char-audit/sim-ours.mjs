import fs from 'node:fs';
import YAML from 'yaml';

const cards = [
  ...YAML.parse(fs.readFileSync('content/cards/level1.yaml', 'utf8')),
  ...YAML.parse(fs.readFileSync('content/cards/level2.yaml', 'utf8')),
];
const remove = new Set([
  'w_498', 'w_144', 'w_178', 'w_203', 'w_489', 'w_293', 'w_491', 'w_137', 'w_120', 'w_262',
  'w_190', 'w_186', 'w_188', 'w_360', 'w_380', 'w_389', 'w_369', 'w_046', 'w_321', 'w_331',
  'w_097', 'w_098', 'w_122', 'w_101', 'w_139', 'w_057', 'w_147', 'w_454',
]);
const replace = new Map([
  ['w_046', '心脏'],
  ['w_321', '省钱'],
  ['w_203', '卧室'],
]);
const add = [
  // F1 10
  '高血压', '体温', '牙刷', '护工', '退烧', '中医', '血压计', '假牙', '养老院', '手脚',
  // 7 no-new chars
  '路牌', '拖地', '擦窗', '打字', '护照', '声明', '买菜',
  // 3 no-new chars
  '牙科', '眼科', '还钱',
];

const kept = cards
  .filter((c) => !remove.has(c.id) || replace.has(c.id))
  .map((c) => ({ ...c, text: replace.get(c.id) ?? c.text }));
const all = [...kept, ...add.map((text) => ({ id: `add_${text}`, text }))];
const freq = new Map();
for (const c of all) for (const ch of c.text) if (/\p{Script=Han}/u.test(ch)) freq.set(ch, (freq.get(ch) || 0) + 1);
const vals = [...freq.values()];
const hist = {};
for (const n of vals) hist[n] = (hist[n] || 0) + 1;
const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const once = vals.filter((n) => n === 1).length;
const two4 = vals.filter((n) => n >= 2 && n <= 4).length;
console.log(JSON.stringify({ cards: all.length, unique: freq.size, total: vals.reduce((a, b) => a + b, 0), max: Math.max(...vals), once, two4, hist, top: top.slice(0, 20) }, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const cards = [
  ...YAML.parse(fs.readFileSync('content/cards/level1.yaml', 'utf8')),
  ...YAML.parse(fs.readFileSync('content/cards/level2.yaml', 'utf8')),
];
const used = new Set(cards.map((c) => c.image.file));
const removed = [
  'w_498', 'w_144', 'w_178', 'w_489', 'w_293', 'w_491', 'w_137', 'w_120', 'w_262', 'w_190',
  'w_186', 'w_188', 'w_360', 'w_380', 'w_389', 'w_369', 'w_331', 'w_097', 'w_098', 'w_122',
  'w_101', 'w_139', 'w_057', 'w_147', 'w_454', 'w_431', 'w_124', 'w_088',
];
let count = 0;
for (const id of removed) {
  const file = `cards500-${id.slice(2)}.svg`;
  const p = path.join('content', 'images', file);
  if (!fs.existsSync(p)) continue;
  if (used.has(file)) throw new Error(`still referenced: ${file}`);
  fs.unlinkSync(p);
  count += 1;
}
console.log(JSON.stringify({ deleted: count, used: used.size, images: fs.readdirSync('content/images').filter((f) => f.endsWith('.svg')).length }, null, 2));

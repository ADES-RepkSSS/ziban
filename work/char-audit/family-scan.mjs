// 临时辅助脚本：相似词族扫描（不写 content/）
import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const byId = new Map(rows.map((r) => [r.id, r]));
const out = [];
const console = { log: (...a) => out.push(a.join(' ')) };
console.log('rows', rows.length);

const probes = [
  '假', '手机', '来电', '银行', '洗衣', '支付', '收', '取', '存', '汇',
  '密码', '验证码', '卡号', '票', '单', '证', '身份', '客服', '收费', '收银',
];
for (const p of probes) {
  const hit = rows.filter((r) => r.text.includes(p));
  console.log(`\n== ${p} (${hit.length}) ==`);
  console.log(hit.map((r) => `${r.id}\t${r.text}\t${r.scene}\tL${r.level}\t${r.meaning}`).join('\n'));
}

// 结构族：相同尾字/头字，出现 >=3 次
const tails = new Map();
const heads = new Map();
for (const r of rows) {
  const t = r.text.slice(-1);
  const h = r.text[0];
  if (!tails.has(t)) tails.set(t, []);
  if (!heads.has(h)) heads.set(h, []);
  tails.get(t).push(r);
  heads.get(h).push(r);
}
const fmt = (g) => g.map((r) => `${r.id}:${r.text}`).join(' ');
console.log('\n\n##### 尾字族 (>=4) #####');
for (const [k, g] of [...tails.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (g.length >= 4) console.log(`${k} (${g.length}) ${fmt(g)}`);
}
console.log('\n##### 头字族 (>=5) #####');
for (const [k, g] of [...heads.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (g.length >= 5) console.log(`${k} (${g.length}) ${fmt(g)}`);
}

// 校验传入 id 是否存在
const check = process.argv.slice(2);
if (check.length) {
  console.log('\n##### 指定 id 校验 #####');
  for (const id of check) console.log(id, byId.get(id)?.text ?? 'MISSING');
}

fs.writeFileSync('work/char-audit/family-scan.md', out.join('\n'), 'utf8');
process.stdout.write(`wrote family-scan.md (${out.length} lines)\n`);

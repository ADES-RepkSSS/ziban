import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json','utf8'));
const probes = ['发票','收据','诈骗','假货','二维码','短信','链接','验证','快递','外卖','打车','挂号','缴费','转账','余额','明细','流水','凭证','合同','押金','定金','保证金','遗嘱','养老','退休','医保','社保','老年','身份证','户口','居住','残疾','优待','公积金','补贴','低保'];
for (const p of probes) {
  const hit = rows.filter(r=>r.text.includes(p));
  if (!hit.length) console.log('MISSING', p);
}
console.log('--- exact text duplicates ---');
const m = new Map();
for (const r of rows) m.set(r.text, [...(m.get(r.text)||[]), r.id]);
for (const [t,ids] of m) if (ids.length>1) console.log(t, ids.join(','));

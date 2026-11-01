import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json','utf8'));
for (const ch of ['显','示','型','规','格','库','满','积','原','泡','发','理','拾','资','储','液','丝','冒','回','流','断','态','就','整','块','粉','养']) {
  const hit = rows.filter(r=>r.text.includes(ch));
  console.log(ch, hit.length, hit.map(r=>r.text).join(' '));
}

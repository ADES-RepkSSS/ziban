import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('work/char-audit/cards-with-freq.json', 'utf8'));
const out = [];
const log = (...a) => out.push(a.join(' '));

const chars = ['整', '理', '块', '丝', '片', '粉', '液', '支', '款', '储', '养', '退', '休', '冒', '诊', '就', '网', '银', '收', '回', '单', '流', '水', '态', '码', '签', '名', '取', '付', '假', '证', '卡', '票', '单', '密', '码', '费', '金', '机', '车', '站', '药', '医', '银', '行', '手', '电', '来', '客', '服', '存', '汇', '洗', '衣'];
for (const ch of chars) {
  const hit = rows.filter((r) => r.text.includes(ch));
  log(`\n## ${ch} (${hit.length}) ${hit.map((r) => `${r.text}(${r.id})`).join(' ')}`);
}

// 释义完全相同的卡片
const byMeaning = new Map();
for (const r of rows) {
  if (!byMeaning.has(r.meaning)) byMeaning.set(r.meaning, []);
  byMeaning.get(r.meaning).push(r);
}
log('\n\n##### 释义完全相同 #####');
for (const [m, g] of byMeaning) if (g.length > 1) log(`${m} => ${g.map((r) => `${r.text}(${r.id},${r.scene})`).join(' ')}`);

// 同场景内共享 1 个字且长度相同的词对，供人工判断
log('\n\n##### 同场景同长度、共享首/尾字的词对 #####');
const byScene = new Map();
for (const r of rows) {
  if (!byScene.has(r.scene)) byScene.set(r.scene, []);
  byScene.get(r.scene).push(r);
}
for (const [scene, g] of byScene) {
  const pairs = [];
  for (let i = 0; i < g.length; i += 1) {
    for (let j = i + 1; j < g.length; j += 1) {
      const a = g[i]; const b = g[j];
      if (a.text.length !== b.text.length) continue;
      if (a.text[0] === b.text[0] || a.text.at(-1) === b.text.at(-1)) {
        pairs.push(`${a.text}(${a.id}) ~ ${b.text}(${b.id})`);
      }
    }
  }
  log(`\n-- ${scene} (${pairs.length}) --\n${pairs.join('\n')}`);
}

fs.writeFileSync('work/char-audit/char-coverage.md', out.join('\n'), 'utf8');
process.stdout.write('ok\n');

import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('work/char-audit/rebalance-data.json', 'utf8'));
const rows = [...data.replacements, ...data.additions];
const figures = rows.map((r) => `<figure><img src="../../content/images/${r.image}"><figcaption><b>${r.text}</b> <span>${r.image}</span></figcaption></figure>`).join('\n');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>重排新增图</title>
<style>body{margin:18px;background:#eee8dc;font-family:"Microsoft YaHei",sans-serif}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}figure{margin:0;background:#fff;border-radius:12px;padding:7px}img{width:100%;display:block;border-radius:8px}figcaption{font-size:12px;margin-top:4px}figcaption span{color:#98a2ad}</style></head><body>
<h1>2026-11 重排：3 张替换 + 28 张新增</h1><div class="grid">${figures}</div></body></html>`;
fs.writeFileSync('work/char-audit/new-images.html', html);
console.log(`rows ${rows.length}`);

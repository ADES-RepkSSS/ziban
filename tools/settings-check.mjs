import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '下一步' }).click();
await page.getByRole('button', { name: '下一步' }).click();
await page.getByRole('button', { name: '开始认字' }).click();
await page.waitForTimeout(700);

await page.goto('http://127.0.0.1:4173/#/settings', { waitUntil: 'networkidle' });
await page.getByRole('switch').first().click();
await page.waitForTimeout(300);
const afterPinyin = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('ziban.progress.v1') ?? '{}').settings,
);
console.log('pinyin toggle:', afterPinyin);

await page.getByRole('radio', { name: /很慢/ }).click();
await page.waitForTimeout(300);
const afterRate = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('ziban.progress.v1') ?? '{}').settings,
);
console.log('rate:', afterRate);

await page.reload({ waitUntil: 'networkidle' });
const persisted = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('ziban.progress.v1') ?? '{}').settings,
);
console.log('after reload:', persisted);

await page.goto('http://127.0.0.1:4173/#/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
console.log('library pinyin labels:', await page.locator('.card-tile__pinyin').count());
await browser.close();

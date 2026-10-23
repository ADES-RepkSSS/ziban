/**
 * 用本机已安装的 Edge/Chrome 跑一遍关键路径，生成 screenshots/。
 * 不下载浏览器（playwright-core + 系统浏览器）。
 *
 * 用法：
 *   1. pnpm dev
 *   2. pnpm screenshot
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.ZIBAN_URL ?? 'http://127.0.0.1:4173';
const OUT = path.join(process.cwd(), 'screenshots');

const candidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) {
  console.error('没有找到 Edge/Chrome。可以设置 BROWSER_PATH 指向浏览器可执行文件。');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('response', (response) => {
  if (response.status() === 404) errors.push(`404: ${response.url()}`);
});

async function shot(name, options = {}) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...options });
  console.log(`  ✓ screenshots/${name}.png`);
}

async function goto(hash) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
}

try {
  console.log(`浏览器：${executablePath}`);
  await goto('');
  await shot('00-home');

  await goto('#/welcome');
  await shot('01-welcome');

  await page.getByRole('button', { name: '下一步' }).click();
  await page.waitForTimeout(500);
  await shot('02-welcome-cards');

  await page.getByRole('button', { name: '下一步' }).click();
  await page.waitForTimeout(500);
  await shot('03-welcome-screen');

  await page.getByRole('button', { name: '开始认字' }).click();
  await page.waitForTimeout(1200);
  await shot('04-study');

  // 点单字应能单独朗读，并且取消还在排队的整卡自动朗读。
  await page.locator('.word-char').first().click();
  await page.waitForTimeout(300);
  console.log(`  单击单字高亮：${await page.locator('.word-char.is-speaking').count()} 个`);

  for (let index = 0; index < 3; index += 1) {
    const label = index === 2 ? '认完了' : '下一个';
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(700);
  }
  await shot('05-complete');

  await page.getByRole('button', { name: '回首页' }).first().click();
  await page.waitForTimeout(450);
  await shot('06-home');

  await page.getByRole('button', { name: /看图找字/ }).click();
  await page.waitForTimeout(450);
  await shot('07-library');

  await page.getByRole('button', { name: '取钱', exact: true }).click();
  await page.waitForTimeout(250);
  console.log(`  场景筛选“取钱”卡片数：${await page.locator('.card-tile').count()}`);
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.waitForTimeout(250);

  await page.locator('.card-tile').first().click();
  await page.waitForTimeout(900);
  await shot('08-card');

  await goto('#/helper');
  await page.locator('#screen-text').fill('请点击链接核实，逾期将冻结账户。验证码不要给别人。');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await shot('09-helper');

  await page.getByRole('button', { name: '念给我听' }).click();
  await page.waitForTimeout(900);
  await shot('09b-helper-reading');

  await page.getByRole('button', { name: '讲给我听' }).click();
  await page.waitForTimeout(900);
  await shot('10-helper-explain', { fullPage: true });

  await goto('#/reader/bank-sms');
  await shot('11-reader');

  await goto('#/settings');
  await shot('12-settings', { fullPage: true });

  await page.setViewportSize({ width: 1024, height: 768 });
  await goto('#/');
  await shot('14-home-1024');
  await page.locator('.home-tool--learn').click();
  await page.waitForTimeout(1000);
  await shot('13-study-1024');

  const voices = await page.evaluate(() => {
    try {
      return window.speechSynthesis.getVoices().map((voice) => ({
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
      }));
    } catch {
      return [];
    }
  });
  console.log(`声音：${voices.length ? voices.map((voice) => `${voice.name}(${voice.lang})`).join(' · ') : '未发现'}`);
  if (errors.length > 0) {
    console.error('页面错误：');
    for (const error of errors) console.error(`  ${error}`);
    process.exitCode = 1;
  } else {
    console.log('页面无 JS 错误。');
  }
} finally {
  await browser.close();
}

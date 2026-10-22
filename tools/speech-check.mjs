import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const page = await browser.newPage({ locale: 'zh-CN' });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

const direct = await page.evaluate(
  () =>
    new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve('unsupported');
        return;
      }
      const utterance = new SpeechSynthesisUtterance('药。生病时吃的东西。');
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      let started = false;
      utterance.onstart = () => {
        started = true;
        resolve(`start speakers=${window.speechSynthesis.speaking}`);
      };
      utterance.onend = () => resolve(`end started=${started}`);
      utterance.onerror = (event) => resolve(`error ${event.error}`);
      window.speechSynthesis.speak(utterance);
      setTimeout(() => resolve(`timeout speaking=${window.speechSynthesis.speaking}`), 4000);
    }),
);
console.log('direct speech:', direct);

await page.getByRole('button', { name: '下一步' }).click();
await page.getByRole('button', { name: '下一步' }).click();
await page.getByRole('button', { name: '开始认字' }).click();
await page.waitForTimeout(1100);
const state = await page.evaluate(() => ({
  speaking: window.speechSynthesis.speaking,
  pending: window.speechSynthesis.pending,
  highlighted: document.querySelector('.word-char.is-speaking')?.textContent ?? null,
  activeBlock: document.querySelector('.speech-block.is-speaking')?.textContent ?? null,
}));
console.log('app speech state:', state);
await page.waitForTimeout(3500);
const later = await page.evaluate(() => ({
  speaking: window.speechSynthesis.speaking,
  highlighted: document.querySelector('.word-char.is-speaking')?.textContent ?? null,
  activeBlock: document.querySelector('.speech-block.is-speaking')?.textContent ?? null,
}));
console.log('app later:', later);
await browser.close();

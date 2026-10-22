import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { articles } from './articles';

describe('built-in articles', () => {
  it('has unique ids and required text', () => {
    const ids = new Set(articles.map((article) => article.id));
    expect(ids.size).toBe(articles.length);
    for (const article of articles) {
      expect(article.title.length).toBeGreaterThan(1);
      expect(article.sentences.length).toBeGreaterThan(1);
      expect(article.summary).toHaveLength(3);
      for (const sentence of article.sentences) {
        expect(sentence.text.trim().length).toBeGreaterThan(0);
        expect(sentence.plain.trim().length).toBeGreaterThan(0);
        expect(sentence.text.length).toBeLessThanOrEqual(60);
      }
    }
  });

  it('has a real illustration for every article', () => {
    for (const article of articles) {
      const file = article.image.replace('./images/', '');
      expect(fs.existsSync(path.join(process.cwd(), 'content', 'images', file))).toBe(true);
    }
  });

  it('keeps the scam example explicitly flagged', () => {
    const scam = articles.find((article) => article.id === 'bank-sms');
    expect(scam?.risk?.level).toBe('danger');
    expect(scam?.risk?.advice).toContain('不要转账');
  });

  it('does not pretend the drafts are published content', () => {
    const note = articles.find((article) => article.id === 'hospital-notice')?.note ?? '';
    expect(note).toContain('实验版');
  });
});

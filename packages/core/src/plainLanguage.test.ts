import { describe, expect, it } from 'vitest';
import {
  assessRisk,
  collectTerms,
  explainSentence,
  findTerms,
  medicalCaution,
} from './plainLanguage.js';

describe('plain-language glossary', () => {
  it('prefers the longest term', () => {
    const hits = findTerms('您的账户被冻结了，请核实。');
    expect(hits.map((hit) => hit.term.term)).toEqual(['账户', '冻结', '核实']);
  });

  it('does not explain a sentence it has no terms for', () => {
    const result = explainSentence('今天天气不错。');
    expect(result.terms).toEqual([]);
    expect(result.plain).toBeNull();
  });

  it('turns known terms into spoken-style prose', () => {
    const result = explainSentence('请把验证码告诉我。');
    expect(result.plain).toContain('验证码');
    expect(result.plain).toContain('手机上收到的一串数字');
    expect(result.plain).not.toContain('「');
  });

  it('puts the risky term first when a sentence has several terms', () => {
    const result = explainSentence('请点击链接核实，逾期将冻结账户。');
    expect(result.terms[0]?.term).toBe('冻结账户');
    expect(result.plain).toContain('你的钱暂时不能用了');
  });

  it('collects unique terms across a passage', () => {
    const terms = collectTerms('先挂号，再去诊室。挂号以后缴费。');
    expect(terms.map((term) => term.term)).toEqual(['挂号', '诊室', '缴费']);
  });
});

describe('risk notes', () => {
  it('warns strongly about link + transfer language', () => {
    const note = assessRisk('您的账户已收到转账，请点击链接核实，逾期将冻结账户。');
    expect(note?.level).toBe('danger');
    expect(note?.advice).toContain('一一零');
  });

  it('gives a lighter warning for money words alone', () => {
    const note = assessRisk('请在这里输入密码。');
    expect(note?.level).toBe('caution');
  });

  it('stays quiet on ordinary text', () => {
    expect(assessRisk('本周六上午九点在社区活动中心量血压。')).toBeNull();
  });

  it('flags dosage language without giving medical advice', () => {
    const note = medicalCaution('这个药一次吃三片，一天吃两次。');
    expect(note?.title).toBe('吃药要问医生');
    expect(note?.advice).toContain('听医生的');
  });
});

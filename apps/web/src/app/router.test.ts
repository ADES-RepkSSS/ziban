import { describe, expect, it } from 'vitest';
import { parseRoute, routePath } from './router';

describe('hash router', () => {
  it('parses the main routes', () => {
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/welcome')).toEqual({ name: 'welcome' });
    expect(parseRoute('#/learn')).toEqual({ name: 'learn' });
    expect(parseRoute('#/library')).toEqual({ name: 'library' });
    expect(parseRoute('#/helper')).toEqual({ name: 'helper' });
    expect(parseRoute('#/lookup')).toEqual({ name: 'lookup' });
    expect(routePath({ name: 'lookup' })).toBe('#/lookup');
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  });

  it('parses and encodes card and reader ids', () => {
    expect(parseRoute('#/card/c_yao')).toEqual({ name: 'card', id: 'c_yao' });
    expect(parseRoute('#/reader/bank-sms')).toEqual({ name: 'reader', id: 'bank-sms' });
    expect(routePath({ name: 'card', id: 'c_yao' })).toBe('#/card/c_yao');
    expect(routePath({ name: 'reader', id: 'bank-sms' })).toBe('#/reader/bank-sms');
  });

  it('falls back safely', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseRoute('#/card/')).toEqual({ name: 'library' });
  });
});

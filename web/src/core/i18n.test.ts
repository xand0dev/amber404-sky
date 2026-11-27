// Issue #44: словник uk/en, однаковий набір ключів, вибір мови за замовчуванням.
import { describe, expect, it } from 'vitest';
import { DICT, detectLang, parseLang, t, type Key } from './i18n';

describe('Словник i18n', () => {
  it('в uk і en однаковий набір ключів', () => {
    expect(Object.keys(DICT.en).sort()).toEqual(Object.keys(DICT.uk).sort());
  });
  it('жоден рядок не порожній, а параметри {x} збігаються в обох мовах', () => {
    const ps = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(DICT.uk) as Key[]) {
      expect(DICT.uk[k].length, k).toBeGreaterThan(0);
      expect(DICT.en[k].length, k).toBeGreaterThan(0);
      expect(ps(DICT.en[k]), k).toEqual(ps(DICT.uk[k]));
    }
  });
  it('t підставляє параметри', () => {
    expect(t('r.wind', 'en', { v: '12.0', lim: '10.0' })).toBe('Wind 12.0 m/s > limit 10.0 m/s');
    expect(t('r.wind', 'uk', { v: '12.0', lim: '10.0' })).toBe('Вітер 12.0 м/с > ліміт 10.0 м/с');
    expect(t('go', 'en')).toBe('Within profile limits');
  });
});

describe('Мова за замовчуванням: мова браузера (uk → UK, інакше EN); збережений вибір важливіший', () => {
  it.each([['uk', 'uk'], ['uk-UA', 'uk'], ['en-US', 'en'], ['ru-RU', 'en'], ['de', 'en'], ['', 'en']] as const)(
    '%s → %s', (nav, want) => expect(detectLang(nav)).toBe(want));
  it('parseLang: лише uk/en, інакше null', () => {
    expect(parseLang('en')).toBe('en');
    expect(parseLang('uk')).toBe('uk');
    expect(parseLang('fr')).toBeNull();
    expect(parseLang(null)).toBeNull();
  });
});

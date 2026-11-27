// F0-AC3 / F0-AC4: таблиця прикладів §7.4 (на межі й за межею) і вікно §7.5.
import { describe, expect, it } from 'vitest';
import type { DroneProfile } from '../contracts';
import { evaluate, nextWindow, GO_TEXT, type Verdict } from './verdict';
import type { Weather } from './weather';

const P: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22,
  windMs: 10, gustMs: 13, tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
const calm: Weather = { ws: 3, dir: 270, g: 4, t: 12, td: 0, cb: 1500, p: 0, rh: 50, vis: 20000, kp: 2, galVisible: 9, galPdop: 1.8 };
const wx = (o: Partial<Weather>): Weather => ({ ...calm, ...o });
const lvl = (o: Partial<Weather>, alt = 50) => evaluate(wx(o), P, alt).level;

const cases: [string, Partial<Weather>, number, string][] = [
  ['wind at limit → CAUTION', { ws: 10 }, 50, 'CAUTION'],
  ['wind over limit → NO-GO', { ws: 10.1 }, 50, 'NO-GO'],
  ['wind at 80% → GO', { ws: 8 }, 50, 'GO'],
  ['wind over 80% → CAUTION', { ws: 8.1 }, 50, 'CAUTION'],
  ['alt = cb → NO-GO', { cb: 50 }, 50, 'NO-GO'],
  ['alt = cb − 60 → CAUTION', { cb: 110 }, 50, 'CAUTION'],
  ['alt below cb − 60 → GO', { cb: 111 }, 50, 'GO'],
  ['gust at limit → CAUTION', { g: 13 }, 50, 'CAUTION'],
  ['gust over limit → NO-GO', { g: 13.1 }, 50, 'NO-GO'],
  ['t at min → CAUTION', { t: -15, rh: 50 }, 50, 'CAUTION'],
  ['t below min → NO-GO', { t: -15.1, rh: 50 }, 50, 'NO-GO'],
  ['t = min + 5 → GO', { t: -10, rh: 50 }, 50, 'GO'],
  ['precip at limit → GO', { p: 0.5 }, 50, 'GO'],
  ['precip over limit → NO-GO', { p: 0.6 }, 50, 'NO-GO'],
  ['icing: t 2, rh 90 → NO-GO', { t: 2, rh: 90 }, 50, 'NO-GO'],
  ['no icing: t 2.1, rh 95 → GO', { t: 2.1, rh: 95 }, 50, 'GO'],
  ['icing: t −10, p 0.06 → NO-GO', { t: -10, p: 0.06, rh: 50 }, 50, 'NO-GO'],
  ['vis 999 → CAUTION', { vis: 999 }, 50, 'CAUTION'],
  ['vis 1000 → GO', { vis: 1000 }, 50, 'GO'],
  ['kp 5 → CAUTION', { kp: 5 }, 50, 'CAUTION'],
  ['kp 4.9 → GO', { kp: 4.9 }, 50, 'GO'],
  ['galileo 5 visible → CAUTION', { galVisible: 5 }, 50, 'CAUTION'],
  ['galileo pdop 4.1 → CAUTION', { galPdop: 4.1 }, 50, 'CAUTION'],
  ['galileo pdop 4 → GO', { galPdop: 4 }, 50, 'GO'],
];

describe('evaluate §7.4', () => {
  it('GO with text', () => expect(evaluate(calm, P, 50)).toEqual({ level: 'GO', reasons: [GO_TEXT] }));
  it('NO-DATA when ws = null', () => expect(lvl({ ws: null })).toBe('NO-DATA'));
  it.each(cases)('%s', (_n, o, alt, want) => expect(lvl(o, alt)).toBe(want));

  it('NO-GO reasons first, max 4, one decimal', () => {
    const v = evaluate(wx({ ws: 12, g: 20, t: -20, p: 3, vis: 500, kp: 6 }), P, 50);
    expect(v.level).toBe('NO-GO');
    expect(v.reasons).toHaveLength(4);
    expect(v.reasons[0]).toBe('Вітер 12.0 м/с > ліміт 10.0 м/с');
  });
});

describe('nextWindow §7.5', () => {
  const T = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(2026, 10, 28, 6 + i)).toISOString());
  const S = (s: string): Verdict[] => [...s].map((c) => ({ level: c === 'G' ? 'GO' : 'NO-GO', reasons: [] }));
  it('first run ≥ 2 h', () => expect(nextWindow(S('NGNGGGNN'), T, 0)).toEqual({ start: T[3], end: '2026-11-28T11:59:00.000Z', hours: 3 }));
  it('starts from current hour', () => expect(nextWindow(S('GGNNNGGN'), T, 1)?.start).toBe(T[5]));
  it('null when none', () => expect(nextWindow(S('GNGNGNGN'), T, 0)).toBeNull());
});

// Issue #44: причини вердикту англійською; та сама логіка рівнів для обох мов.
describe('evaluate §7.4 — en', () => {
  const lvlEn = (o: Partial<Weather>, alt = 50) => evaluate(wx(o), P, alt, 'en').level;
  it.each(cases)('%s (en)', (_n, o, alt, want) => expect(lvlEn(o, alt)).toBe(want));
  it('GO text in en', () => expect(evaluate(calm, P, 50, 'en')).toEqual({ level: 'GO', reasons: ['Within profile limits'] }));
  it('NO-DATA in en', () => expect(evaluate(wx({ ws: null }), P, 50, 'en').reasons).toEqual(['No wind data']));
  it('NO-GO reasons in en, max 4, one decimal', () => {
    const v = evaluate(wx({ ws: 12, g: 20, t: -20, p: 3, vis: 500, kp: 6 }), P, 50, 'en');
    expect(v.reasons).toEqual([
      'Wind 12.0 m/s > limit 10.0 m/s', 'Gusts 20.0 m/s > limit 13.0 m/s',
      'Temperature -20.0 °C < minimum -15.0 °C', 'Precipitation 3.0 mm/h > limit 0.5 mm/h',
    ]);
  });
  it('every rule has an English reason (no Cyrillic)', () => {
    const one: Partial<Weather>[] = [
      { ws: null }, {}, { ws: 11 }, { cb: 40 }, { g: 14 }, { t: -16, rh: 50 }, { p: 1 }, { t: 0, rh: 95 },
      { ws: 9 }, { cb: 100 }, { g: 12 }, { t: -12, rh: 50 }, { vis: 500 }, { kp: 6 }, { galVisible: 3 }, { galPdop: 5 },
    ];
    const all = new Set(one.flatMap((o) => evaluate(wx(o), P, 50, 'en').reasons));
    expect(all.size).toBe(16);
    for (const r of all) expect(r).not.toMatch(/[а-яіїєґ]/i);
  });
});

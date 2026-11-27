import { describe, expect, it } from 'vitest';
import { batteryCheck, routeCut, routeSummary } from './routeLogic';
import type { Wind3Fn } from '../../core';

// A → B точно на північ ≈ 11 км (0.1° широти).
const A = { lat: 50, lon: 30 }, B = { lat: 50.1, lon: 30 };
// Вітер з півдня 5 м/с: u = 0, v = +5 (дме на північ) — попутний туди.
const south5: Wind3Fn = () => [0, 5];

describe('F4-AC3: розріз попутного й зустрічного вітру', () => {
  it('40 відрізків, along > 0 туди при попутному вітрі', () => {
    const cut = routeCut(A, B, 200, south5);
    expect(cut).toHaveLength(40);
    cut.forEach((c) => { expect(c.along).toBeCloseTo(5); expect(c.cross).toBeCloseTo(0); });
    expect(cut[0].altM).toBeLessThan(200);
    expect(cut[20].altM).toBe(200);
  });
  it('бокова складова — вітер із заходу при курсі на північ', () => {
    const cut = routeCut(A, B, 100, () => [4, 0]);
    expect(cut[10].along).toBeCloseTo(0);
    expect(Math.abs(cut[10].cross as number)).toBeCloseTo(4);
  });
  it('немає даних на відрізку → null, а не попередній відрізок', () => {
    const cut = routeCut(A, B, 100, (lat) => (lat > 50.05 ? null : [0, 5]));
    expect(cut[0].along).toBeCloseTo(5);
    expect(cut[39].along).toBeNull();
  });
});

describe('F4-AC3: час, зустрічний і боковий, найкраща висота', () => {
  it('туди швидше за назад при попутному вітрі; найсильніший зустрічний — на зворотному', () => {
    const s = routeSummary(A, B, 15, 100, south5, () => false);
    expect(s.route.there.timeS as number).toBeLessThan(s.route.back.timeS as number);
    expect(s.route.there.timeS as number).toBeCloseTo(s.route.distM / 20, 0);
    expect(s.route.back.timeS as number).toBeCloseTo(s.route.distM / 10, 0);
    expect(s.maxHead).toBeCloseTo(5);
    expect(s.maxCross).toBeCloseTo(0);
  });
  it('найкраща висота — 50…500 м з найменшим часом, NO-GO висоти пропущено', () => {
    // Вітер росте з висотою — боковий, тож вище повільніше.
    const w: Wind3Fn = (_a, _b, alt) => [alt / 50, 0];
    const s = routeSummary(A, B, 15, 300, w, (alt) => alt < 150);
    expect(s.best?.altM).toBe(150);
    const none = routeSummary(A, B, 15, 300, w, () => true);
    expect(none.best).toBeNull();
  });
});

describe('F4-AC3: перевірка батареї (T×0.8)', () => {
  const leg = (t: number | null) => ({ timeS: t, maxHead: 0, maxCross: 0 });
  const r = (a: number | null, b: number | null) => ({ distM: 1, bearing: 0, there: leg(a), back: leg(b), totalS: a != null && b != null ? a + b : null });
  it('туди + назад ≤ T×0.8 → GO', () => expect(batteryCheck(r(100, 100), 480).level).toBe('GO'));
  it('туди ≤ T×0.8, туди + назад > T×0.8 → CAUTION', () => {
    const v = batteryCheck(r(300, 300), 480);
    expect(v.level).toBe('CAUTION');
    expect(v.reasons[0]).toMatch(/назад/);
  });
  it('туди > T×0.8 → NO-GO', () => expect(batteryCheck(r(500, 100), 480).level).toBe('NO-GO'));
  it('вітер ≥ швидкості дрона (час null) → NO-GO', () => expect(batteryCheck(r(null, 100), 480).level).toBe('NO-GO'));
  it('немає даних вітру → NO-DATA, не GO', () => expect(batteryCheck(r(100, 100), 480, true).level).toBe('NO-DATA'));
});

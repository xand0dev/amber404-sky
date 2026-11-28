// Issue #171 AC3: міні-графік вітру на 12 год — точки, лінія ліміту дрона, зафарбовані години за вердиктом.
import { describe, expect, it } from 'vitest';
import type { Level } from '../../core';
import { SPARK, sparkModel, sparkStart } from './spark';

const WS = Array.from({ length: 48 }, (_, h) => 2 + (h % 12));
const LV: Level[] = WS.map((w) => (w > 10 ? 'NO-GO' : w > 8 ? 'CAUTION' : 'GO'));

describe('Given 48 год прогнозу When sparkline Then', () => {
  it('12 годин від обраної; біля кінця — останні 12', () => {
    expect(sparkStart(0, 48)).toBe(0);
    expect(sparkStart(20, 48)).toBe(20);
    expect(sparkStart(45, 48)).toBe(36);
    expect(sparkStart(3, 8)).toBe(0);
  });
  it('12 точок і 12 смуг годин з рівнем вердикту', () => {
    const m = sparkModel(WS, LV, 10, 5);
    expect(m.segs.flat()).toHaveLength(12);
    expect(m.bands).toHaveLength(12);
    expect(m.bands.map((b) => b.level)).toEqual(LV.slice(5, 17));
    expect(m.bands.map((b) => b.hour)).toEqual(Array.from({ length: 12 }, (_, i) => 5 + i));
  });
  it('лінія ліміту на висоті ліміту дрона; вища точка — вищий вітер', () => {
    const m = sparkModel(WS, LV, 10, 0);
    const y = (v: number) => SPARK.top + (1 - v / m.yMax) * (SPARK.h - SPARK.top - SPARK.bottom);
    expect(m.limitY).toBeCloseTo(y(10));
    expect(m.yMax).toBeGreaterThanOrEqual(13); // максимум вітру 13 вміщується
    const pts = m.segs.flat();
    expect(pts[11][1]).toBeLessThan(pts[0][1]); // 13 м/с вище за 2 м/с (SVG: y донизу)
    expect(pts.every(([x]) => x >= 0 && x <= SPARK.w)).toBe(true);
  });
  it('ліміт вищий за весь вітер — лінія ліміту все одно в межах графіка', () => {
    const m = sparkModel(WS.map(() => 1), LV, 25, 0);
    expect(m.limitY).toBeGreaterThanOrEqual(SPARK.top);
  });
  it('година без даних — розрив лінії, не нуль', () => {
    const ws = WS.map((w, h) => (h === 4 ? null : w));
    const m = sparkModel(ws, LV, 10, 0);
    expect(m.segs).toHaveLength(2);
    expect(m.segs.flat()).toHaveLength(11);
  });
  it('менше 12 годин у прогнозі — стільки, скільки є', () => {
    const m = sparkModel(WS.slice(0, 6), LV.slice(0, 6), 10, 0);
    expect(m.bands).toHaveLength(6);
  });
});

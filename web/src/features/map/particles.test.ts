// F3-AC1 (частина): частинки вітру обраної висоти; швидкість на екрані не залежить від масштабу.
import { describe, expect, it } from 'vitest';
import { makeProjection, windAt } from '../../core';
import { K_PX_PER_MS, MAX_DT, particleCount, seed, step, windSampler, type Particle } from './particles';
import { bundle, state } from './fixture.test-util';

const one = (x: number, y: number): Particle[] => [{ x, y, age: 0, life: 100 }];
const rnd = () => 0.5;

describe('Given однорідний вітер; When минає 1 с', () => {
  it('Then 10 м/с на схід зсуває частинку на 10·K px однаково на 400×300 і 1280×800', () => {
    for (const [W, H] of [[400, 300], [1280, 800]]) {
      const ps = one(W / 2, H / 2);
      for (let i = 0; i < 10; i++) step(ps, 0.1, () => [10, 0], W, H, rnd);
      expect(ps[0].x - W / 2).toBeCloseTo(10 * K_PX_PER_MS, 6);
      expect(ps[0].y).toBeCloseTo(H / 2, 6);
    }
  });
  it('Then вітер з півдня (v > 0) несе частинку вгору екрана (y меншає)', () => {
    const ps = one(200, 150);
    step(ps, 0.1, () => [0, 5], 400, 300, rnd);
    expect(ps[0].y).toBeLessThan(150);
  });
  it('Then крок обмежено MAX_DT — після неактивної вкладки частинки не стрибають', () => {
    const ps = one(200, 150);
    step(ps, 5, () => [10, 0], 400, 300, rnd);
    expect(ps[0].x - 200).toBeCloseTo(10 * K_PX_PER_MS * MAX_DT, 6);
  });
});

describe('Given частинка, якій нема куди рухатись; Then вона перероджується всередині', () => {
  it('поза сіткою (вітру немає — не вигадуємо)', () => {
    const ps = one(10, 10);
    step(ps, 0.1, (x) => (x < 50 ? null : [1, 0]), 400, 300, () => 0.75);
    expect(ps[0].x).toBe(300); expect(ps[0].y).toBe(225); expect(ps[0].age).toBe(0);
  });
  it('за краєм екрана', () => {
    const ps = one(399.9, 150);
    step(ps, 0.1, () => [20, 0], 400, 300, () => 0.25);
    expect(ps[0].x).toBe(100);
  });
  it('відслужила свій вік', () => {
    const ps: Particle[] = [{ x: 200, y: 150, age: 99.95, life: 100 }];
    step(ps, 0.1, () => [1, 0], 400, 300, () => 0.25);
    expect(ps[0]).toMatchObject({ x: 100, y: 75, age: 0 });
  });
});

describe('Given обрана висота; When беремо вітер для частинок', () => {
  it('Then це core.windAt на s.altM і s.hour', () => {
    const data = bundle(), s = state({ altM: 70, hour: 1 }), W = 400, H = 300, { unproject } = makeProjection(W, H);
    const [lat, lon] = unproject(200, 150);
    expect(windSampler(data, s, unproject)(200, 150)).toEqual(windAt(data.meta.grid, data.profile, 70, 1, lat, lon));
    expect(windSampler(data, s, unproject)(1, 1)).toBeNull();
  });
});

describe('Given розмір карти; Then кількість частинок', () => {
  it('росте з площею, має стелю; seed кладе всі в межі', () => {
    expect(particleCount(800, 600)).toBeGreaterThan(particleCount(400, 300));
    expect(particleCount(4000, 3000)).toBeLessThanOrEqual(1500);
    const ps = seed(50, 400, 300, Math.random);
    expect(ps).toHaveLength(50);
    for (const p of ps) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThan(400); expect(p.y).toBeLessThan(300); }
  });
});

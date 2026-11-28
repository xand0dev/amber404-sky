// F3-AC1 (частина): частинки вітру обраної висоти; швидкість на екрані не залежить від масштабу.
// #168: колір за швидкістю (шкала легенди), щільність за площею й масштабом, очищення при зміні вигляду, бюджет кадру.
import { describe, expect, it } from 'vitest';
import { makeProjection, windAt } from '../../core';
import { FULL_VIEW } from '../../core';
import { SCALES, layerRGBA } from '../layers/colors';
import { K_PX_PER_MS, MAX_DT, SPEED_BUCKETS, bucketColors, drawTrails, particleCount, seed, speedBucket, step, viewChanged, windSampler, type Particle } from './particles';
import { bundle, state } from './fixture.test-util';

const one = (x: number, y: number): Particle[] => [{ x, y, age: 0, life: 100, spd: 0 }];
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
    const ps: Particle[] = [{ x: 200, y: 150, age: 99.95, life: 100, spd: 0 }];
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

const rgbOf = (c: string) => c.match(/\d+/g)!.map(Number);

describe('Given швидкість вітру частинки (#168 AC1)', () => {
  it('Then кошик росте зі швидкістю на шкалі легенди: 0 → перший, ≥ max → останній', () => {
    expect(speedBucket(0)).toBe(0);
    expect(speedBucket(-1)).toBe(0);
    expect(speedBucket(13)).toBeGreaterThan(speedBucket(5));
    expect(speedBucket(SCALES.wind.kind === 'ramp' ? SCALES.wind.max : 26)).toBe(SPEED_BUCKETS - 1);
    expect(speedBucket(60)).toBe(SPEED_BUCKETS - 1);
  });
  it('Then step запамʼятовує швидкість |(u, v)|', () => {
    const ps = one(200, 150);
    step(ps, 0.1, () => [3, 4], 400, 300, rnd);
    expect(ps[0].spd).toBeCloseTo(5, 6);
  });
  it('Then удень колір — рампа легенди: слабкий вітер зеленіший, сильний червоніший, обидва непрозорі', () => {
    const c = bucketColors(false, '#e6e2cc').map(rgbOf);
    expect(c).toHaveLength(SPEED_BUCKETS);
    const [lo, hi] = [c[0], c[SPEED_BUCKETS - 1]];
    expect(lo[1]).toBeGreaterThan(lo[0]); // зелений > червоний
    expect(hi[0]).toBeGreaterThan(hi[1]); // червоний > зелений
    // Той самий відтінок, що в легенді: сильний вітер у легенді теж червоніший за слабкий.
    const L0 = layerRGBA('wind', 0), L1 = layerRGBA('wind', 26);
    expect(Math.sign(hi[0] - lo[0])).toBe(Math.sign(L1[0] - L0[0]));
    expect(bucketColors(false, '#e6e2cc').every((x) => x.startsWith('rgb('))).toBe(true);
  });
  it('Then уночі — лише червоні відтінки (G і B ≤ R/2), сильніший вітер яскравіший', () => {
    const c = bucketColors(true, '#ff5a3c').map(rgbOf);
    for (const [r, g, b] of c) { expect(g).toBeLessThanOrEqual(r / 2); expect(b).toBeLessThanOrEqual(r / 2); }
    expect(c[SPEED_BUCKETS - 1][0]).toBeGreaterThan(c[0][0]);
  });
});

describe('Given розмір екрана й масштаб (#168 AC2)', () => {
  it('Then на телефоні частинок менше, ніж пропорційно площі десктопа', () => {
    const phone = particleCount(400, 560), desk = particleCount(1280, 800);
    expect(phone).toBeLessThan(desk * (400 * 560) / (1280 * 800));
    expect(phone).toBeGreaterThan(50);
  });
  it('Then при наближенні частинок менше, але не нуль; zoom 1 — як без масштабу', () => {
    expect(particleCount(1280, 800, 1)).toBe(particleCount(1280, 800));
    expect(particleCount(1280, 800, 4)).toBeLessThan(particleCount(1280, 800, 1));
    expect(particleCount(1280, 800, 1000)).toBeGreaterThanOrEqual(Math.round(particleCount(1280, 800) * 0.4));
  });
});

describe('Given зміна вигляду (#168 AC3)', () => {
  it('Then viewChanged — лише коли змінився центр чи масштаб', () => {
    expect(viewChanged(FULL_VIEW, { ...FULL_VIEW })).toBe(false);
    expect(viewChanged(FULL_VIEW, { ...FULL_VIEW, zoom: 2 })).toBe(true);
    expect(viewChanged(FULL_VIEW, { ...FULL_VIEW, lat: FULL_VIEW.lat + 0.01 })).toBe(true);
    expect(viewChanged(FULL_VIEW, { ...FULL_VIEW, lon: FULL_VIEW.lon - 0.01 })).toBe(true);
  });
});

/** Контекст-заглушка: рахує виклики, нічого не малює. */
function fakeCtx() {
  const calls: Record<string, number> = {};
  const styles: string[] = [];
  const hit = (k: string) => () => { calls[k] = (calls[k] ?? 0) + 1; };
  const ctx = {
    fillRect: hit('fillRect'), beginPath: hit('beginPath'), moveTo: hit('moveTo'), lineTo: hit('lineTo'), stroke: hit('stroke'),
    set strokeStyle(v: string) { styles.push(v); }, fillStyle: '', globalCompositeOperation: '', lineWidth: 0, lineCap: '',
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, styles };
}

describe('Given кадр частинок (#168 AC1, AC2)', () => {
  it('Then один stroke на кошик швидкості, колір кошика — з bucketColors, шлейф згасає (fillRect щокадру)', () => {
    const ps: Particle[] = [{ x: 10, y: 10, age: 1, life: 5, spd: 0 }, { x: 20, y: 20, age: 1, life: 5, spd: 26 }, { x: 30, y: 30, age: 1, life: 5, spd: 25.9 }];
    const colors = bucketColors(false, '#e6e2cc'), { ctx, calls, styles } = fakeCtx();
    drawTrails(ctx, ps, new Float32Array([9, 19, 29]), new Float32Array([9, 19, 29]), colors, 400, 300);
    expect(calls.fillRect).toBe(1);
    expect(calls.stroke).toBe(2);
    expect(styles).toEqual([colors[0], colors[SPEED_BUCKETS - 1]]);
    expect(calls.lineTo).toBe(3);
  });
  it('Then бюджет кадру на 1280×800 (крок + групування + малювання) ≤ 8 мс — вимір performance.now()', () => {
    const data = bundle(), s = state({ altM: 70, hour: 0 }), W = 1280, H = 800;
    const fn = windSampler(data, s, makeProjection(W, H).unproject), n = particleCount(W, H);
    const ps = seed(n, W, H, Math.random), x0 = new Float32Array(n), y0 = new Float32Array(n);
    const colors = bucketColors(false, '#e6e2cc'), { ctx } = fakeCtx();
    const frame = () => {
      for (let i = 0; i < n; i++) { x0[i] = ps[i].x; y0[i] = ps[i].y; }
      step(ps, 1 / 60, fn, W, H, Math.random);
      drawTrails(ctx, ps, x0, y0, colors, W, H);
    };
    for (let i = 0; i < 30; i++) frame(); // розігрів JIT
    const ms: number[] = [];
    for (let i = 0; i < 60; i++) { const t = performance.now(); frame(); ms.push(performance.now() - t); }
    ms.sort((a, b) => a - b);
    expect(ms[30]).toBeLessThanOrEqual(8);
  });
});

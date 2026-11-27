// F3-AC1 (плавне поле) і F3-AC2 (≤ 300 мс) для розрахунку поля шару.
import { describe, expect, it } from 'vitest';
import { fromUV, makeProjection as projection, windAt } from '../../core';
import type { LayerId } from '../../app/state';
import { fieldPixels, nodeStep, sampleLayer } from './field';
import { bundle, state } from './fixture.test-util';

const data = bundle();
const prof = data.profiles[0];

describe('Given дані; When рахуємо значення шару в точці', () => {
  it('Then вітер = швидкість з core.windAt на обраній висоті (не дублюємо розрахунок)', () => {
    const s = state({ altM: 70 });
    const uv = windAt(data.meta.grid, data.profile, 70, 0, 48.3, 31.7)!;
    expect(sampleLayer(data, s, prof, 48.3, 31.7)).toBeCloseTo(fromUV(uv[0], uv[1])[0], 6);
  });
  it('Then поза сіткою — null (не вигадуємо)', () => {
    expect(sampleLayer(data, state(), prof, 53.5, 30)).toBeNull();
  });
  it('Then шар «Можна летіти» віддає рівень вердикту', () => {
    expect(['GO', 'CAUTION', 'NO-GO', 'NO-DATA']).toContain(sampleLayer(data, state({ layer: 'go' }), prof, 49, 30));
  });
});

describe('Given поле вітру, що плавно росте на схід; When малюємо поле', () => {
  it('Then без квадратів: колір змінюється щопікселя, без довгих однакових відрізків', () => {
    const W = 400, H = 300, { unproject } = projection(W, H), px = fieldPixels(data, state(), W, H, unproject, nodeStep(unproject));
    const y = Math.floor(H / 2);
    let run = 1, maxRun = 1, maxJump = 0;
    for (let x = 1; x < W; x++) {
      const a = (y * W + x - 1) * 4, b = (y * W + x) * 4;
      if (px[a + 3] === 0 || px[b + 3] === 0) { run = 1; continue; }
      const same = px[a] === px[b] && px[a + 1] === px[b + 1] && px[a + 2] === px[b + 2];
      run = same ? run + 1 : 1; maxRun = Math.max(maxRun, run);
      maxJump = Math.max(maxJump, Math.abs(px[a] - px[b]), Math.abs(px[a + 1] - px[b + 1]), Math.abs(px[a + 2] - px[b + 2]));
    }
    expect(maxRun).toBeLessThanOrEqual(3);
    expect(maxJump).toBeLessThanOrEqual(8);
  });
  it('Then поза сіткою прозоро', () => {
    const W = 400, H = 300, { project, unproject } = projection(W, H);
    const px = fieldPixels(data, state(), W, H, unproject);
    const [x, y] = project(52.6, 21.95).map(Math.floor);
    expect(px[(Math.max(0, y) * W + Math.max(0, x)) * 4 + 3]).toBe(0);
  });
});

describe('Given вузли кожні step px; When малюємо поле', () => {
  it('Then у вузлі колір той самий, що й при розрахунку кожного пікселя', () => {
    const W = 300, H = 200, { unproject } = projection(W, H), step = nodeStep(unproject);
    expect(step).toBeGreaterThan(1);
    const full = fieldPixels(data, state(), W, H, unproject, 1), fast = fieldPixels(data, state(), W, H, unproject, step);
    let maxDiff = 0;
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      const o = (y * W + x) * 4;
      if (full[o + 3] === 0) continue;
      for (let k = 0; k < 4; k++) maxDiff = Math.max(maxDiff, Math.abs(full[o + k] - fast[o + k]));
    }
    expect(maxDiff).toBeLessThanOrEqual(1);
  });
});

describe('Given перемикання шару; When перемальовуємо поле', () => {
  const layers: LayerId[] = ['wind', 'go', 'gust', 'cloud', 'icing', 'temp', 'vis'];
  for (const layer of layers) {
    it(`Then «${layer}» рахується ≤ 300 мс (F3-AC2)`, () => {
      // 900×600 css-px карта → поле 300×200 (крок 3 px), вузли як у MapView.
      const W = 300, H = 200, { unproject } = projection(W, H), step = nodeStep(unproject);
      const t0 = performance.now();
      fieldPixels(data, state({ layer }), W, H, unproject, step);
      expect(performance.now() - t0).toBeLessThan(300);
    });
  }
});

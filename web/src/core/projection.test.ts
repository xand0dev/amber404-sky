import { describe, expect, it } from 'vitest';
import { MAP_BOX, makeProjection } from './projection';

describe('Given спільна проєкція карти (lat/lon ↔ екран, cos широти)', () => {
  const p = makeProjection(800, 400);

  it('Then lat/lon → екран → lat/lon повертає ту саму точку', () => {
    const [x, y] = p.project(50.45, 30.52);
    const [lat, lon] = p.unproject(x, y);
    expect(lat).toBeCloseTo(50.45, 9);
    expect(lon).toBeCloseTo(30.52, 9);
  });

  it('Then 1° довготи коротший за 1° широти у cos(48.5°) раз', () => {
    const [x0, y0] = p.project(48, 30), [x1] = p.project(48, 31), [, y1] = p.project(47, 30);
    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(Math.cos((48.5 * Math.PI) / 180), 9);
  });

  it('Then рамка України вписана в екран і по центру', () => {
    const [x0, y0] = p.project(MAP_BOX.lat0, MAP_BOX.lon0), [x1, y1] = p.project(MAP_BOX.lat1, MAP_BOX.lon1);
    expect(y0).toBeCloseTo(0, 9); // висота — обмежувальна сторона для 800×400
    expect(y1).toBeCloseTo(400, 9);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(x0 + x1).toBeCloseTo(800, 9);
  });

  it('Then північ угорі, схід праворуч', () => {
    const [xa, ya] = p.project(50, 30), [xb, yb] = p.project(49, 31);
    expect(yb).toBeGreaterThan(ya);
    expect(xb).toBeGreaterThan(xa);
  });

  it('Then афінна форма [a,b,c,d,e,f] збігається з project (для canvas setTransform)', () => {
    const [a, b, c, d, e, f] = p.affine; // x = a·lat + b·lon + c; y = d·lat + e·lon + f
    const [x, y] = p.project(46.5, 33.2);
    expect(a * 46.5 + b * 33.2 + c).toBeCloseTo(x, 9);
    expect(d * 46.5 + e * 33.2 + f).toBeCloseTo(y, 9);
  });
});

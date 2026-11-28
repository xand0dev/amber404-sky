import { describe, expect, it } from 'vitest';
import { FULL_VIEW, MAP_BOX, MIN_VIEW_KM, clampView, easeOut, fitView, gestureStep, lerpView, makeProjection, panBy, viewWidthKm, zoomAt } from './projection';

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

describe('Given вигляд карти (центр, масштаб) — issue #64', () => {
  const W = 400, H = 300;

  it('Then без вигляду і з FULL_VIEW — та сама «вся Україна»', () => {
    const a = makeProjection(W, H), b = makeProjection(W, H, FULL_VIEW);
    expect(b.project(50, 30)[0]).toBeCloseTo(a.project(50, 30)[0], 9);
    expect(b.project(50, 30)[1]).toBeCloseTo(a.project(50, 30)[1], 9);
  });

  it('Then центр вигляду — у центрі екрана, масштаб ×2 подвоює відстані', () => {
    const v = { lat: 50, lon: 30, zoom: 2 };
    const p = makeProjection(W, H, v), p1 = makeProjection(W, H, { ...v, zoom: 1 });
    expect(p.project(50, 30)[0]).toBeCloseTo(W / 2, 9);
    expect(p.project(50, 30)[1]).toBeCloseTo(H / 2, 9);
    const d = (q: typeof p) => q.project(50, 31)[0] - q.project(50, 30)[0];
    expect(d(p)).toBeCloseTo(2 * d(p1), 9);
    const [lat, lon] = p.unproject(...p.project(46.1, 35.2));
    expect(lat).toBeCloseTo(46.1, 9); expect(lon).toBeCloseTo(35.2, 9);
  });

  it('Then найбільший масштаб — ~5 км по ширині екрана, найменший — уся Україна', () => {
    const z = clampView({ lat: 50, lon: 30, zoom: 1e9 }, W, H);
    expect(viewWidthKm(z, W, H)).toBeCloseTo(MIN_VIEW_KM, 6);
    expect(clampView({ lat: 50, lon: 30, zoom: 0.01 }, W, H).zoom).toBe(1);
  });

  it('When колесо / pinch у точці; Then точка під пальцем лишається на місці', () => {
    const v0 = { lat: 49, lon: 31, zoom: 1.5 };
    const at = makeProjection(W, H, v0).unproject(100, 80);
    const v1 = zoomAt(v0, W, H, 2, 100, 80);
    expect(v1.zoom).toBeCloseTo(3, 9);
    const [x, y] = makeProjection(W, H, v1).project(...at);
    expect(x).toBeCloseTo(100, 6); expect(y).toBeCloseTo(80, 6);
  });

  it('When перетягування на (dx, dy); Then та сама точка зсувається на (dx, dy)', () => {
    const v0 = { lat: 49, lon: 31, zoom: 4 };
    const [x0, y0] = makeProjection(W, H, v0).project(49.1, 31.2);
    const [x1, y1] = makeProjection(W, H, panBy(v0, W, H, 30, -20)).project(49.1, 31.2);
    expect(x1 - x0).toBeCloseTo(30, 6); expect(y1 - y0).toBeCloseTo(-20, 6);
  });

  it('Then центр вигляду не виходить за рамку України', () => {
    const v = clampView({ lat: 70, lon: 0, zoom: 3 }, W, H);
    expect(v.lat).toBeLessThanOrEqual(MAP_BOX.lat0); expect(v.lon).toBeGreaterThanOrEqual(MAP_BOX.lon0);
  });

  it('When «До зони»; Then контур вміщено з полями 15% з кожного боку по обмежувальній стороні', () => {
    const pts: [number, number][] = [[50.6, 30.3], [50.3, 30.8], [50.45, 30.1]];
    const v = fitView(pts, W, H, 0.15);
    const xy = pts.map(([la, lo]) => makeProjection(W, H, v).project(la, lo));
    const xs = xy.map((q) => q[0]), ys = xy.map((q) => q[1]);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(W * 0.15 - 1e-6); expect(x).toBeLessThanOrEqual(W * 0.85 + 1e-6); }
    for (const y of ys) { expect(y).toBeGreaterThanOrEqual(H * 0.15 - 1e-6); expect(y).toBeLessThanOrEqual(H * 0.85 + 1e-6); }
    const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / (W * 0.7), (Math.max(...ys) - Math.min(...ys)) / (H * 0.7));
    expect(fill).toBeCloseTo(1, 6);
  });

  it('Given зона-точка (радіус 0); Then «До зони» — найбільший масштаб із центром у точці', () => {
    const v = fitView([[50.45, 30.52]], W, H);
    expect(viewWidthKm(v, W, H)).toBeCloseTo(MIN_VIEW_KM, 6);
    expect(v.lat).toBeCloseTo(50.45, 9); expect(v.lon).toBeCloseTo(30.52, 9);
  });
});

describe('Given жест на карті (pinch / перетягування) — issue #64', () => {
  const W = 400, H = 300, v0 = { lat: 49, lon: 31, zoom: 2 };

  it('When два пальці розходяться вдвічі; Then масштаб ×2, точка під серединою на місці', () => {
    const at = makeProjection(W, H, v0).unproject(200, 150);
    const v1 = gestureStep(v0, W, H, [[150, 150], [250, 150]], [[100, 150], [300, 150]]);
    expect(v1.zoom).toBeCloseTo(4, 9);
    const [x, y] = makeProjection(W, H, v1).project(...at);
    expect(x).toBeCloseTo(200, 6); expect(y).toBeCloseTo(150, 6);
  });

  it('When один палець; Then лише перетягування, масштаб той самий', () => {
    const v1 = gestureStep(v0, W, H, [[100, 100]], [[130, 90]]);
    expect(v1.zoom).toBe(2);
    expect(v1).toEqual(panBy(v0, W, H, 30, -10));
  });
});

// Issue #174: плавний перехід вигляду — ease-out, центр лінійно, масштаб — у log.
describe('Given перехід між двома виглядами (issue #174)', () => {
  const a = { lat: 48, lon: 30, zoom: 1 }, b = { lat: 50, lon: 34, zoom: 16 };

  it('Then ease-out: 0 → 0, 1 → 1, у середині вже далі за половину', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
  });

  it('Then на початку — вихідний вигляд, у кінці — цільовий', () => {
    expect(lerpView(a, b, 0)).toEqual(a);
    expect(lerpView(a, b, 1)).toEqual(b);
  });

  it('Then у середині центр — посередині, масштаб — геометричне середнє (log-інтерполяція)', () => {
    const m = lerpView(a, b, 0.5);
    expect(m.lat).toBeCloseTo(49, 9);
    expect(m.lon).toBeCloseTo(32, 9);
    expect(m.zoom).toBeCloseTo(4, 9);
  });
});

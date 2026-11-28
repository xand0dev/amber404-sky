// Issue #89: підписи міст не налазять один на одного (Житомир / Київ, Одеса / Миколаїв / Херсон на 400 px).
import { describe, expect, it } from 'vitest';
import cities from '../../../public/data/static/cities.json';
import { FULL_VIEW, makeProjection } from '../../core';
import { labelStyle, placeLabels, type Box, type Placed } from './labels';

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const W = 400, H = 464; // карта на телефоні 400×800 (#85)
const CHAR = 7; // ширина літери 12 px шрифту — оцінка для тесту

describe('placeLabels', () => {
  it('один підпис — праворуч угорі від точки, як раніше', () => {
    const [p] = placeLabels([{ x: 100, y: 100, w: 40, h: 14 }], W, H);
    expect(p).toMatchObject({ x: 105, y: 100 - 4 - 14 + 3 });
  });
  it('два близькі міста — обидва підписи без накладання, перший на своєму місці', () => {
    const r = placeLabels([{ x: 200, y: 200, w: 50, h: 14 }, { x: 190, y: 202, w: 60, h: 14 }], W, H);
    expect(r[0]).toMatchObject({ x: 205 });
    expect(r[1]).not.toBeNull();
    expect(overlap(r[0] as Box, r[1] as Box)).toBe(false);
  });
  it('усі 16 міст на 400 px: підписи не перетинаються між собою й з точками інших міст; приховано не більше двох', () => {
    const { project } = makeProjection(W, H, FULL_VIEW);
    const items = cities.map((c) => { const [x, y] = project(c.lat, c.lon); return { x, y, w: c.name.length * CHAR, h: 14 }; });
    const r = placeLabels(items, W, H);
    const shown = r.filter((b): b is Placed => b != null);
    expect(shown.length).toBeGreaterThanOrEqual(cities.length - 2);
    expect(r[0]).not.toBeNull(); // Київ — завжди
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(overlap(shown[i], shown[j]), `${i}/${j}`).toBe(false);
    r.forEach((b, i) => {
      if (!b) return;
      items.forEach((o, j) => { if (j !== i) expect(overlap(b, { x: o.x - 2, y: o.y - 2, w: 4, h: 4 }), `${cities[i].name} / точка ${cities[j].name}`).toBe(false); });
    });
  });
  it('маркер обраної точки — перешкода: підпис міста під ним переїжджає', () => {
    const marker: Box = { x: 100 - 18, y: 100 - 18, w: 36, h: 36 };
    const [p] = placeLabels([{ x: 100, y: 100, w: 40, h: 14 }], W, H, [marker]);
    expect(p).not.toBeNull();
    expect(overlap(p as Box, marker)).toBe(false);
  });
});

// Issue #167 AC3: обласні центри — більший шрифт, Київ — найбільший; на 400 px підписи все одно не накладаються.
describe('labelStyle', () => {
  it('Київ — найбільший шрифт, решта обласних центрів — більші за колишні 12 px', () => {
    const kyiv = labelStyle('Київ'), lviv = labelStyle('Львів');
    expect(kyiv.size).toBeGreaterThan(lviv.size);
    expect(lviv.size).toBeGreaterThan(12);
    expect(kyiv.font).toContain(`${kyiv.size}px`);
    expect(kyiv.h).toBeGreaterThan(kyiv.size);
  });
  it('усі 16 міст більшим шрифтом на 400 px: без накладань, Київ показано, приховано не більше двох', () => {
    const { project } = makeProjection(W, H, FULL_VIEW);
    const items = cities.map((c) => {
      const st = labelStyle(c.name), [x, y] = project(c.lat, c.lon);
      return { x, y, w: c.name.length * st.size * 0.6, h: st.h };
    });
    const r = placeLabels(items, W, H);
    const shown = r.filter((b): b is Placed => b != null);
    expect(r[0]).not.toBeNull();
    expect(shown.length).toBeGreaterThanOrEqual(cities.length - 2);
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(overlap(shown[i], shown[j]), `${i}/${j}`).toBe(false);
  });
});

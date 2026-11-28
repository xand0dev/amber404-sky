// Issue #100 (§7.6a): підкладки — вибір і збереження, проєкція зображення, атрибуція, ріки й озера.
import { describe, expect, it } from 'vitest';
import { applyAffine, makeProjection } from '../../core';
import { attribution, BASE_BOX, BASE_IDS, DEFAULT_PREFS, fieldAlpha, imageAffine, parsePrefs, waterLines } from './basemaps';

describe('Given меню «Підкладка» (AC1)', () => {
  it('чотири варіанти: Без / Рельєф / Супутник / Своя карта', () => {
    expect(BASE_IDS).toEqual(['none', 'relief', 'satellite', 'own']);
  });
  it('збережений вибір читається з браузера', () => {
    expect(parsePrefs(JSON.stringify({ base: 'satellite', wxTransp: 30 }))).toEqual({ base: 'satellite', wxTransp: 30 });
  });
  it('порожнє, зіпсоване чи чуже значення → типове', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{oops')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify({ base: 'osm', wxTransp: 500 }))).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.base).toBe('none');
  });
});

describe('Given підкладка під полем (AC2)', () => {
  it('кути зображення лягають на рамку 22–40.5 × 44–52.5 у спільній проєкції', () => {
    for (const view of [undefined, { lat: 49, lon: 31, zoom: 4 }]) {
      const p = makeProjection(400, 300, view), m = imageAffine(p.affine, 1480, 680);
      const near = (a: [number, number], b: [number, number]) => { expect(a[0]).toBeCloseTo(b[0], 6); expect(a[1]).toBeCloseTo(b[1], 6); };
      near(applyAffine(m, 0, 0), p.project(BASE_BOX.lat0, BASE_BOX.lon0));
      near(applyAffine(m, 1480, 680), p.project(BASE_BOX.lat1, BASE_BOX.lon1));
      near(applyAffine(m, 740, 340), p.project(48.25, 31.25));
    }
  });
  it('повзунок прозорості погоди діє лише над рельєфом і супутником', () => {
    expect(fieldAlpha({ base: 'none', wxTransp: 70 })).toBe(1);
    expect(fieldAlpha({ base: 'own', wxTransp: 70 })).toBe(1); // своя карта — свій повзунок (§7.14)
    expect(fieldAlpha({ base: 'relief', wxTransp: 40 })).toBeCloseTo(0.6);
    expect(fieldAlpha({ base: 'satellite', wxTransp: 100 })).toBe(0);
  });
});

describe('Given water.json (AC3)', () => {
  const geo = {
    type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { kind: 'river' }, geometry: { type: 'MultiLineString', coordinates: [[[30, 50], [30.5, 50.2]], [[31, 49]]] } },
      { type: 'Feature', properties: { kind: 'lake' }, geometry: { type: 'MultiPolygon', coordinates: [[[[33, 47], [33.5, 47], [33.2, 47.4], [33, 47]]]] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [30, 50] } },
    ],
  };
  it('ріки — лінії, озера — контури; точки й одиночні вершини відкидаються', () => {
    expect(waterLines(geo)).toEqual([[[30, 50], [30.5, 50.2]], [[33, 47], [33.5, 47], [33.2, 47.4], [33, 47]]]);
  });
  it('не GeoJSON → порожньо, без винятку', () => {
    expect(waterLines(null)).toEqual([]);
    expect(waterLines({ features: 'x' })).toEqual([]);
  });
});

describe('Given обрана підкладка (AC4)', () => {
  it('атрибуція за ліцензією джерела, ріки — Natural Earth', () => {
    expect(attribution('relief', 'uk')).toMatch(/Copernicus DEM GLO-90/);
    expect(attribution('relief', 'uk')).toMatch(/Natural Earth/);
    expect(attribution('satellite', 'en')).toMatch(/Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020/);
    expect(attribution('none', 'uk')).toBe('Ріки й озера: Natural Earth');
    expect(attribution('own', 'en')).not.toMatch(/[Ѐ-ӿ]/);
  });
});

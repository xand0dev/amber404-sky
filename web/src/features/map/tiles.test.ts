// Онлайн-підкладки: тайли Web Mercator у нашій проєкції; OPSEC — онлайн-вибір не переживає перезапуск.
import { describe, expect, it } from 'vitest';
import { makeProjection } from '../../core';
import { parsePrefs } from './basemaps';
import { latToY, lonToX, TILE_SOURCES, tileZoom, visibleTiles, xToLon, yToLat } from './tiles';

describe('Given тайли Web Mercator', () => {
  it('номер тайла ↔ координати — взаємно обернені (Київ)', () => {
    for (const z of [6, 12, 17]) {
      expect(xToLon(lonToX(30.52, z), z)).toBeCloseTo(30.52, 9);
      expect(yToLat(latToY(50.45, z), z)).toBeCloseTo(50.45, 9);
    }
    expect(Math.floor(lonToX(30.52, 12))).toBe(2395);
    expect(Math.floor(latToY(50.45, 12))).toBe(1381);
  });

  it('рівень — за щільністю пікселів і в межах джерела', () => {
    expect(tileZoom(256 / 360, 1, TILE_SOURCES.streets)).toBe(5); // нижче мінімуму → minZ
    expect(tileZoom((256 * 2 ** 14) / 360, 1, TILE_SOURCES.streets)).toBe(14);
    expect(tileZoom((256 * 2 ** 14) / 360, 2, TILE_SOURCES.streets)).toBe(15);
    expect(tileZoom(1e9, 1, TILE_SOURCES.satlive)).toBe(15); // EOX — не глибше 15
  });

  it('видимі тайли покривають екран і їх не більше ліміту', () => {
    const W = 800, H = 600;
    const p = makeProjection(W, H, { lat: 50.45, lon: 30.52, zoom: 60 });
    const ts = visibleTiles(p, W, H, 2, TILE_SOURCES.streets);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts.length).toBeLessThanOrEqual(80);
    const [latT, lonL] = p.unproject(0, 0), [latB, lonR] = p.unproject(W, H);
    expect(Math.min(...ts.map((t) => t.lon0))).toBeLessThanOrEqual(lonL);
    expect(Math.max(...ts.map((t) => t.lon1))).toBeGreaterThanOrEqual(lonR);
    expect(Math.max(...ts.map((t) => t.lat0))).toBeGreaterThanOrEqual(latT);
    expect(Math.min(...ts.map((t) => t.lat1))).toBeLessThanOrEqual(latB);
    expect(ts[0].url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });

  it('уся Україна на телефоні — кілька десятків тайлів, а не тисячі', () => {
    const p = makeProjection(400, 300);
    expect(visibleTiles(p, 400, 300, 3, TILE_SOURCES.satlive).length).toBeLessThanOrEqual(80);
  });
});

describe('Given OPSEC (SPEC §7.6a)', () => {
  it('онлайн-підкладка зі сховища не відновлюється — після перезапуску знову офлайн', () => {
    // Офлайн-типове — Рельєф (#167).
    expect(parsePrefs(JSON.stringify({ base: 'streets', wxTransp: 40 })).base).toBe('relief');
    expect(parsePrefs(JSON.stringify({ base: 'satlive', wxTransp: 40 })).base).toBe('relief');
    expect(parsePrefs(JSON.stringify({ base: 'satellite', wxTransp: 40 })).base).toBe('satellite');
  });
});

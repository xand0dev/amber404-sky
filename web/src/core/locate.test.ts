// Issue #161 (F3): «Де я» — чиста логіка позиції з GPS (без DOM і без мережі).
import { describe, expect, it } from 'vitest';
import { CITY_KM, GEO_OPTS, accuracyPx, cityView, fixOf, inMapArea } from './locate';
import { makeProjection, viewWidthKm } from './projection';

describe('Given позиція з GPS', () => {
  it('опції: висока точність і таймаут 10 с (AC2)', () => {
    expect(GEO_OPTS).toMatchObject({ enableHighAccuracy: true, timeout: 10_000 });
  });
  it('fixOf бере лише широту, довготу й точність', () => {
    const c = { latitude: 49.84, longitude: 24.03, accuracy: 25, altitude: 300, speed: 1 };
    expect(fixOf(c)).toEqual({ lat: 49.84, lon: 24.03, accM: 25 });
  });
  it('у межах сітки карти — так; Варшава, Москва, NaN — ні (AC5)', () => {
    expect(inMapArea(49.84, 24.03)).toBe(true);
    expect(inMapArea(52.23, 21.01)).toBe(false);
    expect(inMapArea(55.75, 37.62)).toBe(false);
    expect(inMapArea(Number.NaN, 30)).toBe(false);
  });
  it('cityView: центр на позиції, видно ~2×CITY_KM по ширині (рівень міста, AC2)', () => {
    const v = cityView(49.84, 24.03, 400, 300);
    expect(v.lat).toBeCloseTo(49.84, 5);
    expect(v.lon).toBeCloseTo(24.03, 5);
    const km = viewWidthKm(v, 400, 300);
    expect(km).toBeGreaterThan(CITY_KM);
    expect(km).toBeLessThan(CITY_KM * 4);
  });
  it('accuracyPx: коло точності в пікселях росте з accuracy і масштабом', () => {
    const v = cityView(49.84, 24.03, 400, 300), p = makeProjection(400, 300, v);
    const r100 = accuracyPx(p, 49.84, 24.03, 100), r200 = accuracyPx(p, 49.84, 24.03, 200);
    expect(r100).toBeGreaterThan(0);
    expect(r200).toBeCloseTo(r100 * 2, 5);
    // 100 м при ~20 км на 400 px ≈ 2 px.
    expect(r100).toBeGreaterThan(0.5);
    expect(r100).toBeLessThan(10);
  });
});

import { describe, expect, it } from 'vitest';
import { toMGRS, toUTM } from './mgrs';

// Еталони: пакет Python `mgrs` 1.7.1 (обгортка NGA GEOTRANS), MGRSPrecision=5,
// і pyproj 3.8.0 / PROJ 9.8.1 (EPSG:4326 → EPSG:326zz) для метрів UTM.
// Координати міст — web/public/data/static/cities.json.
const REF = [
  { name: 'Київ', lat: 50.45, lon: 30.52, mgrs: '36U UA 23940 91604', zone: 36, e: 323940.495, n: 5591604.544 },
  { name: 'Львів', lat: 49.84, lon: 24.03, mgrs: '35U KR 86459 25072', zone: 35, e: 286459.233, n: 5525072.944 },
  { name: 'Харків', lat: 49.99, lon: 36.23, mgrs: '37U CR 01454 41196', zone: 37, e: 301454.372, n: 5541196.192 },
  { name: 'Одеса', lat: 46.48, lon: 30.72, mgrs: '36T US 24989 49906', zone: 36, e: 324989.484, n: 5149906.705 },
  { name: 'Сімферополь', lat: 44.95, lon: 34.1, mgrs: '36T WQ 86772 77984', zone: 36, e: 586772.214, n: 4977984.568 },
];

describe('MGRS', () => {
  for (const c of REF) {
    it(`${c.name}: рядок як в еталоні`, () => expect(toMGRS(c.lat, c.lon)).toBe(c.mgrs));
    it(`${c.name}: UTM ≤ 1 м від PROJ`, () => {
      const u = toUTM(c.lat, c.lon);
      expect(u.zone).toBe(c.zone);
      expect(Math.hypot(u.e - c.e, u.n - c.n)).toBeLessThanOrEqual(1);
    });
  }
  it('формат: зона, смуга, квадрат, 5+5 цифр', () =>
    expect(toMGRS(50.45, 30.52)).toMatch(/^\d{1,2}[C-HJ-NP-X] [A-HJ-NP-Z]{2} \d{5} \d{5}$/));
  it('поза межами MGRS (полюси) — помилка', () => expect(() => toMGRS(85, 30)).toThrow());
});

// Issue #172 AC1, AC5: схід і захід сонця локально за формулою NOAA, без мережі.
import { describe, expect, it } from 'vitest';
import { isNightAt, sunElevation, sunTimes } from './sun';

const KYIV = { lat: 50.45, lon: 30.52 };
const MIN = 60_000;
// Таблиця timeanddate.com, Київ, 28.11.2026: схід 07:32, захід 15:59 за Києвом (UTC+2).
const RISE = Date.UTC(2026, 10, 28, 5, 32);
const SET = Date.UTC(2026, 10, 28, 13, 59);

describe('Given Київ, 28.11.2026', () => {
  const s = sunTimes(Date.UTC(2026, 10, 28, 12), KYIV.lat, KYIV.lon);
  it('Then схід — ±5 хв від таблиць', () => expect(Math.abs(s.rise! - RISE)).toBeLessThanOrEqual(5 * MIN));
  it('Then захід — ±5 хв від таблиць', () => expect(Math.abs(s.set! - SET)).toBeLessThanOrEqual(5 * MIN));
  it('Then опівдні сонце над обрієм, опівночі — під', () => {
    expect(sunElevation(Date.UTC(2026, 10, 28, 10), KYIV.lat, KYIV.lon)).toBeGreaterThan(10);
    expect(isNightAt(Date.UTC(2026, 10, 28, 10), KYIV.lat, KYIV.lon)).toBe(false);
    expect(isNightAt(Date.UTC(2026, 10, 27, 22), KYIV.lat, KYIV.lon)).toBe(true);
  });
  it('Then ніч — між заходом і сходом', () => {
    expect(isNightAt(s.rise! - 10 * MIN, KYIV.lat, KYIV.lon)).toBe(true);
    expect(isNightAt(s.rise! + 10 * MIN, KYIV.lat, KYIV.lon)).toBe(false);
    expect(isNightAt(s.set! - 10 * MIN, KYIV.lat, KYIV.lon)).toBe(false);
    expect(isNightAt(s.set! + 10 * MIN, KYIV.lat, KYIV.lon)).toBe(true);
  });
});

describe('Given полярна ніч чи день', () => {
  it('Then сходу й заходу немає (null)', () => {
    expect(sunTimes(Date.UTC(2026, 11, 21, 12), 80, 20)).toEqual({ rise: null, set: null });
    expect(sunTimes(Date.UTC(2026, 5, 21, 12), 80, 20)).toEqual({ rise: null, set: null });
  });
});

import { describe, expect, it } from 'vitest';
import { fromUV, toUV, bilinear } from './grid';
import { dewPoint, cloudBase } from './weather';
import { kCold, kPayload, effectiveEndurance, usableSeconds } from './energy';
import { groundSpeed, zoneCalc } from './zone';
import { routeCalc, arcAlt } from './route';
import { shears } from './shear';
import { windowText } from './time';

describe('wind vectors', () => {
  it('west wind blows east', () => {
    const [u, v] = toUV(10, 270);
    expect(u).toBeCloseTo(10); expect(v).toBeCloseTo(0);
  });
  it('round trip', () => {
    const [s, d] = fromUV(...toUV(7, 33));
    expect(s).toBeCloseTo(7); expect(d).toBeCloseTo(33);
  });
  it('bilinear centre', () => {
    const g = { lat0: 1, lon0: 0, step: 1, nr: 2, nc: 2 };
    expect(bilinear(g, [0, 10, 20, 30], 0.5, 0.5)).toBeCloseTo(15);
    expect(bilinear(g, [0, null, 20, 30], 0.5, 0.5)).toBeNull();
  });
});

describe('dew point and cloud base', () => {
  it('rh 100 → td = t, cb 0', () => { expect(dewPoint(10, 100)).toBeCloseTo(10, 1); expect(cloudBase(10, 10)).toBe(0); });
  it('t 20, rh 50 → td ≈ 9.3', () => expect(dewPoint(20, 50)).toBeCloseTo(9.3, 1));
  it('cb = 125 × spread', () => expect(cloudBase(10, 6)).toBe(500));
});

describe('energy §7.3a', () => {
  it('kCold', () => { expect(kCold(10)).toBe(1); expect(kCold(-20)).toBeCloseTo(0.7); expect(kCold(-5)).toBeCloseTo(0.85); });
  it('kPayload only multirotor', () => { expect(kPayload(4, 4, 'multirotor')).toBeCloseTo(0.3536, 3); expect(kPayload(4, 4, 'wing')).toBe(1); });
  it('fuel ignores cold', () => expect(effectiveEndurance({ energy: 'fuel', fuelL: 5, burnLh: 1, massKg: 20, kind: 'wing', t: -20 }).min).toBe(300));
  it('battery: 10 min at −20 → 7', () => expect(effectiveEndurance({ energy: 'battery', enduranceMin: 10, massKg: 1, kind: 'multirotor', t: -20 }).min).toBeCloseTo(7));
  it('reserve 20%', () => expect(usableSeconds(10)).toBe(480));
});

describe('zone §7.5b', () => {
  it('ground speed with tail and head wind', () => {
    expect(groundSpeed(20, 0, 5, 0)).toBeCloseTo(25); // вітер на північ, летимо на північ
    expect(groundSpeed(20, 0, 5, 180)).toBeCloseTo(15);
    expect(groundSpeed(5, 0, 6, 180)).toBeNull();
  });
  it('calm → circle radius = tas × t / 2', () => {
    const z = zoneCalc({ lat: 50, lon: 30, tasMs: 20, windLimitMs: 15, usableS: 600, mode: 'roundtrip', stepM: 100 }, () => [0, 0]);
    expect(z).toHaveLength(48);
    for (const p of z) expect(p.distM).toBe(6000);
  });
  it('wind shortens along, not across', () => {
    const z = zoneCalc({ lat: 50, lon: 30, tasMs: 20, windLimitMs: 15, usableS: 600, mode: 'roundtrip', stepM: 100 }, () => [0, 8]);
    expect(z[0].distM).toBeLessThan(z[12].distM);
  });
  it('stops on wind limit', () => {
    const z = zoneCalc({ lat: 50, lon: 30, tasMs: 20, windLimitMs: 5, usableS: 600, mode: 'roundtrip' }, () => [0, 8]);
    expect(z[0].stop).toBe('wind-limit');
  });
});

describe('route §7.5a', () => {
  it('arc altitude', () => { expect(arcAlt(0, 100)).toBe(10); expect(arcAlt(0.5, 100)).toBe(100); expect(arcAlt(1, 100)).toBe(10); });
  it('calm route: total = 2 × dist / tas', () => {
    const r = routeCalc({ lat: 50, lon: 30 }, { lat: 50.1, lon: 30 }, 20, 100, () => [0, 0]);
    expect(r.totalS).toBeCloseTo((2 * r.distM) / 20, 0);
  });
});

describe('shear', () => {
  it('45° at > 2 m/s', () => expect(shears([{ altM: 50, speed: 5, dir: 0 }, { altM: 100, speed: 5, dir: 45 }])).toEqual([{ altM: 100, deg: 45 }]));
  it('ignores light wind', () => expect(shears([{ altM: 50, speed: 1, dir: 0 }, { altM: 100, speed: 5, dir: 90 }])).toEqual([]));
});

describe('time', () => {
  it('no window text', () => expect(windowText(null, '2026-11-29T10:00:00Z')).toBe('Немає вікна ≥ 2 год до нд 12:00'));
});

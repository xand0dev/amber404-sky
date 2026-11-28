import { describe, expect, it } from 'vitest';
import type { DroneProfile, Grid, Profile } from '../../contracts';
import type { Bundle } from '../data';
import { makeProjection, windAt } from '../../core';
import { stepFor, zoneFor as panelZone } from '../../features/panel/zoneLogic';
import { clearZoneCache, ringSteps, zoneFor, zoneShapes } from './model';

const G: Grid = { lat0: 52.5, lon0: 22, step: 0.5, nr: 18, nc: 38 };
const N = G.nr * G.nc;
const LEVELS = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];
const DRONE: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
const WING: DroneProfile = { ...DRONE, id: 'wingF', energy: 'fuel', enduranceMin: 300, cruiseMs: 28, windMs: 18, kind: 'wing' };

/** Однорідний вітер spd м/с «звідки» dir° на всіх рівнях і годинах, температура tC. */
function bundle(spd: number, dir: number, tC = 15): Bundle {
  const f2 = (x: number | null) => Array.from({ length: 48 }, () => Array<number | null>(N).fill(x));
  const f3 = (x: number) => LEVELS.map(() => f2(x));
  const profile = { generatedAt: '', sources: [], levels: LEVELS, spd: f3(spd * 10), dir: f3(dir), gust: f2(0), temp: f2(tC * 10),
    precip: f2(0), rh: f2(50), vis: f2(400) } as unknown as Profile;
  const meta = { mock: true, generatedAt: '', grid: G, times: Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2026, 10, 28, h)).toISOString()), sources: [] } as unknown as Bundle['meta'];
  return { meta, profile, galileo: null, kp: null, climate: null, profiles: [DRONE, WING], cities: [], borders: { features: [] } };
}
const S = { lat: 50.45, lon: 30.52, altM: 50, hour: 3, droneId: 'fpv7' };

describe('Given обрана точка, висота, година й дрон (SPEC §7.5b)', () => {
  it('When штиль; Then коло радіусом cruise × usableS / 2, час — effectiveEndurance + usableSeconds', () => {
    clearZoneCache();
    const z = zoneFor(bundle(0.0001, 0), S)!;
    // fpv7: 10 хв × k_холод 1 (15 °C) × вантаж 1 → 480 с; 22 м/с → 5280 м в один бік.
    expect(z.enduranceMin).toBeCloseTo(10);
    expect(z.usableS).toBeCloseTo(480);
    expect(z.points).toHaveLength(48);
    for (const p of z.points) expect(Math.abs(p.distM - 5280)).toBeLessThanOrEqual(250);
    expect(z.why).toMatch(/паспорт 10 хв/);
  });

  it('When холод −20 °C; Then час польоту × 0.7 (k_холод)', () => {
    clearZoneCache();
    const z = zoneFor(bundle(0.0001, 0, -20), S)!;
    expect(z.enduranceMin).toBeCloseTo(7);
  });

  it('When вітер 6 м/с з півночі; Then зона коротша вздовж вітру, ніж поперек; стрілка вітру — на південь', () => {
    clearZoneCache();
    const z = zoneFor(bundle(6, 0), S)!;
    expect(z.points[0].distM).toBeLessThan(z.points[12].distM);
    expect(z.wind![1]).toBeLessThan(0); // v < 0: дме на південь
  });

  it('When вітер понад ліміт дрона; Then промені обірвались зі stop = wind-limit (червоні точки)', () => {
    clearZoneCache();
    const z = zoneFor(bundle(12, 90), S)!;
    expect(z.cut.length).toBe(48);
    expect(z.cut.every((p) => p.stop === 'wind-limit')).toBe(true);
  });

  it('When немає дрона з таким id; Then береться перший профіль', () => {
    clearZoneCache();
    expect(zoneFor(bundle(0.0001, 0), { ...S, droneId: 'nope' })!.prof.id).toBe('fpv7');
  });
});

describe('Given свій дрон з вантажем (issue #107, SPEC §7.3a)', () => {
  // Мультиротор 2 кг + вантаж 2 кг, паспорт 10 хв, +20 °C: множник вантажу (2 / 4)^1.5 = 0.35.
  const OWN = { ...DRONE, id: 'own', massKg: 2, payloadKg: 2, source: 'користувач (свій дрон)' };
  const withOwn = (spd: number, dir: number) => { const b = bundle(spd, dir, 20); return { ...b, profiles: [...b.profiles, OWN] }; };

  it('When шар «Зона»; Then T = 3.5 хв (вантаж враховано), у підписі множник вантажу 0.35', () => {
    clearZoneCache();
    const z = zoneFor(withOwn(0.0001, 0), { ...S, droneId: 'own' })!;
    expect(z.enduranceMin).toBeCloseTo(10 * 0.5 ** 1.5);
    expect(z.enduranceMin.toFixed(1)).toBe('3.5');
    expect(z.why).toContain('вантаж 0.35');
  });

  it('When вітер 6 м/с; Then радіус контуру на карті = радіус картки в панелі (±1 крок)', () => {
    clearZoneCache();
    const b = withOwn(6, 300), s = { ...S, droneId: 'own' };
    const z = zoneFor(b, s)!;
    const card = panelZone(OWN, s.lat, s.lon, 20, (la, lo) => windAt(b.meta.grid, b.profile, s.altM, s.hour, la, lo), 'roundtrip');
    const step = Math.max(stepFor(OWN.cruiseMs, card.usableS), 250);
    expect(z.usableS).toBeCloseTo(card.usableS);
    expect(Math.abs(z.maxDistM - card.maxM)).toBeLessThanOrEqual(step);
  });
});

describe('Розрахунок ≤ 100 мс, мемоізація за точкою/висотою/годиною/дроном', () => {
  it('найдовша зона (крило з ДВЗ, 300 хв) рахується < 100 мс; повтор — той самий об\'єкт', () => {
    clearZoneCache();
    const b = bundle(5, 270), s = { ...S, droneId: 'wingF', altM: 500 };
    const t0 = performance.now();
    const z = zoneFor(b, s);
    expect(performance.now() - t0).toBeLessThan(100);
    expect(zoneFor(b, { ...s })).toBe(z);
    expect(zoneFor(b, { ...s, hour: 4 })).not.toBe(z);
    expect(zoneFor(b, { ...s, altM: 400 })).not.toBe(z);
    expect(zoneFor(b, { ...s, droneId: 'fpv7' })).not.toBe(z);
    expect(zoneFor(b, { ...s, lat: 50 })).not.toBe(z);
  });
});

describe('ringSteps: кільця відстаней', () => {
  it('круглі кроки, не більше 4 кілець у межах зони', () => {
    expect(ringSteps(5280)).toEqual([2000, 4000]);
    expect(ringSteps(200_000)).toEqual([50_000, 100_000, 150_000, 200_000]);
    expect(ringSteps(0)).toEqual([]);
  });
});

describe('zoneShapes: геометрія шару в пікселях спільної проєкції', () => {
  it('контур із 48 точок, кільця, точки обриву, стрілка вітру від центру', () => {
    clearZoneCache();
    const z = zoneFor(bundle(12, 90), S)!;
    const proj = makeProjection(400, 300);
    const sh = zoneShapes(z, proj);
    expect(sh.contour).toHaveLength(48);
    expect(sh.dots).toHaveLength(48);
    const [cx, cy] = proj.project(S.lat, S.lon);
    expect(sh.center).toEqual([cx, cy]);
    // Вітер зі сходу (90°) → дме на захід: кінець стрілки лівіше центру.
    expect(sh.arrow![1][0]).toBeLessThan(cx);
  });
});

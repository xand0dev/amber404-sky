// Issue #171 AC2: чипи причин — значення vs ліміт, найгірша перша. Пороги — ті самі, що в core/verdict.ts (§7.4).
import { describe, expect, it } from 'vitest';
import type { DroneProfile } from '../../contracts';
import type { Weather } from '../../core';
import { chips } from './chipsData';

const PROF: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
// Усе в межах профілю: вітер 3 / 10, пориви 5 / 13, хмари далеко, тепло, сухо, Kp 2, Galileo 9 · PDOP 1.8.
const OK: Weather = { ws: 3, dir: 330, g: 5, t: 15, td: 0, cb: 1800, p: 0, rh: 50, vis: 20000, kp: 2, galVisible: 9, galPdop: 1.8 };
const kinds = (wx: Weather, alt = 50) => chips(wx, PROF, alt).map((c) => c.kind);

describe('Given погода в точці When чипи Then', () => {
  it('9 чипів: вітер, пориви, хмари, обмерзання, температура, опади, видимість, Kp, Galileo', () => {
    expect([...kinds(OK)].sort()).toEqual(['cloud', 'gal', 'gust', 'icing', 'kp', 'precip', 'temp', 'vis', 'wind']);
  });
  it('значення й ліміт: вітер 9.2 / 10 м/с — ОБЕРЕЖНО (понад 80%) і перший', () => {
    const c = chips({ ...OK, ws: 9.2 }, PROF, 50);
    expect(c[0]).toMatchObject({ kind: 'wind', sev: 'cau', v: 9.2, lim: 10 });
  });
  it('НЕ МОЖНА раніше за ОБЕРЕЖНО, навіть якщо ОБЕРЕЖНО ближче до 100%', () => {
    const c = chips({ ...OK, ws: 9.9, g: 13.5 }, PROF, 50);
    expect(c.slice(0, 2).map((x) => [x.kind, x.sev])).toEqual([['gust', 'no'], ['wind', 'cau']]);
  });
  it('серед однакових рівнів — ближчий до ліміту перший', () => {
    // вітер 7 / 10 = 70%, пориви 12 / 13 ≈ 92% (ОБЕРЕЖНО) → пориви, потім вітер (ok, 70%) раніше за пориви 5 / 13
    expect(kinds({ ...OK, ws: 7, g: 12 }).slice(0, 2)).toEqual(['gust', 'wind']);
    expect(kinds({ ...OK, ws: 7, g: 5 })[0]).toBe('wind');
  });
  it('висота в хмарі — НЕ МОЖНА; хмари ліміт — висота польоту', () => {
    const c = chips({ ...OK, cb: 40 }, PROF, 50);
    expect(c[0]).toMatchObject({ kind: 'cloud', sev: 'no', v: 40, lim: 50 });
  });
  it('обмерзання (t −10…2 °C, RH ≥ 90%) — НЕ МОЖНА; холод біля ліміту — ОБЕРЕЖНО', () => {
    expect(chips({ ...OK, t: -1, rh: 95 }, PROF, 50)[0]).toMatchObject({ kind: 'icing', sev: 'no' });
    expect(chips({ ...OK, t: -12, rh: 50 }, PROF, 50)[0]).toMatchObject({ kind: 'temp', sev: 'cau', v: -12, lim: -15 });
  });
  it('видимість < 1 км, Kp ≥ 5, Galileo < 6 супутників — ОБЕРЕЖНО', () => {
    const c = chips({ ...OK, vis: 800, kp: 5.3, galVisible: 4 }, PROF, 50);
    expect(c.slice(0, 3).map((x) => x.sev)).toEqual(['cau', 'cau', 'cau']);
    expect(c.slice(0, 3).map((x) => x.kind).sort()).toEqual(['gal', 'kp', 'vis']);
  });
  it('немає значення — «немає даних», у кінці списку, а не «в межах»', () => {
    const c = chips({ ...OK, kp: null, galVisible: null, galPdop: null }, PROF, 50);
    expect(c.slice(-2).map((x) => [x.kind, x.sev])).toEqual([['kp', 'nodata'], ['gal', 'nodata']]);
  });
  it('рівні чипів збігаються з вердиктом: усе ok → жодного cau / no', () => {
    expect(chips(OK, PROF, 50).every((x) => x.sev === 'ok')).toBe(true);
  });
});

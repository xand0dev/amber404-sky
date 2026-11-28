// Issue #140: місця без даних на карті — вузли сітки, де обраний шар не має значення (наприклад, Open-Meteo 429 на півдні).
import { describe, expect, it } from 'vitest';
import type { Bundle } from '../../app/data';
import { nodataCells } from './nodata';
import { bundle, state } from './fixture.test-util';

const G = bundle().meta.grid;
/** Південні рядки (r ≥ 12, тобто 46.5° і нижче) — null у всіх полях, як після 429 на 5-му і 6-му пакетах. */
function southless(): Bundle {
  const d = bundle();
  const cut = (row: (number | null)[]) => row.map((v, i) => (Math.floor(i / G.nc) >= 12 ? null : v));
  const p = d.profile;
  return { ...d, profile: { ...p, spd: p.spd.map((l) => l.map(cut)), dir: p.dir.map((l) => l.map(cut)),
    gust: p.gust.map(cut), temp: p.temp.map(cut), precip: p.precip.map(cut), rh: p.rh.map(cut), vis: p.vis.map(cut) } };
}

describe('nodataCells', () => {
  it('повні дані — порожньо', () => {
    expect(nodataCells(bundle(), state())).toEqual([]);
  });
  it('південь без даних — вузли південних рядків, і жодного з півночі', () => {
    const cells = nodataCells(southless(), state());
    expect(cells.length).toBeGreaterThanOrEqual(6 * G.nc);
    expect(cells.every(([lat]) => lat <= 47.01)).toBe(true);
    expect(cells.some(([lat, lon]) => Math.abs(lat - 46.5) < 1e-9 && Math.abs(lon - 30.5) < 1e-9)).toBe(true);
  });
  it('для кожного шару, зокрема «Можна летіти»', () => {
    for (const layer of ['wind', 'gust', 'temp', 'vis', 'go'] as const) expect(nodataCells(southless(), state({ layer })).length, layer).toBeGreaterThan(0);
  });
});

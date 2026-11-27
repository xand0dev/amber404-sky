import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { Grid } from '../../contracts';
import { TerrainView, resetReliefCache, useRelief } from './Terrain';
import { cellRange, isMountain, isReliefGrid, loadRelief, MOUNTAIN_RANGE_M, terrainAt, type ReliefGrid } from './relief';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetReliefCache(); });

// Сітка прогнозу як у meta.json (§6.1, §7.1).
const FG: Grid = { lat0: 52.5, lon0: 22, step: 0.5, nr: 18, nc: 38 };

/** Синтетична сітка висот 0,05° (формат #98): рядок 0 — північ. */
function relief(lat0: number, lon0: number, nr: number, nc: number, f: (lat: number, lon: number) => number | null): ReliefGrid {
  const elev: (number | null)[] = [];
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const v = f(lat0 - r * 0.05, lon0 + c * 0.05);
    elev.push(v == null ? null : Math.round(v));
  }
  return { source: 'cop-dem', lat0, lon0, step: 0.05, nr, nc, elev };
}

// Рівнина під Києвом: 150–190 м.
const PLAIN = relief(51.0, 30.0, 21, 21, (la, lo) => 150 + (51 - la) * 20 + (lo - 30) * 20);
// Карпати: конус до 2000 м навколо Говерли (48.16, 24.50) на тлі 600 м.
const CARP = relief(48.5, 24.0, 11, 21, (la, lo) => 600 + Math.max(0, 1400 - Math.hypot(la - 48.16, (lo - 24.5) * 0.67) * 7000));

describe('#101 AC1: висота місцевості в точці', () => {
  it('Given рівнина під Києвом When точка Then висота з сітки (білінійно)', () => {
    const t = terrainAt(PLAIN, 50.45, 30.52);
    expect(t.kind).toBe('land');
    if (t.kind === 'land') expect(t.elevM).toBeCloseTo(150 + 0.55 * 20 + 0.52 * 20, 0);
  });
  it('у вузлі — точне значення вузла', () => {
    const t = terrainAt(PLAIN, 50.5, 30.5);
    expect(t).toEqual({ kind: 'land', elevM: PLAIN.elev[10 * 21 + 10] });
  });
  it('Given Говерла Then понад 1800 м', () => {
    const t = terrainAt(CARP, 48.15, 24.5);
    expect(t.kind === 'land' && t.elevM > 1800).toBe(true);
  });
  it('море (null у вузлах) → «море», не 0 м', () => {
    const sea = relief(46.5, 30.5, 3, 3, () => null);
    expect(terrainAt(sea, 46.45, 30.55)).toEqual({ kind: 'sea' });
  });
  it('берег: частина вузлів море → найближчий вузол', () => {
    const coast = relief(46.5, 30.5, 2, 2, (_la, lo) => (lo > 30.52 ? null : 12));
    expect(terrainAt(coast, 46.49, 30.51)).toEqual({ kind: 'land', elevM: 12 });
    expect(terrainAt(coast, 46.46, 30.54)).toEqual({ kind: 'sea' });
  });
  it('поза сіткою або немає файлу → «немає даних»', () => {
    expect(terrainAt(PLAIN, 45, 30.5)).toEqual({ kind: 'nodata' });
    expect(terrainAt(null, 50.45, 30.52)).toEqual({ kind: 'nodata' });
  });
});

describe('#101 AC2: перепад висот у клітинці прогнозу 0,5°', () => {
  it('Given рівнина Then перепад < 500 м — без плашки', () => {
    const r = cellRange(PLAIN, FG, 50.45, 30.52); // клітинка 50.0–50.5 × 30.5–31.0
    expect(r).toBeCloseTo(20, 0);
    expect(isMountain(r)).toBe(false);
  });
  it('Given Карпати Then перепад > 500 м — плашка «гори»', () => {
    const r = cellRange(CARP, FG, 48.2, 24.4); // клітинка 48.0–48.5 × 24.0–24.5, Говерла на краю
    expect(r).toBeGreaterThan(MOUNTAIN_RANGE_M);
    expect(isMountain(r)).toBe(true);
  });
  it('межа: рівно 500 м — ще не гори, 501 — гори', () => {
    expect(isMountain(500)).toBe(false);
    expect(isMountain(501)).toBe(true);
    expect(isMountain(null)).toBe(false);
  });
  it('море не входить у перепад; немає сітки → null', () => {
    const half = relief(46.5, 30.5, 11, 11, (la) => (la > 46.25 ? 40 : null));
    expect(cellRange(half, FG, 46.3, 30.7)).toBe(0);
    expect(cellRange(null, FG, 50.45, 30.52)).toBeNull();
  });
});

describe('#101: завантаження static/relief.json', () => {
  it('валідний файл → сітка; 404, зіпсований JSON чи інша форма → null («немає даних»)', async () => {
    const ok = vi.fn(() => Promise.resolve(new Response(JSON.stringify(PLAIN))));
    expect(await loadRelief(ok as unknown as typeof fetch)).toEqual(PLAIN);
    expect(ok).toHaveBeenCalledWith('./data/static/relief.json');
    expect(await loadRelief((() => Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch)).toBeNull();
    expect(await loadRelief((() => Promise.resolve(new Response('{bad'))) as unknown as typeof fetch)).toBeNull();
    expect(await loadRelief((() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBeNull();
    expect(isReliefGrid({ ...PLAIN, elev: [1, 2] })).toBe(false);
  });
  it('useRelief вантажить файл один раз', async () => {
    const f = vi.fn(() => Promise.resolve(new Response(JSON.stringify(PLAIN))));
    vi.stubGlobal('fetch', f);
    function Probe() { const g = useRelief(); return <span data-testid="p">{g ? g.nr : 'none'}</span>; }
    render(<><Probe /><Probe /></>);
    await waitFor(() => expect(screen.getAllByTestId('p').map((x) => x.textContent)).toEqual(['21', '21']));
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('#101 AC1–AC3: на екрані', () => {
  it('рівнина: «Місцевість N м н. р. м.» і «висоти польоту — над землею», без плашки', () => {
    render(<TerrainView terrain={{ kind: 'land', elevM: 169.4 }} range={20} lang="uk" />);
    expect(screen.getByTestId('terrain').textContent).toBe('Місцевість 169 м н. р. м. · висоти польоту — над землею');
    expect(screen.queryByTestId('terrain-mtn')).toBeNull();
  });
  it('Карпати: плашка assumption «гори…» з перепадом', () => {
    render(<TerrainView terrain={{ kind: 'land', elevM: 1890 }} range={1320.6} lang="uk" />);
    expect(screen.getByTestId('terrain-mtn').textContent)
      .toBe('assumption · гори: сітка прогнозу ~50 км, локальний вітер може відрізнятися (перепад висот у клітинці прогнозу 1321 м)');
  });
  it('море і немає даних', () => {
    render(<TerrainView terrain={{ kind: 'sea' }} range={null} lang="uk" />);
    expect(screen.getByTestId('terrain-val').textContent).toBe('море');
    cleanup();
    render(<TerrainView terrain={{ kind: 'nodata' }} range={null} lang="uk" />);
    expect(screen.getByTestId('terrain-val').textContent).toBe('немає даних');
  });
  it('англійською: рівнина і гори', () => {
    render(<TerrainView terrain={{ kind: 'land', elevM: 1890 }} range={1320} lang="en" />);
    expect(screen.getByTestId('terrain').textContent).toContain('Terrain 1890 m a.s.l. · flight altitudes are above ground');
    expect(screen.getByTestId('terrain-mtn').textContent).toContain('mountains: forecast grid ~50 km, local wind may differ');
  });
});

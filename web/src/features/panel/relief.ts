// F4 #101 (SPEC §7.6a): висота місцевості в точці й перепад висот у клітинці прогнозу. Чистий TS без DOM, крім loadRelief.
import type { Grid, Relief } from '../../contracts';

/**
 * Сітка висот Copernicus DEM (`static/relief.json`, контракт `Relief`, #102 / #128).
 * Рядок 0 = lat0 — ПІВДЕНЬ (не як meta.grid): вузол (r, c) — lat0 + r·step, lon0 + c·step, індекс r·nc + c.
 */
export type ReliefGrid = Relief;

export const RELIEF_PATH = './data/static/relief.json';
/** Перепад висот у клітинці прогнозу, після якого показуємо плашку «гори» (SPEC §7.6a). */
export const MOUNTAIN_RANGE_M = 500;

export function isReliefGrid(v: unknown): v is ReliefGrid {
  const g = v as ReliefGrid;
  return !!g && typeof g === 'object' && [g.lat0, g.lon0, g.step, g.nr, g.nc].every((x) => typeof x === 'number' && Number.isFinite(x))
    && g.step > 0 && Array.isArray(g.elev) && g.elev.length === g.nr * g.nc;
}

/** Статичний файл, однаковий для всіх (OPSEC); немає файлу або він зіпсований — null («немає даних»). */
export async function loadRelief(fetchFn: typeof fetch = fetch): Promise<ReliefGrid | null> {
  try {
    const r = await fetchFn(RELIEF_PATH);
    if (!r.ok) return null;
    const v: unknown = await r.json();
    return isReliefGrid(v) ? v : null;
  } catch { return null; }
}

const at = (g: ReliefGrid, r: number, c: number) => g.elev[r * g.nc + c] ?? null;

export type Terrain =
  | { kind: 'nodata' } // немає файлу або точка поза сіткою
  | { kind: 'sea' }
  | { kind: 'land'; elevM: number };

/** Висота в точці: білінійно по 4 вузлах; якщо серед них є море — найближчий вузол. */
export function terrainAt(g: ReliefGrid | null, lat: number, lon: number): Terrain {
  if (!g) return { kind: 'nodata' };
  const fr = (lat - g.lat0) / g.step, fc = (lon - g.lon0) / g.step; // рядки — з півдня на північ
  if (fr < 0 || fc < 0 || fr > g.nr - 1 || fc > g.nc - 1) return { kind: 'nodata' };
  const r0 = Math.min(Math.floor(fr), g.nr - 2), c0 = Math.min(Math.floor(fc), g.nc - 2);
  const dr = fr - r0, dc = fc - c0;
  const a = at(g, r0, c0), b = at(g, r0, c0 + 1), c = at(g, r0 + 1, c0), d = at(g, r0 + 1, c0 + 1);
  if (a != null && b != null && c != null && d != null) {
    return { kind: 'land', elevM: a * (1 - dr) * (1 - dc) + b * (1 - dr) * dc + c * dr * (1 - dc) + d * dr * dc };
  }
  const near = at(g, Math.round(fr), Math.round(fc));
  return near == null ? { kind: 'sea' } : { kind: 'land', elevM: near };
}

/**
 * Перепад висот (max − min, лише суша) у клітинці сітки прогнозу 0,5°, що містить точку.
 * assumption: «клітинка навколо точки» = клітинка meta.grid між чотирма вузлами, з яких інтерполюється прогноз.
 */
export function cellRange(g: ReliefGrid | null, fg: Grid, lat: number, lon: number): number | null {
  if (!g) return null;
  const fr = (fg.lat0 - lat) / fg.step, fc = (lon - fg.lon0) / fg.step;
  if (fr < 0 || fc < 0 || fr > fg.nr - 1 || fc > fg.nc - 1) return null;
  const r0 = Math.min(Math.floor(fr), fg.nr - 2), c0 = Math.min(Math.floor(fc), fg.nc - 2);
  const north = fg.lat0 - r0 * fg.step, south = north - fg.step;
  const west = fg.lon0 + c0 * fg.step, east = west + fg.step;
  const eps = 1e-9;
  const rA = Math.max(0, Math.ceil((south - g.lat0) / g.step - eps)), rB = Math.min(g.nr - 1, Math.floor((north - g.lat0) / g.step + eps));
  const cA = Math.max(0, Math.ceil((west - g.lon0) / g.step - eps)), cB = Math.min(g.nc - 1, Math.floor((east - g.lon0) / g.step + eps));
  let lo = Infinity, hi = -Infinity;
  for (let r = rA; r <= rB; r++) for (let c = cA; c <= cB; c++) {
    const v = at(g, r, c);
    if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; }
  }
  return hi >= lo ? hi - lo : null;
}

export const isMountain = (range: number | null) => range != null && range > MOUNTAIN_RANGE_M;

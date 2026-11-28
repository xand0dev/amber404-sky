// Синтетичні дані для тестів панелі: сітка 3 × 3 навколо Києва, однакова погода в усіх вузлах.
import type { Meta, Profile } from '../../contracts';

export const LEVELS = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

export interface FixOpts { hours?: number; spd?: (lvl: number, h: number) => number | null; dir?: number; dirAt?: (lvl: number) => number; tempC?: number; rh?: number }

export function fixture({ hours = 48, spd = (l) => 2 + l, dir = 330, dirAt, tempC = 10, rh = 90 }: FixOpts = {}) {
  const nr = 3, nc = 3, N = nr * nc;
  const times = Array.from({ length: hours }, (_, h) => new Date(Date.UTC(2026, 10, 28, 7 + h)).toISOString().replace('.000', ''));
  const f2 = (v: number) => Array.from({ length: hours }, () => Array<number | null>(N).fill(v));
  const meta: Meta = { generatedAt: times[0], mock: true, grid: { lat0: 51, lon0: 30, step: 0.5, nr, nc }, times, sources: [] };
  const profile: Profile = {
    generatedAt: times[0], sources: ['mock'], levels: LEVELS,
    spd: LEVELS.map((_, l) => Array.from({ length: hours }, (_, h) => { const v = spd(l, h); return Array<number | null>(N).fill(v == null ? null : v * 10); })),
    dir: LEVELS.map((_, l) => Array.from({ length: hours }, () => Array<number | null>(N).fill(dirAt ? dirAt(l) : dir))),
    gust: f2(60), temp: f2(tempC * 10), precip: f2(0), rh: f2(rh), vis: f2(200),
  };
  return { meta, profile, kp: null, galileo: null };
}

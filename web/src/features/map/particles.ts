// F3: частинки вітру обраної висоти (SPEC §7.6). Чистий TS без DOM; вітер — лише з core.windAt.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import { windAt, type Projection } from '../../core';

/**
 * Екранна швидкість: px/с на 1 м/с. Стала, не множиться на масштаб карти — 10 м/с рухаються однаково
 * на 400 px і на десктопі (F3-AC1). assumption: візуальний параметр, не фізична величина.
 */
export const K_PX_PER_MS = 3;
/** Найбільший крок, с: після неактивної вкладки частинки не стрибають. */
export const MAX_DT = 0.1;
const DENSITY_PX2 = 900, MAX_PARTICLES = 1500;

export interface Particle { x: number; y: number; age: number; life: number }
export type WindFn = (x: number, y: number) => [number, number] | null;

/** Вітер [u, v] м/с у пікселі карти на обраній висоті й годині; поза сіткою — null. */
export function windSampler(data: Bundle, s: AppState, unproject: Projection['unproject']): WindFn {
  const g = data.meta.grid, P = data.profile, { altM, hour } = s;
  return (x, y) => { const [lat, lon] = unproject(x, y); return windAt(g, P, altM, hour, lat, lon); };
}

export const particleCount = (W: number, H: number) => Math.min(MAX_PARTICLES, Math.round((W * H) / DENSITY_PX2));

const respawn = (p: Particle, W: number, H: number, rnd: () => number) => {
  p.x = rnd() * W; p.y = rnd() * H; p.age = 0; p.life = 2 + rnd() * 3;
};

export function seed(n: number, W: number, H: number, rnd: () => number): Particle[] {
  return Array.from({ length: n }, () => { const p = { x: 0, y: 0, age: 0, life: 0 }; respawn(p, W, H, rnd); p.age = rnd() * p.life; return p; });
}

/** Крок dt с: зсув u·K·dt праворуч і v·K·dt угору; поза сіткою, за краєм чи старі — перероджуються. */
export function step(ps: Particle[], dt: number, wind: WindFn, W: number, H: number, rnd: () => number): void {
  const d = Math.min(dt, MAX_DT);
  for (const p of ps) {
    const w = wind(p.x, p.y);
    if (!w) { respawn(p, W, H, rnd); continue; }
    p.x += w[0] * K_PX_PER_MS * d; p.y -= w[1] * K_PX_PER_MS * d; p.age += d;
    if (p.age > p.life || p.x < 0 || p.x >= W || p.y < 0 || p.y >= H) respawn(p, W, H, rnd);
  }
}

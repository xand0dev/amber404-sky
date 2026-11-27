// Інтерполяція сітки (SPEC §7.1). Чистий TS без DOM.
import type { Grid, Profile } from '../contracts';

const RAD = Math.PI / 180;

/** Вітер «звідки дме» (метеорологічний) → компоненти u (на схід), v (на північ), м/с. */
export function toUV(speed: number, dirFrom: number): [number, number] {
  return [-speed * Math.sin(dirFrom * RAD), -speed * Math.cos(dirFrom * RAD)];
}

/** u, v → [швидкість, напрямок «звідки дме» 0…360). */
export function fromUV(u: number, v: number): [number, number] {
  const s = Math.hypot(u, v);
  if (s < 1e-9) return [0, 0];
  const d = (Math.atan2(-u, -v) / RAD + 360) % 360;
  return [s, d];
}

/** Дробові індекси (рядок, стовпець) для точки; null — поза сіткою. */
export function cellOf(g: Grid, lat: number, lon: number): { r: number; c: number } | null {
  const r = (g.lat0 - lat) / g.step;
  const c = (lon - g.lon0) / g.step;
  if (r < 0 || c < 0 || r > g.nr - 1 || c > g.nc - 1) return null;
  return { r, c };
}

/** Білінійна інтерполяція скалярного поля [точка]; null, якщо хоч один вузол без даних. */
export function bilinear(g: Grid, field: (number | null)[], lat: number, lon: number): number | null {
  const cell = cellOf(g, lat, lon);
  if (!cell) return null;
  const r0 = Math.min(Math.floor(cell.r), g.nr - 2);
  const c0 = Math.min(Math.floor(cell.c), g.nc - 2);
  const fr = cell.r - r0;
  const fc = cell.c - c0;
  const at = (r: number, c: number) => field[r * g.nc + c];
  const a = at(r0, c0), b = at(r0, c0 + 1), c = at(r0 + 1, c0), d = at(r0 + 1, c0 + 1);
  if (a == null || b == null || c == null || d == null) return null;
  return a * (1 - fr) * (1 - fc) + b * (1 - fr) * fc + c * fr * (1 - fc) + d * fr * fc;
}

/** Вітер у точці на рівні levelIdx і годині h: білінійно по u, v. Повертає [u, v] м/с. */
export function windAtLevel(g: Grid, p: Profile, levelIdx: number, h: number, lat: number, lon: number): [number, number] | null {
  const spd = p.spd[levelIdx]?.[h];
  const dir = p.dir[levelIdx]?.[h];
  if (!spd || !dir) return null;
  const cell = cellOf(g, lat, lon);
  if (!cell) return null;
  const r0 = Math.min(Math.floor(cell.r), g.nr - 2);
  const c0 = Math.min(Math.floor(cell.c), g.nc - 2);
  const fr = cell.r - r0;
  const fc = cell.c - c0;
  let u = 0, v = 0;
  const nodes: [number, number, number][] = [
    [r0, c0, (1 - fr) * (1 - fc)], [r0, c0 + 1, (1 - fr) * fc],
    [r0 + 1, c0, fr * (1 - fc)], [r0 + 1, c0 + 1, fr * fc],
  ];
  for (const [r, c, w] of nodes) {
    const i = r * g.nc + c;
    const s = spd[i], d = dir[i];
    if (s == null || d == null) return null;
    const [uu, vv] = toUV(s / 10, d);
    u += uu * w;
    v += vv * w;
  }
  return [u, v];
}

/** Вітер на довільній висоті 10…1000 м: лінійно між сусідніми рівнями (по u, v). */
export function windAt(g: Grid, p: Profile, altM: number, h: number, lat: number, lon: number): [number, number] | null {
  const L = p.levels;
  if (altM <= L[0]) return windAtLevel(g, p, 0, h, lat, lon);
  if (altM >= L[L.length - 1]) return windAtLevel(g, p, L.length - 1, h, lat, lon);
  let k = 0;
  while (L[k + 1] < altM) k++;
  const a = windAtLevel(g, p, k, h, lat, lon);
  const b = windAtLevel(g, p, k + 1, h, lat, lon);
  if (!a || !b) return null;
  const f = (altM - L[k]) / (L[k + 1] - L[k]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// Погода для вердикту в точці (SPEC §7.2).
import type { Grid, Meta, Profile, Kp, Galileo } from '../contracts';
import { bilinear, fromUV, windAt } from './grid';

export interface Weather {
  ws: number | null; // м/с на висоті
  dir: number | null; // звідки дме, °
  g: number | null; // пориви 10 м, м/с
  t: number | null; // °C, 2 м
  td: number | null; // точка роси, °C
  cb: number | null; // нижня межа хмар, м над землею (assumption)
  p: number | null; // опади, мм/год
  rh: number | null; // %
  vis: number | null; // м
  kp: number | null;
  galVisible: number | null;
  galPdop: number | null;
}

/** Точка роси за Магнусом (a = 17.62, b = 243.12 °C). */
export function dewPoint(t: number, rh: number): number {
  const a = 17.62, b = 243.12;
  const gamma = Math.log(Math.max(rh, 1) / 100) + (a * t) / (b + t);
  return (b * gamma) / (a - gamma);
}

/** Нижня межа хмар ≈ 125 × (t − td) м (assumption, емпіричне правило). */
export function cloudBase(t: number, td: number): number {
  return Math.max(0, 125 * (t - td));
}

/** Kp для 3-годинного інтервалу, у який потрапляє година. */
export function kpAt(kp: Kp | null, timeIso: string): number | null {
  if (!kp) return null;
  const t = Date.parse(timeIso);
  let best: number | null = null;
  for (const s of kp.series) {
    const s0 = Date.parse(s.t);
    if (s0 <= t && t < s0 + 3 * 3600_000) best = s.kp;
  }
  return best;
}

function nearestIdx(gal: Galileo, lat: number, lon: number): number {
  let best = 0, bd = Infinity;
  gal.points.forEach((p, i) => {
    const d = (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export interface Sources { meta: Meta; profile: Profile; kp?: Kp | null; galileo?: Galileo | null }

export function weatherAt(src: Sources, lat: number, lon: number, altM: number, h: number): Weather {
  const g: Grid = src.meta.grid;
  const P = src.profile;
  const sc = (f: (number | null)[][], k: number) => {
    const row = f[h];
    if (!row) return null;
    const x = bilinear(g, row, lat, lon);
    return x == null ? null : x / k;
  };
  const uv = windAt(g, P, altM, h, lat, lon);
  const [ws, dir] = uv ? fromUV(uv[0], uv[1]) : [null, null];
  const t = sc(P.temp, 10);
  const rh = sc(P.rh, 1);
  const td = t != null && rh != null ? dewPoint(t, rh) : null;
  const cb = t != null && td != null ? cloudBase(t, td) : null;
  const visH = sc(P.vis, 1);
  let galVisible: number | null = null, galPdop: number | null = null;
  if (src.galileo && src.galileo.points.length) {
    const i = nearestIdx(src.galileo, lat, lon);
    galVisible = src.galileo.visible[i]?.[h] ?? null;
    galPdop = src.galileo.pdop[i]?.[h] ?? null;
  }
  return {
    ws, dir, g: sc(P.gust, 10), t, td, cb, p: sc(P.precip, 10), rh,
    vis: visH == null ? null : visH * 100,
    kp: kpAt(src.kp ?? null, src.meta.times[h] ?? ''),
    galVisible, galPdop,
  };
}

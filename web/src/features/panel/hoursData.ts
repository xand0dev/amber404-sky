// F3-AC3 (у панелі F4): погода по годинах у точці — вітер 10/80/120 м, пориви, темп., опади, видимість, обмерзання, Kp, Galileo.
// Значення й правила — лише з core (weatherAt, isIcing, пороги §7.4). Чистий TS без DOM.
import { isIcing, weatherAt, type Sources } from '../../core';
import type { DroneProfile } from '../../contracts';
import { TABLE_HOURS } from './heights';

export const HOUR_ALTS = [10, 80, 120] as const;
export type Flag = 'no' | 'cau' | null; // NO-GO / CAUTION за §7.4, інакше null

export interface HourCol {
  hour: number;
  wind: { altM: number; ws: number | null; dir: number | null; flag: Flag }[];
  g: number | null; gFlag: Flag;
  t: number | null; tFlag: Flag;
  p: number | null; pFlag: Flag;
  vis: number | null; visFlag: Flag;
  icing: boolean | null;
  kp: number | null; kpFlag: Flag;
  galVisible: number | null; galPdop: number | null; galFlag: Flag;
}

/** Пороги — ті самі, що в core/verdict.ts (§7.4): NO-GO понад ліміт, CAUTION понад 80% / близько. */
export function hourCol(src: Sources, lat: number, lon: number, prof: DroneProfile, hour: number): HourCol {
  const wind = HOUR_ALTS.map((altM) => {
    const w = weatherAt(src, lat, lon, altM, hour);
    const flag: Flag = w.ws == null ? null : w.ws > prof.windMs ? 'no' : w.ws > 0.8 * prof.windMs ? 'cau' : null;
    return { altM, ws: w.ws, dir: w.dir, flag };
  });
  const x = weatherAt(src, lat, lon, 10, hour);
  const { g, t, p, rh, vis, kp, galVisible, galPdop } = x;
  return {
    hour, wind,
    g, gFlag: g == null ? null : g > prof.gustMs ? 'no' : g > 0.8 * prof.gustMs ? 'cau' : null,
    t, tFlag: t == null ? null : t < prof.tMinC ? 'no' : t < prof.tMinC + 5 ? 'cau' : null,
    p, pFlag: p == null ? null : p > Math.max(prof.precipMmH, 0.05) ? 'no' : null,
    vis, visFlag: vis != null && vis < 1000 ? 'cau' : null,
    icing: t == null ? null : isIcing(t, rh, p),
    kp, kpFlag: kp != null && kp >= 5 ? 'cau' : null,
    galVisible, galPdop,
    galFlag: (galVisible != null && galVisible < 6) || (galPdop != null && galPdop > 4) ? 'cau' : null,
  };
}

export function hoursTable(src: Sources, lat: number, lon: number, prof: DroneProfile, start: number): HourCol[] {
  const n = Math.min(TABLE_HOURS, src.meta.times.length - start);
  return Array.from({ length: Math.max(0, n) }, (_, i) => hourCol(src, lat, lon, prof, start + i));
}

// F4 T3 (SPEC §7.5a): профіль вітру в точці — сила й напрям по висотах, зсув між шарами по 50 м. Чистий TS без DOM.
import { shears, weatherAt, type Sources } from '../../core';
import type { DroneProfile } from '../../contracts';

export interface PLevel { altM: number; ws: number | null; dir: number | null }
export interface WindProfileData { levels: PLevel[]; cb: number | null; shear: { altM: number; deg: number }[]; topM: number }

/** Висоти графіка: рівні profile.json до 500 м; вище — лише якщо робоча висота дрона сягає вище (крила). */
export function profileAlts(levels: number[], prof: DroneProfile): number[] {
  const top = Math.max(500, prof.bandM[1]);
  return levels.filter((a) => a <= top);
}

/** Шари для зсуву — по 50 м (10 м пропускаємо: §7.5a порівнює сусідні шари по 50 м). */
export const SHEAR_ALTS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

export function windProfile(src: Sources, lat: number, lon: number, hour: number, prof: DroneProfile): WindProfileData {
  const alts = profileAlts(src.profile.levels, prof);
  const levels = alts.map((altM) => { const w = weatherAt(src, lat, lon, altM, hour); return { altM, ws: w.ws, dir: w.dir }; });
  const cb = weatherAt(src, lat, lon, 10, hour).cb;
  const layers = SHEAR_ALTS.map((altM) => { const w = weatherAt(src, lat, lon, altM, hour); return { altM, speed: w.ws, dir: w.dir }; });
  // Лише сусідні пари з даними в обох шарах: шар без даних не «зшиває» 50 і 150 м у хибний зсув.
  const shear = layers.slice(1).flatMap((b, i) => {
    const a = layers[i];
    if (a.speed == null || a.dir == null || b.speed == null || b.dir == null) return [];
    return shears([{ altM: a.altM, speed: a.speed, dir: a.dir }, { altM: b.altM, speed: b.speed, dir: b.dir }]);
  });
  return { levels, cb, shear, topM: alts[alts.length - 1] ?? 500 };
}

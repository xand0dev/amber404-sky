// F4-AC2: таблиця «висоти × години» — 11 висот × 24 год. Чистий TS без DOM.
import { weatherAt, type Sources } from '../../core';
import type { DroneProfile } from '../../contracts';

/** 11 висот: 10 м і кожні 50 м до 500 м. Зверху — найвища. */
export const TABLE_ALTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 50, 10];
export const TABLE_HOURS = 24;

export interface HCell { altM: number; hour: number; ws: number | null; dir: number | null; over: boolean; cloud: boolean }

/** Перша година сторінки: 0–23 або 24–47 — щоб клік по клітинці не зсував таблицю. */
export function pageStart(hour: number, total: number): number {
  const start = Math.floor(hour / TABLE_HOURS) * TABLE_HOURS;
  return Math.max(0, Math.min(start, total - TABLE_HOURS));
}

export function heightsTable(src: Sources, lat: number, lon: number, prof: DroneProfile, start: number): HCell[][] {
  const total = src.meta.times.length;
  const hours = Array.from({ length: Math.min(TABLE_HOURS, total - start) }, (_, i) => start + i);
  return TABLE_ALTS.map((altM) => hours.map((hour) => {
    const wx = weatherAt(src, lat, lon, altM, hour);
    return {
      altM, hour, ws: wx.ws, dir: wx.dir,
      over: wx.ws != null && wx.ws > prof.windMs,
      cloud: wx.cb != null && altM >= wx.cb,
    };
  }));
}

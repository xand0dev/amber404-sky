// Issue #171 AC3: модель міні-графіка вітру на 12 год (SVG sparkline). Чистий TS без DOM.
import type { Level } from '../../core';

export const SPARK_HOURS = 12;
/** Розміри viewBox і поля під підписи (px у системі координат SVG). */
export const SPARK = { w: 240, h: 64, top: 6, bottom: 4 };

export interface SparkBand { hour: number; x: number; w: number; level: Level }
export interface SparkModel { start: number; segs: [number, number][][]; bands: SparkBand[]; limitY: number; yMax: number; max: number }

/** Перша година графіка: від обраної, а біля кінця прогнозу — останні 12. */
export function sparkStart(hour: number, len: number): number {
  return Math.max(0, Math.min(hour, len - SPARK_HOURS));
}

/** ws і levels — на всі години прогнозу; limit — ліміт вітру дрона, м/с. */
export function sparkModel(ws: (number | null)[], levels: Level[], limit: number, hour: number): SparkModel {
  const start = sparkStart(hour, ws.length);
  const n = Math.min(SPARK_HOURS, ws.length - start);
  const win = ws.slice(start, start + n);
  const max = Math.max(0, ...win.map((v) => v ?? 0));
  const yMax = Math.max(limit, max) * 1.15 || 1;
  const bw = SPARK.w / Math.max(n, 1);
  const y = (v: number) => SPARK.top + (1 - v / yMax) * (SPARK.h - SPARK.top - SPARK.bottom);
  const segs: [number, number][][] = [];
  let cur: [number, number][] | null = null;
  win.forEach((v, i) => {
    if (v == null) { cur = null; return; }
    if (!cur) { cur = []; segs.push(cur); }
    cur.push([bw * (i + 0.5), y(v)]);
  });
  const bands = win.map((_, i) => ({ hour: start + i, x: bw * i, w: bw, level: levels[start + i] ?? 'NO-DATA' }));
  return { start, segs, bands, limitY: y(limit), yMax, max };
}

// Issue #140: місця без даних — вузли сітки, де обраний шар на обрану годину й висоту не має значення
// (наприклад, Open-Meteo 429 на частині пакетів, #139). Карта штрихує їх, легенда пише «немає даних» — не вигадуємо значень.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import { sampleLayer } from './field';

export type LatLon = [number, number];

/** Центри вузлів сітки без даних обраного шару. Той самий sampleLayer, що й для поля, — штрихування збігається з полем. */
export function nodataCells(data: Bundle, s: AppState): LatLon[] {
  const g = data.meta.grid;
  const prof = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];
  const out: LatLon[] = [];
  for (let r = 0; r < g.nr; r++) for (let c = 0; c < g.nc; c++) {
    const lat = g.lat0 - r * g.step, lon = g.lon0 + c * g.step;
    const v = sampleLayer(data, s, prof, lat, lon);
    if (v == null || v === 'NO-DATA') out.push([lat, lon]);
  }
  return out;
}

/** Штрихування косими лініями поверх клітинок без даних (клітинка — ±пів кроку сітки навколо вузла). */
export function drawNodata(ctx: CanvasRenderingContext2D, cells: LatLon[], step: number, project: (lat: number, lon: number) => [number, number], color: string, W: number, H: number): void {
  if (!cells.length) return;
  ctx.save();
  ctx.beginPath();
  const h = step / 2;
  for (const [lat, lon] of cells) {
    const [x0, y0] = project(lat + h, lon - h), [x1, y1] = project(lat - h, lon + h);
    ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
  ctx.clip();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let d = -H; d < W + H; d += 8) { ctx.moveTo(d, 0); ctx.lineTo(d + H, H); }
  ctx.stroke();
  ctx.restore();
}

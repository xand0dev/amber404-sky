// Issue #167 (F3): фокус на Україні — усе поза кордоном України й поза рамкою даних затемнене напівпрозорою «віньєткою»
// (маска по кордону, правило evenodd), кордон України — товстіший зі світлим ореолом. Малюється на canvas.map, тож
// потрапляє й у знімок 📷 (compose.ts). Кольори — з палітри теми: уночі лише червоні й чорний (#36, #89).
import type { Projection } from '../../core';

/** Кільце кордону: [lon, lat][] (static/borders.json, Крим — Україна). */
export type Ring = number[][];
export interface DataBox { lat0: number; lat1: number; lon0: number; lon1: number }

/** assumption: 55 % затемнення — сусіди й рельєф за кордоном читаються, але Україна помітно яскравіша. */
export const VIGNETTE_ALPHA = 0.55;

/** Кільця України з borders.json; інших країн — немає. */
export function ukraineRings(borders: { features: { iso: string; rings: Ring[] }[] }): Ring[] {
  return borders.features.filter((f) => f.iso === 'UKR').flatMap((f) => f.rings);
}

/** Рамка даних із сітки meta.grid (§6.1): верхній лівий вузол і крок. */
export function dataBox(g: { lat0: number; lon0: number; step: number; nr: number; nc: number }): DataBox {
  return { lat0: g.lat0, lat1: g.lat0 - (g.nr - 1) * g.step, lon0: g.lon0, lon1: g.lon0 + (g.nc - 1) * g.step };
}

/** Точка всередині кілець за правилом evenodd — тим самим, яким canvas заливає маску. */
export function inRings(lat: number, lon: number, rings: Ring[]): boolean {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const inBox = (lat: number, lon: number, b: DataBox) => lat <= b.lat0 && lat >= b.lat1 && lon >= b.lon0 && lon <= b.lon1;

/** Чи затемнена точка: поза Україною або поза рамкою даних. */
export function dimmed(lat: number, lon: number, rings: Ring[], box: DataBox): boolean {
  return !inBox(lat, lon, box) || !inRings(lat, lon, rings);
}

function ringsPath(ctx: CanvasRenderingContext2D, rings: Ring[], project: Projection['project']): void {
  for (const r of rings) {
    r.forEach(([lo, la], i) => { const [x, y] = project(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
  }
}

/** Затемнення поза Україною й поза рамкою даних кольором `shade` (тло теми). Без кілець — нічого не малює. */
export function drawVignette(ctx: CanvasRenderingContext2D, rings: Ring[], box: DataBox, project: Projection['project'], W: number, H: number, shade: string): void {
  if (!rings.length) return;
  const [bx0, by0] = project(box.lat0, box.lon0), [bx1, by1] = project(box.lat1, box.lon1);
  ctx.save();
  ctx.fillStyle = shade; ctx.globalAlpha = VIGNETTE_ALPHA;
  // Екран мінус Україна.
  ctx.beginPath(); ctx.rect(0, 0, W, H); ringsPath(ctx, rings, project); ctx.fill('evenodd');
  // Україна мінус рамка даних (щоб не затемнити двічі там, де вже залито).
  ctx.beginPath(); ringsPath(ctx, rings, project); ctx.clip('evenodd');
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); ctx.fill('evenodd');
  ctx.restore();
}

/** Кордон України: світлий ореол (колір тексту теми, напівпрозорий) і поверх — товстіша лінія. */
export function drawUkraineBorder(ctx: CanvasRenderingContext2D, rings: Ring[], project: Projection['project'], ink: string): void {
  if (!rings.length) return;
  ctx.save();
  ctx.strokeStyle = ink; ctx.lineJoin = 'round';
  ctx.beginPath(); ringsPath(ctx, rings, project);
  ctx.globalAlpha = 0.25; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.restore();
}

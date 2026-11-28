// F3: частинки вітру обраної висоти (SPEC §7.6). Чистий TS без DOM; вітер — лише з core.windAt.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import { windAt, type Projection, type View } from '../../core';
import { SCALES, layerRGBA, nightRamp, type RGBA } from '../layers/colors';

/**
 * Екранна швидкість: px/с на 1 м/с. Стала, не множиться на масштаб карти — 10 м/с рухаються однаково
 * на 400 px і на десктопі (F3-AC1). assumption: візуальний параметр, не фізична величина.
 */
export const K_PX_PER_MS = 3;
/** Найбільший крок, с: після неактивної вкладки частинки не стрибають. */
export const MAX_DT = 0.1;
/** Площа екрана, px², на одну частинку на всю Україну; на телефоні (вужча сторона < 600 px) — рідше. assumption. */
const DENSITY_PX2 = 900, PHONE_DENSITY_PX2 = 1400, PHONE_PX = 600, MAX_PARTICLES = 1500;
/** Найменша частка частинок при великому масштабі: сітка 0,5° на весь екран — гладке поле, густота не потрібна. */
const MIN_ZOOM_SHARE = 0.4;
/** Товщина сліду в CSS px (на retina — удвічі більше фізичних пікселів). assumption: візуальний параметр. */
export const LINE_PX = 1.75;
/** Частка старого кадру, що стирається щокадру: шлейф плавно згасає за ~1 с при 60 fps. assumption. */
export const FADE = 0.06;
/** Кольорів шлейфу: частинки малюються однією лінією на кошик швидкості — кілька stroke на кадр. */
export const SPEED_BUCKETS = 12;
/** Домішка світлого кольору (день — до --ink, ніч — до яскравішого червоного), щоб частинка не зливалась з полем тієї ж шкали. assumption. */
const LIFT = 0.3;

export interface Particle { x: number; y: number; age: number; life: number; /** швидкість на останньому кроці, м/с */ spd: number }
export type WindFn = (x: number, y: number) => [number, number] | null;

/** Вітер [u, v] м/с у пікселі карти на обраній висоті й годині; поза сіткою — null. */
export function windSampler(data: Bundle, s: AppState, unproject: Projection['unproject']): WindFn {
  const g = data.meta.grid, P = data.profile, { altM, hour } = s;
  return (x, y) => { const [lat, lon] = unproject(x, y); return windAt(g, P, altM, hour, lat, lon); };
}

/** Кількість частинок: росте з площею екрана, на телефоні рідше, при наближенні менше (не нижче MIN_ZOOM_SHARE), зі стелею. */
export function particleCount(W: number, H: number, zoom = 1): number {
  const per = Math.min(W, H) < PHONE_PX ? PHONE_DENSITY_PX2 : DENSITY_PX2;
  const share = Math.max(MIN_ZOOM_SHARE, 1 / Math.sqrt(Math.max(1, zoom)));
  return Math.min(MAX_PARTICLES, Math.round(((W * H) / per) * share));
}

/** Кошик швидкості 0…SPEED_BUCKETS−1 на шкалі вітру легенди (SCALES.wind). */
export function speedBucket(spd: number): number {
  const sc = SCALES.wind;
  if (sc.kind !== 'ramp') return 0;
  const t = Math.max(0, Math.min(1, (spd - sc.min) / (sc.max - sc.min)));
  return Math.round(t * (SPEED_BUCKETS - 1));
}

const mix = (a: RGBA, b: RGBA, k: number): RGBA => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k).concat(255) as RGBA;
const rgb = ([r, g, b]: RGBA) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
const hex = (h: string): RGBA => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };

/**
 * Колір кожного кошика — та сама рампа, що в легенді шару «Вітер» (layerRGBA), непрозорий і трохи освітлений до `ink`,
 * щоб частинка читалась поверх поля того ж кольору. Уночі — лише червоні відтінки (nightRamp).
 */
export function bucketColors(night: boolean, ink: string): string[] {
  const sc = SCALES.wind;
  if (sc.kind !== 'ramp') return [];
  const light = night ? nightRamp(1) : hex(ink);
  return Array.from({ length: SPEED_BUCKETS }, (_, i) =>
    rgb(mix(layerRGBA('wind', sc.min + ((sc.max - sc.min) * i) / (SPEED_BUCKETS - 1), night), light, LIFT)));
}

/** Вигляд чи розмір змінився — шлейф треба стерти, інакше старі сліди «розмажуться» по новій проєкції. */
export const viewChanged = (a: View, b: View) => a.lat !== b.lat || a.lon !== b.lon || a.zoom !== b.zoom;

const respawn = (p: Particle, W: number, H: number, rnd: () => number) => {
  p.x = rnd() * W; p.y = rnd() * H; p.age = 0; p.life = 2 + rnd() * 3; p.spd = 0;
};

export function seed(n: number, W: number, H: number, rnd: () => number): Particle[] {
  return Array.from({ length: n }, () => { const p = { x: 0, y: 0, age: 0, life: 0, spd: 0 }; respawn(p, W, H, rnd); p.age = rnd() * p.life; return p; });
}

/** Крок dt с: зсув u·K·dt праворуч і v·K·dt угору; поза сіткою, за краєм чи старі — перероджуються. */
export function step(ps: Particle[], dt: number, wind: WindFn, W: number, H: number, rnd: () => number): void {
  const d = Math.min(dt, MAX_DT);
  for (const p of ps) {
    const w = wind(p.x, p.y);
    if (!w) { respawn(p, W, H, rnd); continue; }
    p.x += w[0] * K_PX_PER_MS * d; p.y -= w[1] * K_PX_PER_MS * d; p.age += d; p.spd = Math.hypot(w[0], w[1]);
    if (p.age > p.life || p.x < 0 || p.x >= W || p.y < 0 || p.y >= H) respawn(p, W, H, rnd);
  }
}

/** Один кадр: стерти частку старого (згасання), потім відрізки x0→x кожного кошика швидкості однією лінією. */
export function drawTrails(ctx: CanvasRenderingContext2D, ps: Particle[], x0: Float32Array, y0: Float32Array, colors: string[], W: number, H: number): void {
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${FADE})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = LINE_PX; ctx.lineCap = 'round';
  const by: number[][] = colors.map(() => []);
  ps.forEach((p, i) => { if (p.age > 0) by[speedBucket(p.spd)].push(i); });
  by.forEach((idx, b) => {
    if (!idx.length) return;
    ctx.strokeStyle = colors[b]; ctx.beginPath();
    for (const i of idx) { ctx.moveTo(x0[i], y0[i]); ctx.lineTo(ps[i].x, ps[i].y); }
    ctx.stroke();
  });
}

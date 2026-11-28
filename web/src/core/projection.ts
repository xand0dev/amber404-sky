// Спільна проєкція карти: lat/lon ↔ екран, рівнопроміжна з масштабом довготи cos(48.5°), рамка України по центру.
// Ті самі числа, що в MapView (F3), — щоб підкладка й поле погоди збігалися піксель у піксель.
// Вигляд (центр, масштаб; issue #64): zoom = 1 — уся рамка України вписана в екран, більше — ближче.
import type { Affine } from './affine';

export const MAP_BOX = { lat0: 52.6, lat1: 43.9, lon0: 21.9, lon1: 40.6 };
export const MAP_REF_LAT = 48.5;
/** Найбільший масштаб — ~0,8 км по ширині екрана: з онлайн-підкладкою видно вулиці (було 5 км, issue #64). */
export const MIN_VIEW_KM = 0.8;
const KM_PER_DEG = 111.32;

/** Центр вигляду (lat, lon) і масштаб відносно «вся Україна». */
export interface View { lat: number; lon: number; zoom: number }
export const FULL_VIEW: View = { lat: (MAP_BOX.lat0 + MAP_BOX.lat1) / 2, lon: (MAP_BOX.lon0 + MAP_BOX.lon1) / 2, zoom: 1 };

export interface Projection {
  project(lat: number, lon: number): [number, number];
  unproject(x: number, y: number): [number, number];
  /** x = a·lat + b·lon + c; y = d·lat + e·lon + f. */
  affine: Affine;
}

const K = Math.cos((MAP_REF_LAT * Math.PI) / 180);
/** Пікселів на 1° широти за zoom = 1. */
const baseScale = (W: number, H: number) => Math.min(W / ((MAP_BOX.lon1 - MAP_BOX.lon0) * K), H / (MAP_BOX.lat0 - MAP_BOX.lat1));

export function makeProjection(W: number, H: number, view: View = FULL_VIEW): Projection {
  const sc = baseScale(W, H) * view.zoom, kx = K * sc;
  const ox = W / 2 - view.lon * kx, oy = H / 2 + view.lat * sc;
  return {
    project: (lat, lon) => [ox + lon * kx, oy - lat * sc],
    unproject: (x, y) => [(oy - y) / sc, (x - ox) / kx],
    affine: [0, kx, ox, -sc, 0, oy],
  };
}

/** Ширина екрана в км для вигляду (довгота з cos опорної широти). */
export function viewWidthKm(v: View, W: number, H: number): number {
  return (W / (baseScale(W, H) * v.zoom)) * KM_PER_DEG;
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Масштаб у межах [уся Україна, ~5 км по ширині], центр — у рамці України. */
export function clampView(v: View, W: number, H: number): View {
  const sc0 = baseScale(W, H);
  const maxZoom = sc0 > 0 ? Math.max(1, (W * KM_PER_DEG) / (MIN_VIEW_KM * sc0)) : 1;
  return {
    lat: clamp(v.lat, MAP_BOX.lat1, MAP_BOX.lat0),
    lon: clamp(v.lon, MAP_BOX.lon0, MAP_BOX.lon1),
    zoom: clamp(v.zoom, 1, maxZoom),
  };
}

/** Масштаб у factor разів навколо точки екрана (x, y): точка під пальцем / курсором лишається на місці. */
export function zoomAt(v: View, W: number, H: number, factor: number, x: number, y: number): View {
  const [lat, lon] = makeProjection(W, H, v).unproject(x, y);
  const zoom = clampView({ ...v, zoom: v.zoom * factor }, W, H).zoom;
  const sc = baseScale(W, H) * zoom;
  return clampView({ zoom, lat: lat + (y - H / 2) / sc, lon: lon - (x - W / 2) / (K * sc) }, W, H);
}

/** Перетягування карти на (dx, dy) пікселів. */
export function panBy(v: View, W: number, H: number, dx: number, dy: number): View {
  const sc = baseScale(W, H) * v.zoom;
  if (!sc) return v;
  return clampView({ ...v, lat: v.lat + dy / sc, lon: v.lon - dx / (K * sc) }, W, H);
}

/** Вигляд, що вміщує точки [lat, lon] з полями pad (частка екрана) з кожного боку. */
export function fitView(pts: [number, number][], W: number, H: number, pad = 0.15): View {
  if (!pts.length) return FULL_VIEW;
  const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
  const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons);
  const sc0 = baseScale(W, H), dx = (lo1 - lo0) * K * sc0, dy = (la1 - la0) * sc0, f = 1 - 2 * pad;
  const zoom = Math.min(dx > 0 ? (W * f) / dx : Infinity, dy > 0 ? (H * f) / dy : Infinity);
  return clampView({ lat: (la0 + la1) / 2, lon: (lo0 + lo1) / 2, zoom }, W, H);
}

type XY = [number, number];
const mid = (p: XY[]): XY => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const spread = (p: XY[]) => (p.length > 1 ? Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) : 0);

/** Крок жесту: пальці з prev у next (1 — перетягування, 2 — pinch навколо середини + перетягування). */
export function gestureStep(v: View, W: number, H: number, prev: XY[], next: XY[]): View {
  if (!prev.length || prev.length !== next.length) return v;
  const [mx0, my0] = mid(prev), [mx1, my1] = mid(next), d0 = spread(prev), d1 = spread(next);
  const z = d0 > 0 && d1 > 0 ? zoomAt(v, W, H, d1 / d0, mx0, my0) : v;
  return panBy(z, W, H, mx1 - mx0, my1 - my0);
}

// Issue #100 (SPEC §7.6a): підкладки під погодним полем — вибір, проєкція статичного зображення, атрибуція, ріки й озера.
// Лише статичні файли з web/public/data/static/, однакові для всіх: жодних тайлів і запитів з координатами (OPSEC, §7.11).
import type { Affine, Lang, Projection } from '../../core';
import { composeAffine } from '../../core';

export type BaseId = 'none' | 'relief' | 'satellite' | 'satlive' | 'streets' | 'own';
export const BASE_IDS: BaseId[] = ['none', 'relief', 'satellite', 'own', 'satlive', 'streets'];
/** Онлайн-підкладки (тайли): показують серверу карти район перегляду — лише за явним вибором, без збереження. */
export const ONLINE: ReadonlySet<BaseId> = new Set<BaseId>(['satlive', 'streets']);
/** Підкладки-зображення під напівпрозорим полем погоди. */
export const IMAGE_BASES: ReadonlySet<BaseId> = new Set<BaseId>(['relief', 'satellite', 'satlive', 'streets']);

/** Рамка relief.png і satellite.jpg (pipeline/sky/basemap, sky/relief: EPSG:4326, bbox 22,44,40.5,52.5). */
export const BASE_BOX = { lat0: 52.5, lat1: 44, lon0: 22, lon1: 40.5 };
export const BASE_FILE: Partial<Record<BaseId, string>> = { relief: './data/static/relief.png', satellite: './data/static/satellite.jpg' };
export const WATER_FILE = './data/static/water.json';

/** Різкий супутник (#162): 2×2 шматки ~290 м/піксель (pipeline/sky/basemap HI_GRID) — вантажаться лише для «Супутника». */
export const HI_GRID = 2;
export const HI_TILES = Array.from({ length: HI_GRID * HI_GRID }, (_, i) => {
  const r = Math.floor(i / HI_GRID), c = i % HI_GRID, b = BASE_BOX;
  const dl = (b.lon1 - b.lon0) / HI_GRID, dt = (b.lat0 - b.lat1) / HI_GRID;
  return { url: `./data/static/satellite-hi-${r}${c}.jpg`, lat0: b.lat0 - r * dt, lat1: b.lat0 - (r + 1) * dt, lon0: b.lon0 + c * dl, lon1: b.lon0 + (c + 1) * dl };
});

/** Вибір у браузері: підкладка й прозорість погоди над нею, %. */
export interface BasePrefs { base: BaseId; wxTransp: number }
export const BASE_KEY = 'amber-basemap';
/** assumption: 40 % прозорості — рельєф і супутник видно, а поле читається.
 *  Issue #167: за замовчуванням — Рельєф (статичний файл, офлайн), щоб карта з першого екрана мала форму місцевості. */
export const DEFAULT_PREFS: BasePrefs = { base: 'relief', wxTransp: 40 };

export function parsePrefs(raw: string | null): BasePrefs {
  try {
    const v = JSON.parse(raw ?? '') as Partial<BasePrefs>;
    // Онлайн-підкладку не відновлюємо після перезапуску: кожен вихід у мережу — свідомий вибір (OPSEC).
    const ok = BASE_IDS.includes(v.base as BaseId) && !ONLINE.has(v.base as BaseId) && typeof v.wxTransp === 'number' && v.wxTransp >= 0 && v.wxTransp <= 100;
    return ok ? { base: v.base as BaseId, wxTransp: v.wxTransp as number } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

/** Непрозорість поля погоди. Своя карта (§7.14) має власний повзунок у своїй панелі, тож тут поле не чіпаємо. */
export function fieldAlpha(p: BasePrefs): number {
  return IMAGE_BASES.has(p.base) ? 1 - p.wxTransp / 100 : 1;
}

/** Піксель зображення w×h на рамці BASE_BOX → екран у спільній проєкції карти (той самий масштаб і зсув, #64). */
export function imageAffine(proj: Projection['affine'], w: number, h: number): Affine {
  const b = BASE_BOX;
  const toLatLon: Affine = [0, (b.lat1 - b.lat0) / h, b.lat0, (b.lon1 - b.lon0) / w, 0, b.lon0];
  return composeAffine(proj, toLatLon);
}

export const BASE_NAME: Record<Lang, Record<BaseId, string>> = {
  uk: { none: 'Без', relief: 'Рельєф', satellite: 'Супутник', own: 'Своя карта', satlive: 'Супутник 10 м', streets: 'Вулиці' },
  en: { none: 'None', relief: 'Relief', satellite: 'Satellite', own: 'Own map', satlive: 'Satellite 10 m', streets: 'Streets' },
};

// Тексти атрибуції — з ліцензій у docs/SOURCES.md (F2: cop-dem, s2cloudless, ne-water).
const ATTR: Record<Lang, Record<BaseId, string> & { water: string }> = {
  uk: {
    none: '', own: 'Своя карта: лише у вашому браузері',
    relief: 'Рельєф: Copernicus DEM GLO-90 © DLR e.V., © Airbus DS, програма Copernicus ЄС; Open-Meteo',
    satellite: 'Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020',
    satlive: 'Sentinel-2 cloudless 2020 by EOX — Copernicus Sentinel data 2020 · онлайн',
    streets: '© учасники OpenStreetMap · онлайн',
    water: 'Ріки й озера: Natural Earth',
  },
  en: {
    none: '', own: 'Own map: only in your browser',
    relief: 'Relief: Copernicus DEM GLO-90 © DLR e.V., © Airbus DS, EU Copernicus programme; Open-Meteo',
    satellite: 'Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020',
    satlive: 'Sentinel-2 cloudless 2020 by EOX — Copernicus Sentinel data 2020 · online',
    streets: '© OpenStreetMap contributors · online',
    water: 'Rivers and lakes: Natural Earth',
  },
};

/** Атрибуція обраної підкладки + рік і озер (вони на будь-якій підкладці). */
export function attribution(base: BaseId, lang: Lang): string {
  const a = ATTR[lang];
  return [a[base], a.water].filter(Boolean).join(' · ');
}

/** Лінія [lon, lat][]. */
export type WaterLine = [number, number][];

const isLine = (l: unknown): l is WaterLine =>
  Array.isArray(l) && l.length > 1 && l.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));

/** water.json → лінії рік і контури озер; решта геометрій відкидається. */
export function waterLines(geo: unknown): WaterLine[] {
  const fs = (geo as { features?: unknown } | null)?.features;
  if (!Array.isArray(fs)) return [];
  const out: WaterLine[] = [];
  for (const f of fs) {
    const g = (f as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
    const c = g?.coordinates as unknown[] | undefined;
    if (!g || !Array.isArray(c)) continue;
    const lines = g.type === 'LineString' ? [c] : g.type === 'MultiLineString' || g.type === 'Polygon' ? c
      : g.type === 'MultiPolygon' ? c.flat() : [];
    for (const l of lines) if (isLine(l)) out.push(l.map((p) => [p[0], p[1]]));
  }
  return out;
}

/** Ріки й озера тонкою лінією (поверх підкладки й поля, під частинками вітру). Уночі — колір теми (#89). */
export function drawWater(ctx: CanvasRenderingContext2D, lines: WaterLine[], project: Projection['project'], color = 'rgba(120,190,235,.85)'): void {
  if (!lines.length) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const l of lines) l.forEach(([lo, la], i) => { const [x, y] = project(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.restore();
}

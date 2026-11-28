// Issue #169: «▶ Демо» — автоматичний тур на 30 с за SPEC §3 (чиста логіка без DOM; компонент — features/tour).
// Кроки лише змінюють стан екрана (шар, висота, дрон, точка, година, вигляд); значення в підписах — з даних, не вигадані.
import { t, type Key, type Lang } from './i18n';
import { FULL_VIEW, type View } from './projection';
import type { Level } from './verdict';

export type DemoStepId = 'wind' | 'go' | 'point' | 'play' | 'space';
/** SPEC §3: 1 вітер 120 м → 2 FPV 7″, 50 м, «Можна летіти» → 3 точка під Полтавою → 4 ▶ 48 год → 5 Galileo й ERA5. */
export const DEMO_STEPS: readonly { id: DemoStepId; ms: number }[] = [
  { id: 'wind', ms: 6000 },
  { id: 'go', ms: 6000 },
  { id: 'point', ms: 7000 },
  { id: 'play', ms: 6000 },
  { id: 'space', ms: 5000 },
];
export const DEMO_TOTAL_MS = DEMO_STEPS.reduce((a, s) => a + s.ms, 0);

export interface DemoFrame { step: number; id: DemoStepId; t: number }

/** Який крок іде через elapsed мс від старту і поступ у ньому 0..1; після кінця — null. */
export function demoFrame(elapsed: number): DemoFrame | null {
  let at = Math.max(0, elapsed);
  for (let i = 0; i < DEMO_STEPS.length; i++) {
    const s = DEMO_STEPS[i];
    if (at < s.ms) return { step: i, id: s.id, t: at / s.ms };
    at -= s.ms;
  }
  return null;
}

/** Година програвання для поступу t (0..1) серед n годин. */
export function playHour(t: number, n: number): number {
  return Math.max(0, Math.min(n - 1, Math.floor(Math.max(0, Math.min(1, t)) * (n - 1) + 1e-9)));
}

export interface DemoPatch { layer?: 'wind' | 'go'; altM?: number; droneId?: string; lat?: number; lon?: number; hour?: number }

/** Зміна стану екрана на кроці id (t — поступ у кроці, n — годин у прогнозі). */
export function demoPatch(id: DemoStepId, t: number, point: { lat: number; lon: number } | null, n: number): DemoPatch {
  if (id === 'wind') return { layer: 'wind', altM: 120, hour: 0 };
  if (id === 'go') return { droneId: 'fpv7', altM: 50, layer: 'go' };
  if (id === 'point') return point ? { lat: point.lat, lon: point.lon } : {};
  if (id === 'play') return { hour: playHour(t, n) };
  return { hour: Math.max(0, n - 1) };
}

/**
 * Демо-точка «під Полтавою» (SPEC §3) — координати Полтави з data/static/cities.json, щоб не вигадувати своїх.
 * Публічне місто, не позиція екіпажу (Конституція 8).
 */
export function demoPoint(cities: readonly { nameEn?: string; lat: number; lon: number }[]): { lat: number; lon: number } | null {
  const c = cities.find((x) => x.nameEn === 'Poltava');
  return c ? { lat: c.lat, lon: c.lon } : null;
}

/** Наближення до демо-точки (assumption: ×2.5 — видно місто й околиці, рамка України ще впізнавана). */
export const DEMO_ZOOM = 2.5;
export const demoView = (p: { lat: number; lon: number }): View => ({ lat: p.lat, lon: p.lon, zoom: DEMO_ZOOM });

/** Плавний перехід вигляду a → b (t 0..1, ease-in-out). */
export function lerpView(a: View, b: View, t: number): View {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const e = t * t * (3 - 2 * t);
  return { lat: a.lat + (b.lat - a.lat) * e, lon: a.lon + (b.lon - a.lon) * e, zoom: a.zoom * Math.pow(b.zoom / a.zoom, e) };
}

/** Частка кроку на перехід вигляду. */
const MOVE = 0.25;

/** Вигляд карти на кроці (null — не чіпати). reduce (prefers-reduced-motion) — без анімації, одразу кінцевий. */
export function demoViewAt(id: DemoStepId, t: number, point: { lat: number; lon: number } | null, reduce: boolean): View | null {
  if (id === 'space') return null;
  if (!point || id === 'wind' || id === 'go') return FULL_VIEW;
  const k = reduce ? 1 : t / MOVE;
  return id === 'point' ? lerpView(FULL_VIEW, demoView(point), k) : lerpView(demoView(point), FULL_VIEW, k);
}

/** Чи запускати тур одразу (?demo=1). Координат в URL немає — точка з міст. */
export function isDemoUrl(search: string): boolean {
  return new URLSearchParams(search).get('demo') === '1';
}

export type SrcStatus = 'ok' | 'partial' | 'nodata';
export interface DemoFacts {
  /** Статуси джерел з meta.json: прогноз (openmeteo), Galileo, клімат ERA5. */
  forecast: SrcStatus; galileo: SrcStatus; climate: SrcStatus;
  /** Вердикт у точці на поточну годину — рівень, перша причина, підпис вікна (вже людською мовою). */
  level?: Level; reason?: string; window?: string;
  galVisible?: number | null; galPdop?: number | null;
}

/** Підпис кроку мовою lang — лише зі справжніх значень; немає даних → «немає даних», без чисел. */
export function demoCaption(id: DemoStepId, lang: Lang, f: DemoFacts): string {
  const L = (k: Key, p?: Record<string, string | number>) => t(k, lang, p);
  const noFc = f.forecast === 'nodata' ? ` · ${L('demo.noForecast')}` : '';
  if (id === 'wind') return L('demo.wind') + noFc;
  if (id === 'go') return L('demo.go') + noFc;
  if (id === 'play') return L('demo.play') + noFc;
  if (id === 'point') {
    const parts = [f.level ? L(`lv.${f.level}`) : '', f.reason ?? '', f.window ?? ''].filter(Boolean);
    return `${L('demo.point')}${parts.length ? `: ${parts.join(' · ')}` : ''}${noFc}`;
  }
  const gal = f.galileo === 'nodata' || f.galVisible == null || f.galPdop == null
    ? L('demo.galNo')
    : L('demo.gal', { n: f.galVisible, p: f.galPdop.toFixed(1) });
  return `${gal} · ${L(f.climate === 'nodata' ? 'demo.climNo' : 'demo.clim')}`;
}

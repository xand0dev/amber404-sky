// Issue #166: заставка й онбординг першого відкриття — чиста логіка без DOM (компоненти — app/splash, app/onboarding).
import type { Key } from './i18n';

/** Прапорець «онбординг уже бачили» (лише цей браузер). */
export const TOUR_KEY = 'amber404.tour';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function tourSeen(s: Store): boolean {
  try { return s.getItem(TOUR_KEY) === '1'; } catch { return false; }
}
export function markTourSeen(s: Store): void {
  try { s.setItem(TOUR_KEY, '1'); } catch { /* приватне вікно — покажемо ще раз, не страшно */ }
}

/** Картки онбордингу: текст і що підсвітити (перший видимий селектор; інакше — карта). */
export const TOUR_STEPS: readonly { key: Key; targets: readonly string[] }[] = [
  { key: 'tour.1', targets: ['.mapwrap'] },
  { key: 'tour.2', targets: ['.panel .row'] },
  { key: 'tour.3', targets: ['.locbtn', '.mapwrap'] },
];

/** Заставка не показується, якщо дані прийшли швидше (без мигання). */
export const SPLASH_DELAY_MS = 300;
/** Тривалість fade заставки. */
export const SPLASH_FADE_MS = 300;

export type SplashPhase = 'wait' | 'show' | 'fade' | 'gone';
/** delay — минуло SPLASH_DELAY_MS; ready — карта готова; faded — fade завершено. */
export function splashNext(p: SplashPhase, e: 'delay' | 'ready' | 'faded'): SplashPhase {
  if (p === 'wait') return e === 'delay' ? 'show' : e === 'ready' ? 'gone' : p;
  if (p === 'show') return e === 'ready' ? 'fade' : p;
  if (p === 'fade') return e === 'faded' ? 'gone' : p;
  return p;
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/** Перетин прямокутників (дотик краями — не перетин). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Де поставити картку, щоб не перекрити підсвічене місце: під ним, над ним, праворуч, ліворуч — перше,
 * що повністю влазить в екран з полем m. Якщо ніде — внизу екрана.
 */
export function placeCard(t: Rect | null, vp: Size, card: Size, m = 8): { x: number; y: number } {
  const cx = (x: number) => clamp(x, m, Math.max(m, vp.w - card.w - m));
  const cy = (y: number) => clamp(y, m, Math.max(m, vp.h - card.h - m));
  const bottom = { x: cx((vp.w - card.w) / 2), y: cy(vp.h - card.h - m) };
  if (!t) return bottom;
  const midX = t.x + t.w / 2 - card.w / 2, midY = t.y + t.h / 2 - card.h / 2;
  const cand = [
    { x: cx(midX), y: t.y + t.h + m },
    { x: cx(midX), y: t.y - m - card.h },
    { x: t.x + t.w + m, y: cy(midY) },
    { x: t.x - m - card.w, y: cy(midY) },
  ];
  const fits = (p: { x: number; y: number }) => p.x >= m && p.y >= m && p.x + card.w <= vp.w - m && p.y + card.h <= vp.h - m;
  return cand.find(fits) ?? bottom;
}

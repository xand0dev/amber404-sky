// F4-AC4 (SPEC §7.5a): збережена погода — лише localStorage (OPSEC, Конституція 8), до 12 записів; текст звіту для чату екіпажу.
import { t as coreT, type Lang, type Level } from '../../core';
import { pt } from './strings';

export const SAVED_KEY = 'amber404.saved';
export const MAX_SAVED = 12;

export interface SavedWx {
  id: string; savedAt: string;
  place: string; lat: number; lon: number; altM: number; time: string; drone: string;
  ws: number | null; dir: number | null; g: number | null; cb: number | null; t: number | null;
  level: Level; reasons: string[]; window: string;
  source: string; generatedAt: string; mock: boolean;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => { try { return localStorage; } catch { return null; } };

export function loadSaved(s: Store | null = store()): SavedWx[] {
  try {
    const v: unknown = JSON.parse(s?.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(v) ? (v as SavedWx[]).slice(0, MAX_SAVED) : [];
  } catch { return []; }
}

export function persist(list: SavedWx[], s: Store | null = store()): void {
  try { s?.setItem(SAVED_KEY, JSON.stringify(list.slice(0, MAX_SAVED))); } catch { /* приватне вікно або повне сховище */ }
}

/** Новий запис першим; понад 12 — найстаріший випадає. */
export const addSaved = (list: SavedWx[], e: SavedWx): SavedWx[] => [e, ...list.filter((x) => x.id !== e.id)].slice(0, MAX_SAVED);
export const removeSaved = (list: SavedWx[], id: string): SavedWx[] => list.filter((x) => x.id !== id);

const f = (x: number | null, d = 1) => (x == null ? '—' : x.toFixed(d));

/** Текст для чату екіпажу: місце, час (Київ), висота, дрон, вітер, хмари, вердикт, вікно, джерело. */
export function reportText(e: SavedWx, lang: Lang, kyivTime: string): string {
  const L = (k: Parameters<typeof pt>[0], p?: Record<string, string | number>) => pt(k, lang, p);
  return [
    L('r.title') + (e.mock ? ' · MOCK' : ''),
    L('r.place', { place: e.place }),
    L('r.when', { time: kyivTime, alt: e.altM, drone: e.drone }),
    L('r.wind', { ws: f(e.ws), dir: f(e.dir, 0), g: f(e.g) }),
    L('r.wx', { cb: f(e.cb, 0), t: f(e.t) }),
    L('r.verdict', { level: coreT(`lv.${e.level}`, lang), reasons: e.reasons.join('; ') }),
    L('r.window', { w: e.window }),
    L('r.foot', { src: e.source, gen: e.generatedAt }),
  ].join('\n');
}

/** Копіює текст у буфер; false — якщо браузер не дав (тоді показуємо текст для ручного копіювання). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

/** Час у Києві без назви дня — однаково для uk і en: «2026-11-28 09:00». */
export function kyivStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

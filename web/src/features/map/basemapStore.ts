// Issue #100: вибір підкладки — спільний для карти, меню й знімка; лише localStorage (Конституція 8).
// Статичні файли підкладок читаються раз і живуть у пам'яті (перемикання ≤ 300 мс, F3-AC2) та в кеші service worker.
import { useSyncExternalStore } from 'react';
import { BASE_FILE, BASE_KEY, DEFAULT_PREFS, ONLINE, parsePrefs, WATER_FILE, waterLines, type BaseId, type BasePrefs, type WaterLine } from './basemaps';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | null => { try { return localStorage; } catch { return null; } };

let prefs: BasePrefs | null = null;
const images = new Map<string, Promise<HTMLImageElement | null>>();
let water: Promise<WaterLine[]> | null = null;
const subs = new Set<() => void>();
const read = (): BasePrefs => (prefs ??= parsePrefs(storage()?.getItem(BASE_KEY) ?? null));

export function setBasemap(p: Partial<BasePrefs>): void {
  prefs = { ...read(), ...p };
  // Онлайн-вибір живе лише до перезавантаження (OPSEC): у сховище — попередня офлайн-підкладка.
  const keep = ONLINE.has(prefs.base) ? { ...prefs, base: parsePrefs(storage()?.getItem(BASE_KEY) ?? null).base } : prefs;
  try { storage()?.setItem(BASE_KEY, JSON.stringify(keep)); } catch { /* приватне вікно — вибір лише до перезавантаження */ }
  subs.forEach((f) => f());
}

/** Для тестів: перечитати вибір зі сховища й забути завантажені файли. */
export function resetBasemap(): void { prefs = null; images.clear(); water = null; }

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useBasemap = (): BasePrefs => useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);

/** Зображення підкладки (той самий статичний файл для всіх); null — немає файлу або помилка. */
export function loadBaseImage(base: BaseId): Promise<HTMLImageElement | null> {
  const url = BASE_FILE[base];
  if (!url) return Promise.resolve(null);
  return loadImage(url);
}

/** Статичне зображення за адресою (один раз на сесію). */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => { images.delete(url); res(null); };
      im.src = url;
    });
    images.set(url, p);
  }
  return p;
}

/** Ріки й озера з water.json; без файлу чи мережі — порожньо (карта працює й так). */
export function loadWater(get: (u: string) => Promise<Response> = (u) => fetch(u)): Promise<WaterLine[]> {
  water ??= get(WATER_FILE)
    .then((r) => (r.ok ? r.json() : null))
    .then(waterLines)
    .catch(() => { water = null; return []; });
  return water;
}

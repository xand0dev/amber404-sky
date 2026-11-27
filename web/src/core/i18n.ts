// Інтерфейс українською й англійською (issue #44, SPEC §11: журі міжнародне). Чистий TS без DOM.
// Ключі для всіх рядків app/ і причин вердикту (verdict.ts). Фічі F3/F4 підхоплюють через useT() з app/.

export type Lang = 'uk' | 'en';
export const LANGS: readonly Lang[] = ['uk', 'en'];

const uk = {
  // Рівні вердикту на плашці статусу.
  'lv.GO': 'МОЖНА', 'lv.CAUTION': 'ОБЕРЕЖНО', 'lv.NO-GO': 'НЕ МОЖНА', 'lv.NO-DATA': 'НЕМАЄ ДАНИХ',
  // Причини вердикту (SPEC §7.4).
  'go': 'Умови в межах профілю',
  'r.nodata': 'Немає даних про вітер',
  'r.wind': 'Вітер {v} м/с > ліміт {lim} м/с',
  'r.cloud': 'Висота {alt} м у хмарі: межа хмар ≈ {cb} м',
  'r.gust': 'Пориви {v} м/с > ліміт {lim} м/с',
  'r.temp': 'Температура {v} °C < мінімум {lim} °C',
  'r.precip': 'Опади {v} мм/год > ліміт {lim} мм/год',
  'r.icing': 'Обмерзання: {t} °C, вологість {rh}%',
  'c.wind': 'Вітер {v} м/с — понад 80% ліміту',
  'c.cloud': 'Висота {alt} м близько до хмар (≈ {cb} м)',
  'c.gust': 'Пориви {v} м/с — понад 80% ліміту',
  'c.temp': 'Температура {v} °C — близько до мінімуму',
  'c.vis': 'Видимість {v} м',
  'c.kp': 'Магнітна буря: Kp {v}',
  'c.galVisible': 'Galileo: видно {n} супутників',
  'c.galPdop': 'Galileo: PDOP {v}',
  // Каркас застосунку.
  'boot.loading': 'Завантаження…',
  'boot.error': 'Не вдалося завантажити дані: {err}',
  'unit.m': 'м',
  'night': 'Ніч',
  'lang.label': 'Мова інтерфейсу',
  'offline': 'офлайн · з кешу',
  'age.min': 'прогноз {n} хв тому',
  'age.h': 'прогноз {n} год тому',
  'age.staleMin': 'прогноз застарів: {n} хв тому',
  'age.staleH': 'прогноз застарів: {n} год тому',
  'age.unknown': 'час прогнозу невідомий',
  'win.none': 'Немає вікна ≥ 2 год до {until}',
  'win.span': '{start} – {end} · {n} год',
  'day.0': 'нд', 'day.1': 'пн', 'day.2': 'вт', 'day.3': 'ср', 'day.4': 'чт', 'day.5': 'пт', 'day.6': 'сб',
} as const;

export type Key = keyof typeof uk;

const en: Record<Key, string> = {
  'lv.GO': 'GO', 'lv.CAUTION': 'CAUTION', 'lv.NO-GO': 'NO-GO', 'lv.NO-DATA': 'NO DATA',
  'go': 'Within profile limits',
  'r.nodata': 'No wind data',
  'r.wind': 'Wind {v} m/s > limit {lim} m/s',
  'r.cloud': 'Altitude {alt} m in cloud: cloud base ≈ {cb} m',
  'r.gust': 'Gusts {v} m/s > limit {lim} m/s',
  'r.temp': 'Temperature {v} °C < minimum {lim} °C',
  'r.precip': 'Precipitation {v} mm/h > limit {lim} mm/h',
  'r.icing': 'Icing: {t} °C, humidity {rh}%',
  'c.wind': 'Wind {v} m/s — over 80% of limit',
  'c.cloud': 'Altitude {alt} m close to cloud base (≈ {cb} m)',
  'c.gust': 'Gusts {v} m/s — over 80% of limit',
  'c.temp': 'Temperature {v} °C — close to minimum',
  'c.vis': 'Visibility {v} m',
  'c.kp': 'Geomagnetic storm: Kp {v}',
  'c.galVisible': 'Galileo: {n} satellites visible',
  'c.galPdop': 'Galileo: PDOP {v}',
  'boot.loading': 'Loading…',
  'boot.error': 'Failed to load data: {err}',
  'unit.m': 'm',
  'night': 'Night',
  'lang.label': 'Interface language',
  'offline': 'offline · from cache',
  'age.min': 'forecast {n} min ago',
  'age.h': 'forecast {n} h ago',
  'age.staleMin': 'forecast stale: {n} min ago',
  'age.staleH': 'forecast stale: {n} h ago',
  'age.unknown': 'forecast time unknown',
  'win.none': 'No window ≥ 2 h until {until}',
  'win.span': '{start} – {end} · {n} h',
  'day.0': 'Sun', 'day.1': 'Mon', 'day.2': 'Tue', 'day.3': 'Wed', 'day.4': 'Thu', 'day.5': 'Fri', 'day.6': 'Sat',
};

export const DICT: Record<Lang, Record<Key, string>> = { uk, en };

export type Params = Record<string, string | number>;

/** Рядок за ключем; `{name}` замінюється на params.name. Невідомий параметр лишається як є. */
export function t(key: Key, lang: Lang, params?: Params): string {
  const s = DICT[lang][key];
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

/** Мова браузера: uk* → uk, будь-яка інша → en. */
export function detectLang(nav: string | null | undefined): Lang {
  return nav?.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

/** Збережене значення з localStorage: лише 'uk' або 'en', інакше null. */
export function parseLang(v: string | null): Lang | null {
  return v === 'uk' || v === 'en' ? v : null;
}

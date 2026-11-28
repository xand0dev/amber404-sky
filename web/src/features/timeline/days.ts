// F3: чиста логіка смуги 48 год — позначки днів і крок ▶ (F3-AC4). Без DOM.
// Назви днів — ключі day.0…6 з core/i18n (uk/en, issue #116).
import { nextWindow, t, type Key, type Lang, type Level } from '../../core';
import { isNightAt, sunTimes } from '../../core/sun';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric' });

/** Відрізок смуги на один київський день: перша година, кількість годин, підпис. */
export interface DaySegment { start: number; len: number; label: string; title: string }

function kyivDay(iso: string, lang: Lang): string {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${t(`day.${WD.indexOf(p.weekday)}` as Key, lang)} ${p.day}`;
}

/**
 * Дні йдуть суміжними відрізками на ширину своїх годин, тож позначки не накладаються.
 * День з 1 години занадто вузький для підпису — підпис лише в title.
 */
export function daySegments(times: string[], minLabelHours = 2, lang: Lang = 'uk'): DaySegment[] {
  const out: DaySegment[] = [];
  times.forEach((t, h) => {
    const d = kyivDay(t, lang);
    const last = out[out.length - 1];
    if (last && last.title === d) last.len++;
    else out.push({ start: h, len: 1, label: d, title: d });
  });
  return out.map((s) => ({ ...s, label: s.len >= minLabelHours ? s.title : '' }));
}

/** Наступна година при ▶; null — дійшли до кінця, зупинитись. */
export function nextPlayHour(h: number, n: number): number | null {
  return h + 1 < n ? h + 1 : null;
}

const H = 3_600_000;

/** Межа дня й ночі між годинами h-1 і h: захід (☾) чи схід (☀) і його справжній час (ms UTC). */
export interface SunEdge { h: number; kind: 'rise' | 'set'; at: number | null }

/**
 * Ніч у точці для кожної години (issue #172 AC1): середина години між заходом і сходом (core/sun, NOAA).
 * Межі — там, де ніч змінюється на день чи навпаки.
 */
export function sunMarks(times: string[], lat: number, lon: number): { night: boolean[]; edges: SunEdge[] } {
  const night = times.map((iso) => isNightAt(Date.parse(iso) + H / 2, lat, lon));
  const edges: SunEdge[] = [];
  for (let h = 1; h < night.length; h++) {
    if (night[h] === night[h - 1]) continue;
    const kind = night[h] ? 'set' : 'rise';
    edges.push({ h, kind, at: sunTimes(Date.parse(times[h]), lat, lon)[kind] });
  }
  return { night, edges };
}

/** Зміщення «зараз» у годинах від початку смуги (issue #172 AC2); поза смугою — null. */
export function nowOffset(times: string[], nowMs: number): number | null {
  if (!times.length) return null;
  const x = (nowMs - Date.parse(times[0])) / H;
  return x >= 0 && x < times.length ? x : null;
}

/** Година під час перетягування (issue #172 AC3): початкова + зсув на ширину години, у межах смуги. */
export function scrubHour(startHour: number, dx: number, n: number, hourPx = 32): number {
  return Math.min(n - 1, Math.max(0, startHour + Math.round(dx / hourPx)));
}

/** Найближче вікно від години from (issue #172 AC4) — те саме nextWindow з core/verdict, у годинах смуги. */
export function windowSpan(levels: Level[], times: string[], from: number): { start: number; len: number } | null {
  const w = nextWindow(levels.map((level) => ({ level, reasons: [] })), times, from);
  return w ? { start: times.indexOf(w.start), len: w.hours } : null;
}

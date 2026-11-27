// F3: чиста логіка смуги 48 год — позначки днів і крок ▶ (F3-AC4). Без DOM.
const DAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric' });

/** Відрізок смуги на один київський день: перша година, кількість годин, підпис. */
export interface DaySegment { start: number; len: number; label: string; title: string }

function kyivDay(iso: string): string {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${DAYS[WD.indexOf(p.weekday)]} ${p.day}`;
}

/**
 * Дні йдуть суміжними відрізками на ширину своїх годин, тож позначки не накладаються.
 * День з 1 години занадто вузький для підпису — підпис лише в title.
 */
export function daySegments(times: string[], minLabelHours = 2): DaySegment[] {
  const out: DaySegment[] = [];
  times.forEach((t, h) => {
    const d = kyivDay(t);
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

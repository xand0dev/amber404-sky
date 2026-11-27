// Показ часу в київському часі (SPEC §7.5).
const DAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
function kyivParts(iso: string) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day: DAYS[wd], hm: `${parts.hour}:${parts.minute}` };
}
export function kyivHM(iso: string): string { return kyivParts(iso).hm; }
export function kyivDayHM(iso: string): string { const p = kyivParts(iso); return `${p.day} ${p.hm}`; }
export function windowText(w: { start: string; end: string; hours: number } | null, lastIso: string): string {
  if (!w) return `Немає вікна ≥ 2 год до ${kyivDayHM(lastIso)}`;
  return `${kyivDayHM(w.start)} – ${kyivHM(w.end)} · ${w.hours} год`;
}

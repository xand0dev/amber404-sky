// Issue #172: схід і захід сонця локально, без мережі. Чистий TS без DOM.
// Формули NOAA Global Monitoring Laboratory, «General Solar Position Calculations»
// (gml.noaa.gov/grad/solcalc/solareqns.PDF): рівняння часу й схилення за дробовим роком γ,
// схід/захід — зеніт 90.833° (рефракція + радіус диска). Точність ~1–2 хв для широт України.

const RAD = Math.PI / 180;
const DAY = 86_400_000;
const ZENITH = 90.833;

/** Дробовий рік γ (рад), рівняння часу (хв) і схилення (рад) для моменту ms (UTC). */
function solar(ms: number): { eqtime: number; decl: number } {
  const d = new Date(ms);
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  const leap = (Date.UTC(d.getUTCFullYear() + 1, 0, 1) - y0) / DAY;
  const doy = Math.floor((ms - y0) / DAY) + 1;
  const hour = (ms - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 3_600_000;
  const g = ((2 * Math.PI) / leap) * (doy - 1 + (hour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eqtime, decl };
}

/** Висота сонця над обрієм (°) у момент ms для точки lat/lon (°, схід додатний). */
export function sunElevation(ms: number, lat: number, lon: number): number {
  const { eqtime, decl } = solar(ms);
  const d = new Date(ms);
  const minUtc = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const ha = ((minUtc + eqtime + 4 * lon) / 4 - 180) * RAD;
  const cosZ = Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZ))) / RAD;
}

/** Ніч — сонце нижче обрію з поправкою на рефракцію (між заходом і сходом). */
export function isNightAt(ms: number, lat: number, lon: number): boolean {
  return sunElevation(ms, lat, lon) < 90 - ZENITH;
}

/** Схід і захід (ms UTC) на UTC-добу моменту ms; полярна ніч чи день — null. */
export function sunTimes(ms: number, lat: number, lon: number): { rise: number | null; set: number | null } {
  const d = new Date(ms);
  const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const { eqtime, decl } = solar(day0 + DAY / 2);
  const c = Math.cos(ZENITH * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  if (c > 1 || c < -1) return { rise: null, set: null };
  const ha = Math.acos(c) / RAD;
  const at = (min: number) => Math.round(day0 + min * 60_000);
  return { rise: at(720 - 4 * (lon + ha) - eqtime), set: at(720 - 4 * (lon - ha) - eqtime) };
}

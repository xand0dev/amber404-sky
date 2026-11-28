// F4: клімат Copernicus ERA5 у панелі (SPEC §6.5, §7.8; демо §3 крок 5). Чистий TS без DOM.
import type { City, Climate } from '../../contracts';
import { distKm } from './place';

/**
 * Ключ у climate.json → id профілю дрона. Так рахує pipeline/sky/climate/fetch.py (PROFILES):
 * «wing» = крило електро (wingE). Для інших класів (recon, wingF, agro, свій дрон) ERA5 не рахували.
 */
export const CLIMATE_KEY: Record<string, string> = { fpv7: 'fpv7', fpv10: 'fpv10', heavy: 'heavy', wingE: 'wing' };

export type ClimateView =
  | { kind: 'nodata' } // немає climate.json
  | { kind: 'noclass'; covered: string[] } // для цього дрона клімат не рахували; covered — id профілів, для яких є
  | { kind: 'ok'; city: string; km: number; year: number; months: number[]; source: string };

/** Найближче з міст climate.json (координати — з cities.json) і ряд для обраного дрона. */
export function climateFor(c: Climate | null, cities: City[], lat: number, lon: number, droneId: string): ClimateView {
  if (!c) return { kind: 'nodata' };
  const covered = Object.keys(CLIMATE_KEY);
  const key = CLIMATE_KEY[droneId];
  if (!key) return { kind: 'noclass', covered };
  let best: { city: string; km: number } | null = null;
  for (const name of Object.keys(c.cities)) {
    const ct = cities.find((x) => x.name === name);
    if (!ct || !c.cities[name][key]) continue;
    const km = distKm(lat, lon, ct.lat, ct.lon);
    if (!best || km < best.km) best = { city: name, km };
  }
  if (!best) return { kind: 'nodata' };
  const months = c.cities[best.city][key];
  if (!Array.isArray(months) || months.length !== 12) return { kind: 'nodata' };
  return { kind: 'ok', ...best, year: c.year, months, source: c.sources.join(', ') };
}

/** Місяць (0–11) обраної години в київському часі. */
export function kyivMonth(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().getMonth();
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', month: 'numeric' }).format(d)) - 1;
}

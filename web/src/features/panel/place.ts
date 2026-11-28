// F4-AC1: назва найближчого міста (< 35 км) або координати. Чистий TS без DOM.
import type { City } from '../../contracts';
import { kyivHM, t as coreT, type Key, type Lang } from '../../core';
// Назви міст англійською — транслітерація КМУ № 55 від F3 (#116); TODO: перенести cityName у core (F0), щоб фічі не імпортували одна одну.
import { cityName } from '../map/translit';

export const CITY_RADIUS_KM = 35;

export function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dlat = (lat2 - lat1) * r, dlon = (lon2 - lon1) * r;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dlon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Найближче місто строго ближче за 35 км, інакше null. */
export function nearestCity(cities: City[], lat: number, lon: number, lang: Lang = 'uk'): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const c of cities) {
    const km = distKm(lat, lon, c.lat, c.lon);
    if (km < CITY_RADIUS_KM && (!best || km < best.km)) best = { name: cityName(c, lang), km };
  }
  return best;
}

export const coordText = (lat: number, lon: number) => `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

/** Підпис точки для звіту: «Київ (50.450, 30.520)» або лише координати. */
export function placeText(cities: City[], lat: number, lon: number, lang: Lang = 'uk'): string {
  const c = nearestCity(cities, lat, lon, lang);
  return c ? `${c.name} (${coordText(lat, lon)})` : coordText(lat, lon);
}

/** Кут повороту стрілки «куди дме» для напрямку «звідки дме», градуси за годинниковою від півночі. */
export const arrowDeg = (dirFrom: number) => (dirFrom + 180) % 360;

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** «сб 10:00» / «Sat 10:00» у київському часі — назви днів зі спільного словника (core/i18n). */
export function dayHM(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short' }).format(d);
  return `${coreT(`day.${WD.indexOf(wd)}` as Key, lang)} ${kyivHM(iso)}`;
}

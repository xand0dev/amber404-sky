// F4-AC1: назва найближчого міста (< 35 км) або координати. Чистий TS без DOM.
import type { City } from '../../contracts';

export const CITY_RADIUS_KM = 35;

export function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dlat = (lat2 - lat1) * r, dlon = (lon2 - lon1) * r;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dlon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Найближче місто строго ближче за 35 км, інакше null. */
export function nearestCity(cities: City[], lat: number, lon: number): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const c of cities) {
    const km = distKm(lat, lon, c.lat, c.lon);
    if (km < CITY_RADIUS_KM && (!best || km < best.km)) best = { name: c.name, km };
  }
  return best;
}

export const coordText = (lat: number, lon: number) => `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

/** Підпис точки для звіту: «Київ (50.450, 30.520)» або лише координати. */
export function placeText(cities: City[], lat: number, lon: number): string {
  const c = nearestCity(cities, lat, lon);
  return c ? `${c.name} (${coordText(lat, lon)})` : coordText(lat, lon);
}

/** Кут повороту стрілки «куди дме» для напрямку «звідки дме», градуси за годинниковою від півночі. */
export const arrowDeg = (dirFrom: number) => (dirFrom + 180) % 360;

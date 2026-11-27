// Маршрут A → B (SPEC §7.5a): набір 15%, крейсер, зниження 15%; 40 відрізків.
import { groundSpeed, offset } from './zone';

export type Wind3Fn = (lat: number, lon: number, altM: number) => [number, number] | null;
export interface Pt { lat: number; lon: number }

export function distanceM(a: Pt, b: Pt): number {
  const R = 6_371_000, r = Math.PI / 180;
  const dlat = (b.lat - a.lat) * r, dlon = (b.lon - a.lon) * r;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: Pt, b: Pt): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

/** Висота на частці шляху f (0…1): 10 м → alt за 15%, крейсер, зниження за останні 15%. */
export function arcAlt(f: number, altM: number, groundM = 10): number {
  if (f < 0.15) return groundM + (altM - groundM) * (f / 0.15);
  if (f > 0.85) return groundM + (altM - groundM) * ((1 - f) / 0.15);
  return altM;
}

export interface Leg { timeS: number | null; maxHead: number; maxCross: number }
export interface RouteResult { distM: number; bearing: number; there: Leg; back: Leg; totalS: number | null }

function leg(a: Pt, b: Pt, tas: number, alt: number, wind: Wind3Fn, n: number): Leg {
  const dist = distanceM(a, b), brg = bearingDeg(a, b), seg = dist / n;
  let t = 0, maxHead = 0, maxCross = 0;
  const br = (brg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const [lat, lon] = offset(a.lat, a.lon, brg, dist * f);
    const w = wind(lat, lon, arcAlt(f, alt));
    if (!w) return { timeS: null, maxHead, maxCross };
    const along = w[0] * Math.sin(br) + w[1] * Math.cos(br);
    const cross = Math.abs(w[0] * Math.cos(br) - w[1] * Math.sin(br));
    maxHead = Math.max(maxHead, -along);
    maxCross = Math.max(maxCross, cross);
    const gs = groundSpeed(tas, w[0], w[1], brg);
    if (gs == null) return { timeS: null, maxHead, maxCross };
    t += seg / gs;
  }
  return { timeS: t, maxHead, maxCross };
}

export function routeCalc(a: Pt, b: Pt, tasMs: number, altM: number, wind: Wind3Fn, n = 40): RouteResult {
  const there = leg(a, b, tasMs, altM, wind, n);
  const back = leg(b, a, tasMs, altM, wind, n);
  const totalS = there.timeS != null && back.timeS != null ? there.timeS + back.timeS : null;
  return { distM: distanceM(a, b), bearing: bearingDeg(a, b), there, back, totalS };
}

/** Найкраща висота 50…500 м: найменший час туди й назад без NO-GO. */
export function bestAltitude(a: Pt, b: Pt, tasMs: number, wind: Wind3Fn, isNoGo: (altM: number) => boolean): { altM: number; totalS: number } | null {
  let best: { altM: number; totalS: number } | null = null;
  for (let alt = 50; alt <= 500; alt += 50) {
    if (isNoGo(alt)) continue;
    const r = routeCalc(a, b, tasMs, alt, wind);
    if (r.totalS != null && (!best || r.totalS < best.totalS)) best = { altM: alt, totalS: r.totalS };
  }
  return best;
}

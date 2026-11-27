// F4 маршрут A → B (SPEC §7.5a): розріз вітру вздовж дуги і перевірка батареї. Чистий TS без DOM.
import { arcAlt, bearingDeg, bestAltitude, distanceM, offset, routeCalc, type Level, type Pt, type RouteResult, type Wind3Fn, type Lang } from '../../core';
import { pt, type PKey } from '../panel/strings';

export interface CutPoint { f: number; altM: number; along: number | null; cross: number | null }

/** 40 відрізків дуги A → B: попутна (+) / зустрічна (−) і бокова складові на висоті відрізка. */
export function routeCut(a: Pt, b: Pt, altM: number, wind: Wind3Fn, n = 40): CutPoint[] {
  const dist = distanceM(a, b), brg = bearingDeg(a, b), br = (brg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const f = (i + 0.5) / n;
    const [lat, lon] = offset(a.lat, a.lon, brg, dist * f);
    const alt = arcAlt(f, altM);
    const w = wind(lat, lon, alt);
    if (!w) return { f, altM: alt, along: null, cross: null };
    return { f, altM: alt, along: w[0] * Math.sin(br) + w[1] * Math.cos(br), cross: w[0] * Math.cos(br) - w[1] * Math.sin(br) };
  });
}

export interface RouteSummary {
  route: RouteResult; cut: CutPoint[]; maxHead: number; maxCross: number;
  best: { altM: number; totalS: number } | null; noData: boolean;
}

export function routeSummary(a: Pt, b: Pt, tasMs: number, altM: number, wind: Wind3Fn, isNoGo: (altM: number) => boolean): RouteSummary {
  const route = routeCalc(a, b, tasMs, altM, wind);
  const cut = routeCut(a, b, altM, wind);
  const noData = cut.some((c) => c.along == null) || routeCut(b, a, altM, wind).some((c) => c.along == null);
  return {
    route, cut, noData,
    maxHead: Math.max(route.there.maxHead, route.back.maxHead),
    maxCross: Math.max(route.there.maxCross, route.back.maxCross),
    best: bestAltitude(a, b, tasMs, wind, isNoGo),
  };
}

const mm = (s: number) => (s / 60).toFixed(1);

/** Батарея: туди ≤ T×0.8, інакше NO-GO; туди + назад > T×0.8 — CAUTION. usableS = T×0.8 у секундах. Причини — мовою lang. */
export function batteryCheck(r: RouteResult, usableS: number, noData = false, lang: Lang = 'uk'): { level: Level; reasons: string[] } {
  const L = (k: PKey, p?: Record<string, string | number>) => pt(k, lang, p);
  if (noData) return { level: 'NO-DATA', reasons: [L('b.nodata')] };
  const there = r.there.timeS;
  if (there == null) return { level: 'NO-GO', reasons: [L('b.noThere')] };
  if (there > usableS) return { level: 'NO-GO', reasons: [L('b.there', { t: mm(there), u: mm(usableS) })] };
  if (r.totalS == null) return { level: 'CAUTION', reasons: [L('b.noBack')] };
  if (r.totalS > usableS) return { level: 'CAUTION', reasons: [L('b.total', { t: mm(r.totalS), u: mm(usableS) })] };
  return { level: 'GO', reasons: [L('b.ok', { t: mm(r.totalS), u: mm(usableS) })] };
}

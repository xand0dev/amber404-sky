// F4 маршрут A → B (SPEC §7.5a): розріз вітру вздовж дуги і перевірка батареї. Чистий TS без DOM.
import { arcAlt, bearingDeg, bestAltitude, distanceM, offset, routeCalc, type Level, type Pt, type RouteResult, type Wind3Fn } from '../../core';

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

/** Батарея: туди ≤ T×0.8, інакше NO-GO; туди + назад > T×0.8 — CAUTION. usableS = T×0.8 у секундах. */
export function batteryCheck(r: RouteResult, usableS: number, noData = false): { level: Level; reasons: string[] } {
  if (noData) return { level: 'NO-DATA', reasons: ['Немає даних про вітер на маршруті'] };
  const there = r.there.timeS;
  if (there == null) return { level: 'NO-GO', reasons: ['Туди не долетить: вітер ≥ швидкості дрона'] };
  if (there > usableS) return { level: 'NO-GO', reasons: [`Туди ${mm(there)} хв > ${mm(usableS)} хв (T×0.8)`] };
  if (r.totalS == null) return { level: 'CAUTION', reasons: ['Назад не долетить: зустрічний вітер ≥ швидкості дрона'] };
  if (r.totalS > usableS) return { level: 'CAUTION', reasons: [`Туди й назад ${mm(r.totalS)} хв > ${mm(usableS)} хв (T×0.8) — назад не вистачить`] };
  return { level: 'GO', reasons: [`Туди й назад ${mm(r.totalS)} хв ≤ ${mm(usableS)} хв (T×0.8)`] };
}

// Стан шару «Зона польоту» (SPEC §7.5b, issue #22): розрахунок через core/zone.ts, час — core/energy.ts.
// Мемоізація за точкою, висотою, годиною й дроном; картка зони в панелі (F4) може брати стан звідси через useZone().
import { effectiveEndurance, energyInput, offset, usableSeconds, weatherAt, windAt, zoneCalc, type Projection, type ZonePoint } from '../../core';
import type { DroneProfile } from '../../contracts';
import type { Bundle } from '../data';

export interface ZoneKey { lat: number; lon: number; altM: number; hour: number; droneId: string }
export interface ZoneState extends ZoneKey {
  prof: DroneProfile;
  mode: 'roundtrip';
  enduranceMin: number; // ефективний T без резерву
  why: string; // з чого порахований T
  usableS: number; // T × (1 − резерв 20%)
  wind: [number, number] | null; // u, v у точці старту
  points: ZonePoint[];
  cut: ZonePoint[]; // промені, що обірвались на ліміті вітру
  maxDistM: number;
  rings: number[];
}

const NICE = [500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000];
/** Кільця відстаней: найменший круглий крок, з яким у зоні ≤ 4 кільця. */
export function ringSteps(maxM: number): number[] {
  if (maxM <= 0) return [];
  const step = NICE.find((s) => Math.floor(maxM / s) <= 4) ?? NICE[NICE.length - 1];
  return Array.from({ length: Math.floor(maxM / step) }, (_, i) => (i + 1) * step);
}

// Кеш останніх розрахунків для кожного пакета даних: перемикання годин туди-назад не рахує зону вдруге.
let cache = new WeakMap<Bundle, Map<string, ZoneState>>();
const CACHE_MAX = 64;
export function clearZoneCache() { cache = new WeakMap(); }

export function zoneFor(data: Bundle, k: ZoneKey): ZoneState | null {
  const prof = data.profiles.find((p) => p.id === k.droneId) ?? data.profiles[0];
  if (!prof) return null;
  const key = `${k.lat.toFixed(5)}|${k.lon.toFixed(5)}|${k.altM}|${k.hour}|${prof.id}`;
  let m = cache.get(data);
  if (!m) { m = new Map(); cache.set(data, m); }
  const hit = m.get(key);
  if (hit) return hit;

  const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
  const t = weatherAt(src, k.lat, k.lon, k.altM, k.hour).t;
  // Свій дрон (F4-AC6) несе payloadKg / fuelL / burnLh поза контрактом — той самий вхід, що й картка зони в панелі (#107).
  const e = effectiveEndurance(energyInput(prof, t));
  const usableS = usableSeconds(e.min);
  // Крок уздовж променя: ~80 кроків на радіус у штиль, не дрібніше 250 м — щоб крило на 300 хв теж рахувалось ≤ 100 мс.
  const stepM = Math.max(250, Math.round((prof.cruiseMs * usableS) / 2 / 80));
  const g = data.meta.grid, P = data.profile;
  const points = zoneCalc(
    { lat: k.lat, lon: k.lon, tasMs: prof.cruiseMs, windLimitMs: prof.windMs, usableS, mode: 'roundtrip', stepM },
    (la, lo) => windAt(g, P, k.altM, k.hour, la, lo),
  );
  const maxDistM = Math.max(0, ...points.map((p) => p.distM));
  const z: ZoneState = {
    ...k, droneId: prof.id, prof, mode: 'roundtrip', enduranceMin: e.min, why: e.why, usableS,
    wind: windAt(g, P, k.altM, k.hour, k.lat, k.lon), points, cut: points.filter((p) => p.stop === 'wind-limit'),
    maxDistM, rings: ringSteps(maxDistM),
  };
  if (m.size >= CACHE_MAX) m.delete(m.keys().next().value as string);
  m.set(key, z);
  return z;
}

type XY = [number, number];
export interface ZoneShapes { center: XY; contour: XY[]; rings: { distM: number; pts: XY[] }[]; dots: XY[]; arrow: [XY, XY] | null }

const ARROW_PX = 36;
/** Геометрія шару в пікселях спільної проєкції (core/projection.ts). */
export function zoneShapes(z: ZoneState, proj: Projection): ZoneShapes {
  const p = (la: number, lo: number) => proj.project(la, lo);
  const center = p(z.lat, z.lon);
  const rings = z.rings.map((d) => ({
    distM: d, pts: Array.from({ length: 72 }, (_, i) => p(...offset(z.lat, z.lon, i * 5, d))),
  }));
  let arrow: [XY, XY] | null = null;
  if (z.wind) {
    const s = Math.hypot(z.wind[0], z.wind[1]);
    // u — на схід (+x), v — на північ (−y екрана); стрілка показує, куди дме.
    if (s > 0.05) arrow = [center, [center[0] + (z.wind[0] / s) * ARROW_PX, center[1] - (z.wind[1] / s) * ARROW_PX]];
  }
  return { center, contour: z.points.map((q) => p(q.lat, q.lon)), rings, dots: z.cut.map((q) => p(q.lat, q.lon)), arrow };
}

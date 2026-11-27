// F4 зона польоту (SPEC §7.5b): обгортка над core/zone.ts і core/energy.ts + геометрія картки. Чистий TS без DOM.
import { effectiveEndurance, usableSeconds, zoneCalc, type EnergyInput, type WindFn, type ZonePoint } from '../../core';
import type { DroneProfile } from '../../contracts';

/** Додаткові поля «свого дрона» (§7.3a), яких немає в каталозі. */
export interface EnergyExtras { payloadKg?: number; fuelL?: number; burnLh?: number }
export type AnyProfile = DroneProfile & EnergyExtras;

/** Вхід для effectiveEndurance з профілю (каталог або свій дрон) і температури в точці старту. */
export function energyInput(p: AnyProfile, t: number | null): EnergyInput {
  return { energy: p.energy, enduranceMin: p.enduranceMin, fuelL: p.fuelL, burnLh: p.burnLh, massKg: p.massKg, payloadKg: p.payloadKg ?? 0, kind: p.kind, t };
}

export interface ZoneResult {
  pts: ZonePoint[]; usableS: number; min: number; why: string;
  maxM: number; minM: number; counts: Record<ZonePoint['stop'], number>;
}

/**
 * Крок уздовж променя: 250 м (як у core), але не більше ~200 кроків на найдовший можливий промінь,
 * щоб крила на 5 год не рахувались секундами. Похибка — не більше одного кроку (assumption).
 */
export function stepFor(tasMs: number, usableS: number): number {
  return Math.max(250, Math.ceil((tasMs * usableS) / 200 / 250) * 250);
}

export function zoneFor(p: AnyProfile, lat: number, lon: number, t: number | null, wind: WindFn, mode: 'roundtrip' | 'oneway'): ZoneResult {
  const e = effectiveEndurance(energyInput(p, t));
  const usableS = usableSeconds(e.min);
  const pts = zoneCalc({ lat, lon, tasMs: p.cruiseMs, windLimitMs: p.windMs, usableS, mode, stepM: stepFor(p.cruiseMs, usableS) }, wind);
  const counts = { energy: 0, 'wind-limit': 0, 'too-strong': 0, 'no-data': 0, max: 0 } as ZoneResult['counts'];
  for (const q of pts) counts[q.stop]++;
  const d = pts.map((q) => q.distM);
  return { pts, usableS, min: e.min, why: e.why, maxM: Math.max(0, ...d), minM: d.length ? Math.min(...d) : 0, counts };
}

/** «Гарні» кільця відстаней: 1–2–5 × 10^k км, 2–4 кільця до maxM. */
export function ringsKm(maxM: number): number[] {
  const km = maxM / 1000;
  if (km <= 0) return [];
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  const step = steps.find((s) => km / s <= 4) ?? 500;
  const out: number[] = [];
  for (let r = step; r <= km + 1e-9; r += step) out.push(Math.round(r * 10) / 10);
  return out.length ? out : [step];
}

/** Координати точки зони на картці: схід → x, північ → −y, масштаб R / maxM. */
export function project(lat0: number, lon0: number, lat: number, lon: number, scale: number): [number, number] {
  const dx = (lon - lon0) * 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const dy = (lat - lat0) * 111_320;
  return [dx * scale, -dy * scale];
}

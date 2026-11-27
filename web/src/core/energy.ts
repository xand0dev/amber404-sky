// Ефективний час польоту (SPEC §7.3a). Усі коефіцієнти — assumption.
import { t as tr, type Lang } from './i18n';

export const RESERVE = 0.2;

/** 1 при t ≥ 10 °C, лінійно до 0.7 при −20 °C, нижче — 0.7. */
export function kCold(t: number | null): number {
  if (t == null || t >= 10) return 1;
  if (t <= -20) return 0.7;
  return 0.7 + ((t + 20) / 30) * 0.3;
}

/** (m / (m + вантаж))^1.5 — лише для мультироторів. */
export function kPayload(massKg: number, payloadKg: number, kind: 'multirotor' | 'wing'): number {
  if (kind !== 'multirotor' || payloadKg <= 0) return 1;
  return (massKg / (massKg + payloadKg)) ** 1.5;
}

export interface EnergyInput {
  energy: 'battery' | 'fuel';
  enduranceMin?: number; // акумулятор: паспорт
  fuelL?: number; // паливо
  burnLh?: number;
  massKg: number;
  payloadKg?: number;
  kind: 'multirotor' | 'wing';
  t: number | null;
}

/** Додаткові поля «свого дрона» (§7.3a), яких немає в каталозі profiles.json. */
export interface EnergyExtras { payloadKg?: number; fuelL?: number; burnLh?: number }
type EnergyProfile = Pick<EnergyInput, 'energy' | 'massKg' | 'kind'> & { enduranceMin: number } & EnergyExtras;

/** Вхід для effectiveEndurance з профілю (каталог або свій дрон) і температури в точці старту — однаково для карти й панелі. */
export function energyInput(p: EnergyProfile, t: number | null): EnergyInput {
  return { energy: p.energy, enduranceMin: p.enduranceMin, fuelL: p.fuelL, burnLh: p.burnLh, massKg: p.massKg, payloadKg: p.payloadKg ?? 0, kind: p.kind, t };
}

/** Ефективний час польоту, хв (без резерву) і пояснення мовою lang, з чого порахований. */
export function effectiveEndurance(e: EnergyInput, lang: Lang = 'uk'): { min: number; why: string } {
  if (e.energy === 'fuel') {
    const min = e.fuelL && e.burnLh ? (e.fuelL / e.burnLh) * 60 : (e.enduranceMin ?? 0);
    return { min, why: e.fuelL && e.burnLh ? tr('why.fuel', lang, { l: e.fuelL, b: e.burnLh }) : tr('why.fuelPass', lang, { base: String(e.enduranceMin) }) };
  }
  const base = e.enduranceMin ?? 0;
  const kc = kCold(e.t);
  const kp = kPayload(e.massKg, e.payloadKg ?? 0, e.kind);
  return { min: base * kc * kp, why: tr('why.batt', lang, { base, kc: kc.toFixed(2), kp: kp.toFixed(2) }) };
}

/** Час, доступний на політ з резервом 20%, секунд. */
export function usableSeconds(min: number): number {
  return min * 60 * (1 - RESERVE);
}

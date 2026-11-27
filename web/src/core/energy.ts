// Ефективний час польоту (SPEC §7.3a). Усі коефіцієнти — assumption.
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

/** Ефективний час польоту, хв (без резерву) і пояснення, з чого порахований. */
export function effectiveEndurance(e: EnergyInput): { min: number; why: string } {
  if (e.energy === 'fuel') {
    const min = e.fuelL && e.burnLh ? (e.fuelL / e.burnLh) * 60 : (e.enduranceMin ?? 0);
    return { min, why: e.fuelL && e.burnLh ? `${e.fuelL} л / ${e.burnLh} л/год` : `паспорт ${e.enduranceMin} хв (паливо)` };
  }
  const base = e.enduranceMin ?? 0;
  const kc = kCold(e.t);
  const kp = kPayload(e.massKg, e.payloadKg ?? 0, e.kind);
  return { min: base * kc * kp, why: `паспорт ${base} хв × холод ${kc.toFixed(2)} × вантаж ${kp.toFixed(2)}` };
}

/** Час, доступний на політ з резервом 20%, секунд. */
export function usableSeconds(min: number): number {
  return min * 60 * (1 - RESERVE);
}

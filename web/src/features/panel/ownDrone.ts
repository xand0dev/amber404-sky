// F4-AC6 (SPEC §7.3a): «свій дрон» — лише localStorage (OPSEC). Чистий TS без DOM.
import type { DroneProfile } from '../../contracts';
import type { AnyProfile } from './zoneLogic';

export const OWN_KEY = 'amber404.ownDrone';
export const OWN_ID = 'own';

export interface OwnDrone {
  kind: 'multirotor' | 'wing';
  massKg: number; payloadKg: number; cruiseMs: number;
  windMs: number; gustMs: number; tMinC: number; precipMmH: number;
  band0: number; band1: number;
  energy: 'battery' | 'fuel';
  enduranceMin: number; fuelL: number; burnLh: number;
}

/** Стартові значення форми — з обраного профілю каталогу (теж assumption). */
export function fromProfile(p: AnyProfile): OwnDrone {
  return {
    kind: p.kind, massKg: p.massKg, payloadKg: p.payloadKg ?? 0, cruiseMs: p.cruiseMs,
    windMs: p.windMs, gustMs: p.gustMs, tMinC: p.tMinC, precipMmH: p.precipMmH,
    band0: p.bandM[0], band1: p.bandM[1], energy: p.energy,
    enduranceMin: p.enduranceMin, fuelL: p.fuelL ?? 0, burnLh: p.burnLh ?? 0,
  };
}

type Field = keyof OwnDrone;
/** Поля з помилкою (порожній масив — усе гаразд). */
export function validate(o: OwnDrone): Field[] {
  const bad: Field[] = [];
  const pos = (k: Field, v: number) => { if (!Number.isFinite(v) || v <= 0) bad.push(k); };
  const nonneg = (k: Field, v: number) => { if (!Number.isFinite(v) || v < 0) bad.push(k); };
  pos('massKg', o.massKg); nonneg('payloadKg', o.payloadKg); pos('cruiseMs', o.cruiseMs);
  pos('windMs', o.windMs); pos('gustMs', o.gustMs); nonneg('precipMmH', o.precipMmH);
  if (!Number.isFinite(o.tMinC) || o.tMinC < -60 || o.tMinC > 40) bad.push('tMinC');
  if (!Number.isFinite(o.band0) || o.band0 < 0) bad.push('band0');
  if (!Number.isFinite(o.band1) || o.band1 <= o.band0) bad.push('band1');
  if (o.energy === 'battery') pos('enduranceMin', o.enduranceMin);
  else { pos('fuelL', o.fuelL); pos('burnLh', o.burnLh); }
  return bad;
}

/** Профіль для вердикту, зони й маршруту. Для палива час — літри / витрата × 60 (§7.3a). */
export function toProfile(o: OwnDrone, name: string): AnyProfile & DroneProfile {
  const fuel = o.energy === 'fuel';
  const enduranceMin = fuel ? (o.fuelL / o.burnLh) * 60 : o.enduranceMin;
  const alt = Math.max(10, Math.min(1000, Math.round(Math.min(Math.max(o.band0, 10), o.band1) / 10) * 10));
  return {
    id: OWN_ID, name, use: name, massKg: o.massKg, energy: o.energy, enduranceMin, cruiseMs: o.cruiseMs,
    windMs: o.windMs, gustMs: o.gustMs, tMinC: o.tMinC, precipMmH: o.precipMmH,
    bandM: [o.band0, o.band1], defaultAltM: alt, kind: o.kind, source: 'користувач (свій дрон)',
    payloadKg: o.payloadKg, ...(fuel ? { fuelL: o.fuelL, burnLh: o.burnLh } : {}),
  };
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => { try { return localStorage; } catch { return null; } };

export function loadOwn(s: Store | null = store()): OwnDrone | null {
  try {
    const v = JSON.parse(s?.getItem(OWN_KEY) ?? 'null') as OwnDrone | null;
    return v && typeof v === 'object' && validate(v).length === 0 ? v : null;
  } catch { return null; }
}
export function saveOwn(o: OwnDrone, s: Store | null = store()): void {
  try { s?.setItem(OWN_KEY, JSON.stringify(o)); } catch { /* приватне вікно */ }
}
export function removeOwn(s: Store | null = store()): void {
  try { s?.removeItem(OWN_KEY); } catch { /* приватне вікно */ }
}

/** Додати або замінити свій дрон у списку профілів (каталог лишається як є). */
export const upsertOwn = (list: DroneProfile[], p: DroneProfile): DroneProfile[] => [...list.filter((x) => x.id !== OWN_ID), p];
export const dropOwn = (list: DroneProfile[]): DroneProfile[] => list.filter((x) => x.id !== OWN_ID);

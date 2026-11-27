// Тестова сітка (лише для тестів): плавне синтетичне поле на сітці §7.1, не реальні дані.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';

const G = { lat0: 52.5, lon0: 22, step: 0.5, nr: 18, nc: 38 };
const N = G.nr * G.nc;
const node = (f: (r: number, c: number) => number | null) => Array.from({ length: N }, (_, i) => f(Math.floor(i / G.nc), i % G.nc));
const hours = <T,>(f: () => T) => Array.from({ length: 2 }, f);

/** Вітер росте із заходу на схід 0…26 м/с; решта полів — теж лінійні градієнти. */
export function bundle(): Bundle {
  const levels = [10, 50, 100];
  const spd = levels.map(() => hours(() => node((_, c) => Math.round((c / (G.nc - 1)) * 260))));
  const dir = levels.map(() => hours(() => node(() => 270)));
  return {
    meta: { generatedAt: '2026-11-27T18:00:00Z', mock: true, grid: G, times: ['2026-11-27T18:00:00Z', '2026-11-27T19:00:00Z'], sources: [] },
    profile: {
      generatedAt: '', sources: [], levels, spd, dir,
      gust: hours(() => node((_, c) => c * 7)),
      temp: hours(() => node((r) => 100 - r * 10)),
      precip: hours(() => node(() => 0)),
      rh: hours(() => node((r) => 50 + r * 2)),
      vis: hours(() => node((_, c) => c * 10)),
    },
    galileo: null, kp: null, climate: null,
    profiles: [{ id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13, tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption' }] as unknown as Bundle['profiles'],
    cities: [], borders: { features: [] },
  };
}

export const state = (p: Partial<AppState> = {}): AppState => ({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: 'wind', ...p });

// Спільний стан екрана: обрана точка, висота, година, дрон, шар. Фічі читають і змінюють лише через це.
import { createContext, useContext } from 'react';
import type { DroneProfile } from '../contracts';
import type { Bundle } from './data';

export type LayerId = 'wind' | 'cloud' | 'gust' | 'go' | 'icing' | 'temp' | 'vis';
export interface AppState {
  lat: number; lon: number; altM: number; hour: number; droneId: string; layer: LayerId;
}
export interface Ctx {
  data: Bundle; s: AppState; set: (p: Partial<AppState>) => void;
  /** «Свій дрон» (F4-AC6, §7.3a): F4 додає або прибирає профіль у списку; дані лише в браузері. Необов'язкове для тестів фіч. */
  setProfiles?: (f: (list: DroneProfile[]) => DroneProfile[]) => void;
}
export const AppCtx = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppCtx missing');
  return c;
}

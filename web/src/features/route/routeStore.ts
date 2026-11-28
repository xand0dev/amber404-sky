// Маршрут (F4): точка B і режим «торкніться карти» — спільні для панелі й шару на карті.
// Лише в пам'яті сторінки: на сервер і в localStorage не йде (Конституція 8).
import { useSyncExternalStore } from 'react';
import type { Pt } from '../../core';

export interface RouteState { b: Pt | null; picking: boolean }
const EMPTY: RouteState = { b: null, picking: false };
let st: RouteState = EMPTY;
const subs = new Set<() => void>();

export function setRoute(p: Partial<RouteState>): void { st = { ...st, ...p }; subs.forEach((f) => f()); }
export function resetRoute(): void { setRoute(EMPTY); }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useRoute = (): RouteState => useSyncExternalStore(subscribe, () => st, () => EMPTY);

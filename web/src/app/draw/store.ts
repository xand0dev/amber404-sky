// Малюнки лише в браузері (SPEC §7.13, Конституція 8 OPSEC): localStorage, без мережі. Історія для «скасувати».
import { isShape, type Shape } from '../../core';

export const KEY = 'amber-draw';
const MAX_UNDO = 50;

export function loadShapes(): Shape[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(isShape) : [];
  } catch {
    return [];
  }
}

/** true — збережено; false — сховище недоступне або переповнене. */
export function saveShapes(shapes: Shape[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(shapes));
    return true;
  } catch {
    return false;
  }
}

export interface DrawState { shapes: Shape[]; past: Shape[][] }
export type DrawAction =
  | { type: 'add'; shape: Shape }
  | { type: 'remove'; id: string }
  | { type: 'import'; shapes: Shape[] }
  | { type: 'undo' };

export const initDraw = (shapes: Shape[]): DrawState => ({ shapes, past: [] });

export function draw(s: DrawState, a: DrawAction): DrawState {
  const push = (shapes: Shape[]) => ({ shapes, past: [...s.past, s.shapes].slice(-MAX_UNDO) });
  switch (a.type) {
    case 'add': return push([...s.shapes, a.shape]);
    case 'remove': return s.shapes.some((x) => x.id === a.id) ? push(s.shapes.filter((x) => x.id !== a.id)) : s;
    case 'import': return a.shapes.length ? push([...s.shapes, ...a.shapes]) : s;
    case 'undo': return s.past.length ? { shapes: s.past.at(-1)!, past: s.past.slice(0, -1) } : s;
  }
}

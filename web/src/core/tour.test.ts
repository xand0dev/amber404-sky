// Issue #166: логіка заставки й онбордингу першого відкриття (чистий TS).
import { describe, expect, it } from 'vitest';
import { SPLASH_DELAY_MS, TOUR_KEY, TOUR_STEPS, markTourSeen, overlaps, placeCard, splashNext, tourSeen, type SplashPhase } from './tour';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('AC2: прапорець першого відкриття в localStorage', () => {
  it('Given чистий браузер Then онбординг ще не бачили', () => expect(tourSeen(mem())).toBe(false));
  it('Given «Пропустити» чи «Почати» Then прапорець стоїть', () => {
    const s = mem();
    markTourSeen(s);
    expect(s.m.get(TOUR_KEY)).toBe('1');
    expect(tourSeen(s)).toBe(true);
  });
  it('Given недоступне сховище (приватне вікно) Then не падає й показує онбординг', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(tourSeen(bad)).toBe(false);
    expect(() => markTourSeen(bad)).not.toThrow();
  });
  it('3 картки: карта, дрон і висота, точка / «Де я»', () => {
    expect(TOUR_STEPS.map((s) => s.key)).toEqual(['tour.1', 'tour.2', 'tour.3']);
    expect(TOUR_STEPS.every((s) => s.targets.length > 0)).toBe(true);
  });
});

describe('AC1: заставка без мигання', () => {
  const run = (evs: Parameters<typeof splashNext>[1][]) => evs.reduce<SplashPhase>(splashNext, 'wait');
  it('поріг — 300 мс', () => expect(SPLASH_DELAY_MS).toBe(300));
  it('Given дані прийшли < 300 мс Then заставку не показуємо зовсім', () => expect(run(['ready', 'delay'])).toBe('gone'));
  it('Given повільні дані Then показуємо після 300 мс', () => expect(run(['delay'])).toBe('show'));
  it('Given заставка показана й дані прийшли Then плавний fade, потім зникає', () => {
    expect(run(['delay', 'ready'])).toBe('fade');
    expect(run(['delay', 'ready', 'faded'])).toBe('gone');
  });
});

describe('AC3: картка не перекриває підсвічене місце', () => {
  const vp = { w: 400, h: 800 };
  const card = { w: 384, h: 180 };
  const box = (p: { x: number; y: number }) => ({ x: p.x, y: p.y, w: card.w, h: card.h });
  const inside = (p: { x: number; y: number }, v = vp) => p.x >= 0 && p.y >= 0 && p.x + card.w <= v.w && p.y + card.h <= v.h;

  it('Given карта телефона 400×800 Then картка під картою, у межах екрана', () => {
    const map = { x: 0, y: 160, w: 400, h: 385 };
    const p = placeCard(map, vp, card);
    expect(overlaps(box(p), map)).toBe(false);
    expect(inside(p)).toBe(true);
  });
  it('Given дрон і висота внизу екрана Then картка над ними', () => {
    const row = { x: 16, y: 690, w: 368, h: 90 };
    const p = placeCard(row, vp, card);
    expect(p.y + card.h).toBeLessThanOrEqual(row.y);
    expect(inside(p)).toBe(true);
  });
  it('Given кнопка «Де я» в ряді над картою Then картка під нею', () => {
    const btn = { x: 300, y: 114, w: 44, h: 44 };
    const p = placeCard(btn, vp, card);
    expect(overlaps(box(p), btn)).toBe(false);
    expect(p.y).toBeGreaterThanOrEqual(btn.y + btn.h);
  });
  it('Given десктоп, карта на всю висоту зліва Then картка праворуч від неї', () => {
    const d = { w: 1280, h: 800 };
    const map = { x: 0, y: 116, w: 880, h: 600 };
    const p = placeCard(map, d, card);
    expect(overlaps(box(p), map)).toBe(false);
    expect(inside(p, d)).toBe(true);
  });
  it('Given місця немає ніде Then картка внизу екрана, у межах', () => {
    const p = placeCard({ x: 0, y: 0, w: 400, h: 800 }, vp, card);
    expect(inside(p)).toBe(true);
    expect(p.y + card.h).toBe(vp.h - 8);
  });
  it('Given немає цілі Then картка по центру знизу', () => {
    const p = placeCard(null, vp, card);
    expect(inside(p)).toBe(true);
  });
  it('overlaps: дотик краями — не перекриття', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });
});

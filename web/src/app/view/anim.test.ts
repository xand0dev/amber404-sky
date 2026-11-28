import { describe, expect, it } from 'vitest';
import { FULL_VIEW, type View } from '../../core';
import { ANIM_MS, createViewAnimator } from './anim';

// Фальшивий rAF: кадри запускаємо руками з потрібним часом.
function rig(reduced = false) {
  let cur: View = FULL_VIEW, now = 0, renders = 0;
  const q = new Map<number, (t: number) => void>();
  let id = 0;
  const a = createViewAnimator({
    get: () => cur,
    set: (v) => { cur = v; renders++; },
    raf: (f) => { q.set(++id, f); return id; },
    caf: (i) => { q.delete(i); },
    now: () => now,
    reduced: () => reduced,
  });
  const frame = (t: number) => { now = t; const fs = [...q.values()]; q.clear(); fs.forEach((f) => f(t)); };
  return { a, frame, view: () => cur, renders: () => renders, pending: () => q.size };
}
const B: View = { lat: 50, lon: 34, zoom: 16 };

describe('Given перехід вигляду кнопкою (issue #174)', () => {
  it(`When to(); Then не стрибок: за ${ANIM_MS} мс доходить до цілі, а посередині — між`, () => {
    const r = rig();
    r.a.to(B);
    expect(r.view()).toEqual(FULL_VIEW);
    r.frame(ANIM_MS / 2);
    expect(r.view().zoom).toBeGreaterThan(1);
    expect(r.view().zoom).toBeLessThan(16);
    r.frame(ANIM_MS);
    expect(r.view()).toEqual(B);
    expect(r.pending()).toBe(0);
  });

  it('Then вигляд оновлюється не частіше ніж раз на кадр', () => {
    const r = rig();
    r.a.to(B);
    r.a.to((v) => ({ ...v, zoom: v.zoom * 2 }));
    expect(r.pending()).toBe(1);
    for (let t = 16; t <= ANIM_MS + 16; t += 16) r.frame(t);
    expect(r.renders()).toBe(Math.ceil(ANIM_MS / 16));
  });

  it('When функція-оновлювач; Then рахується від цілі, а не від проміжного кадру (+ + = ×4)', () => {
    const r = rig();
    r.a.to((v) => ({ ...v, zoom: v.zoom * 2 }));
    r.frame(50);
    r.a.to((v) => ({ ...v, zoom: v.zoom * 2 }));
    r.frame(1000);
    expect(r.view().zoom).toBeCloseTo(4, 9);
  });

  it('When новий жест посеред анімації; Then анімацію скасовано, жест рахується від поточного кадру', () => {
    const r = rig();
    r.a.to(B);
    r.frame(ANIM_MS / 2);
    const mid = r.view();
    r.a.jump((v) => ({ ...v, lat: v.lat + 0.1 }));
    expect(r.view().zoom).toBe(mid.zoom);
    expect(r.view().lat).toBeCloseTo(mid.lat + 0.1, 9);
    expect(r.pending()).toBe(0);
    r.frame(ANIM_MS * 2);
    expect(r.view().zoom).toBe(mid.zoom);
  });

  it('When prefers-reduced-motion; Then одразу цільовий вигляд, без кадрів', () => {
    const r = rig(true);
    r.a.to(B);
    expect(r.view()).toEqual(B);
    expect(r.pending()).toBe(0);
  });
});

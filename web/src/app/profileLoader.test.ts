import { describe, expect, it, vi } from 'vitest';
import type { ProfileHour } from '../contracts';
import { hourFile, index } from '../core/profileHours.test-util';
import { ProfileLoader, hourGate } from './profileLoader';

// #165 AC3, AC6: поточна година першою, решта — у фоні (requestIdleCallback), перемикання на ще не завантажену.
function setup() {
  const asked: string[] = [];
  const waiting = new Map<string, (h: ProfileHour) => void>();
  const get = vi.fn((path: string) => {
    asked.push(path);
    return new Promise<ProfileHour>((res) => waiting.set(path, res));
  });
  const answer = async (h: number) => {
    waiting.get(`profile/h${String(h).padStart(2, '0')}.json`)!(hourFile(h, h));
    await new Promise((r) => setTimeout(r, 0));
  };
  const idle: (() => void)[] = [];
  const schedule = (cb: () => void) => { idle.push(cb); };
  const runIdle = async () => { while (idle.length) { idle.shift()!(); await new Promise((r) => setTimeout(r, 0)); } };
  const updates: number[][] = [];
  const loader = new ProfileLoader(index, get, (_p, loaded) => updates.push([...loaded].sort((a, b) => a - b)), schedule);
  return { loader, asked, answer, runIdle, idle, updates, get };
}

describe('ProfileLoader (#165)', () => {
  it('перший екран: лише index + поточна година, без решти', async () => {
    const t = setup();
    const p = t.loader.load(5);
    await Promise.resolve();
    expect(t.asked).toEqual(['profile/h05.json']);
    await t.answer(5);
    expect(await p).toBe(true);
    expect(t.loader.has(5)).toBe(true);
    expect(t.loader.has(6)).toBe(false);
    expect(t.loader.profile.spd[0][5][0]).toBe(5);
  });

  it('фонове довантаження йде через idle-колбек, решта 47 годин — по разу кожна', async () => {
    const t = setup();
    const first = t.loader.load(0);
    await t.answer(0); await first;
    t.loader.background();
    expect(t.asked).toEqual(['profile/h00.json']); // до idle — нічого
    for (let k = 0; k < 60 && t.asked.length < 48; k++) {
      await t.runIdle();
      for (const path of t.asked) {
        const h = Number(path.slice(-7, -5));
        if (!t.loader.has(h)) await t.answer(h);
      }
    }
    await t.runIdle();
    expect(new Set(t.asked).size).toBe(48);
    expect(t.asked).toHaveLength(48);
    expect(t.loader.profile.temp[47][0]).toBe(47);
    expect(t.updates.at(-1)).toHaveLength(48);
  });

  it('перемикання на ще не завантажену годину: вантажиться одразу, не чекаючи idle; повторний виклик — той самий запит', async () => {
    const t = setup();
    const a = t.loader.load(30);
    const b = t.loader.load(30);
    expect(t.get).toHaveBeenCalledTimes(1);
    expect(t.idle).toHaveLength(0);
    await t.answer(30);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(t.updates.at(-1)).toEqual([30]);
  });

  it('помилка мережі: година лишається «немає даних», наступна спроба запитує знову', async () => {
    const t = setup();
    t.get.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    expect(await t.loader.load(2)).toBe(false);
    expect(t.loader.has(2)).toBe(false);
    const again = t.loader.load(2);
    await Promise.resolve();
    await t.answer(2);
    expect(await again).toBe(true);
  });

  it('година з іншого запуску не приймається (не змішуємо прогнози)', async () => {
    const t = setup();
    t.get.mockImplementationOnce(async () => hourFile(4, 4, '2026-01-01T00:00:00Z'));
    expect(await t.loader.load(4)).toBe(false);
    expect(t.loader.has(4)).toBe(false);
    expect(t.loader.profile.spd[0][4]).toBeUndefined();
  });
});

describe('hourGate (#165 AC3): перемикання смуги на ще не завантажену годину', () => {
  type S = { hour: number; altM: number };
  function gate() {
    const t = setup();
    let s: S = { hour: 0, altM: 50 };
    const set = hourGate(() => t.loader, (f: (o: S) => S) => { s = f(s); });
    return { ...t, set, s: () => s };
  }

  it('поки година вантажиться — показується попередня (без мигання), потім нова', async () => {
    const g = gate();
    g.set({ hour: 7 });
    expect(g.s().hour).toBe(0);
    expect(g.asked).toEqual(['profile/h07.json']);
    await g.answer(7);
    expect(g.s().hour).toBe(7);
  });

  it('інші поля стану змінюються одразу', () => {
    const g = gate();
    g.set({ hour: 7, altM: 120 });
    expect(g.s()).toEqual({ hour: 0, altM: 120 });
  });

  it('завантажена година — одразу', async () => {
    const g = gate();
    const p = g.loader.load(3); await g.answer(3); await p;
    g.set({ hour: 3 });
    expect(g.s().hour).toBe(3);
  });

  it('швидке перемикання: застосовується лише остання обрана година', async () => {
    const g = gate();
    g.set({ hour: 7 });
    g.set({ hour: 9 });
    await g.answer(9);
    expect(g.s().hour).toBe(9);
    await g.answer(7);
    expect(g.s().hour).toBe(9);
  });

  it('година не завантажилась (офлайн) — все одно перемикаємо: чесне «немає даних», а не зависла смуга', async () => {
    const g = gate();
    g.get.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    g.set({ hour: 11 });
    await new Promise((r) => setTimeout(r, 0));
    expect(g.s().hour).toBe(11);
  });
});

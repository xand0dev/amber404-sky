import { describe, expect, it } from 'vitest';
import { daySegments, nextPlayHour, nowOffset, scrubHour, sunMarks, windowSpan } from './days';
import type { Level } from '../../core';

// 48 годин від 2026-11-27 10:00 UTC (12:00 за Києвом, UTC+2).
const times = Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2026, 10, 27, 10 + h)).toISOString());

describe('F3-AC4: позначки днів', () => {
  it('ділить смугу на дні за київським часом', () => {
    const s = daySegments(times);
    expect(s.map((x) => x.label)).toEqual(['пт 27', 'сб 28', 'нд 29']);
    expect(s.map((x) => [x.start, x.len])).toEqual([[0, 12], [12, 24], [36, 12]]);
  });
  it('відрізки не накладаються і покривають усі години', () => {
    const s = daySegments(times);
    let at = 0;
    for (const x of s) { expect(x.start).toBe(at); expect(x.len).toBeGreaterThan(0); at += x.len; }
    expect(at).toBe(times.length);
  });
  it('день з 1 години — без підпису, щоб текст не виліз на сусідній день', () => {
    const t = times.slice(11, 14); // 23:00 пт, 00:00 і 01:00 сб
    const s = daySegments(t);
    expect(s.map((x) => [x.len, x.label])).toEqual([[1, ''], [2, 'сб 28']]);
    expect(s[0].title).toBe('пт 27');
  });
  it('порожній ряд — без відрізків', () => expect(daySegments([])).toEqual([]));
});

describe('F3-AC4: ▶ програвання', () => {
  it('наступна година до останньої, потім стоп', () => {
    expect(nextPlayHour(0, 48)).toBe(1);
    expect(nextPlayHour(46, 48)).toBe(47);
    expect(nextPlayHour(47, 48)).toBeNull();
  });
});

// Issue #116: позначки днів англійською.
describe('Given EN (issue #116)', () => {
  it('Then позначки днів — Fri 27, Sat 28, Sun 29', () => {
    expect(daySegments(times, 2, 'en').map((x) => x.label)).toEqual(['Fri 27', 'Sat 28', 'Sun 29']);
  });
});

// Issue #172: день/ніч, «зараз», скраб, вікно — чиста логіка смуги.

describe('Given Київ і смуга від пт 27 12:00 (issue #172 AC1)', () => {
  const m = sunMarks(times, 50.45, 30.52);
  it('Then години між заходом і сходом — ніч', () => {
    // 15:00 пт (h=3) — день, 17:00 пт (h=5) — ніч, 03:00 сб (h=15) — ніч, 10:00 сб (h=22) — день.
    expect([m.night[3], m.night[5], m.night[15], m.night[22]]).toEqual([false, true, true, false]);
  });
  it('Then ☾ на межі заходу і ☀ на межі сходу, за годинами', () => {
    expect(m.edges.map((e) => [e.h, e.kind])).toEqual([[4, 'set'], [20, 'rise'], [28, 'set'], [44, 'rise']]);
    // Захід 28.11 — 15:59 за Києвом (13:59 UTC), ±5 хв.
    const set28 = m.edges[2].at!;
    expect(Math.abs(set28 - Date.UTC(2026, 10, 28, 13, 59))).toBeLessThanOrEqual(5 * 60_000);
  });
  it('Then порожній ряд — без позначок', () => expect(sunMarks([], 50, 30)).toEqual({ night: [], edges: [] }));
});

describe('Given час «зараз» (issue #172 AC2)', () => {
  it('Then зміщення в годинах від початку смуги', () => {
    expect(nowOffset(times, Date.parse(times[0]))).toBe(0);
    expect(nowOffset(times, Date.parse(times[3]) + 30 * 60_000)).toBe(3.5);
  });
  it('Then поза смугою — null', () => {
    expect(nowOffset(times, Date.parse(times[0]) - 1)).toBeNull();
    expect(nowOffset(times, Date.parse(times[47]) + 3600_000)).toBeNull();
    expect(nowOffset([], 0)).toBeNull();
  });
});

describe('Given перетягування по смузі (issue #172 AC3)', () => {
  it('Then година = початкова + зсув / ширина години, у межах смуги', () => {
    expect(scrubHour(5, 0, 48)).toBe(5);
    expect(scrubHour(5, 15, 48)).toBe(5);
    expect(scrubHour(5, 17, 48)).toBe(6);
    expect(scrubHour(5, 32 * 3, 48)).toBe(8);
    expect(scrubHour(5, -32 * 3, 48)).toBe(2);
    expect(scrubHour(5, -32 * 10, 48)).toBe(0);
    expect(scrubHour(45, 32 * 10, 48)).toBe(47);
  });
});

describe('Given рівні годин (issue #172 AC4)', () => {
  const L = (s: string): Level[] => [...s].map((c) => ({ G: 'GO', C: 'CAUTION', N: 'NO-GO' }[c] as Level));
  const tt = (n: number) => times.slice(0, n);
  it('Then вікно — перші ≥ 2 год МОЖНА поспіль від «зараз»', () => {
    expect(windowSpan(L('CGNGGGC'), tt(7), 0)).toEqual({ start: 3, len: 3 });
    expect(windowSpan(L('GGCGG'), tt(5), 1)).toEqual({ start: 3, len: 2 });
  });
  it('Then немає ≥ 2 год поспіль — немає вікна', () => {
    expect(windowSpan(L('GCGCG'), tt(5), 0)).toBeNull();
  });
});

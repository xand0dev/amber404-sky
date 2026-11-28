import { describe, expect, it } from 'vitest';
import { daySegments, nextPlayHour } from './days';

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

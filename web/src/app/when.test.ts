// Issue #87 AC4: вікно польоту людською мовою — «зараз → +48 год».
import { describe, expect, it } from 'vitest';
import { humanWindow } from './when';

const last = '2026-11-30T08:00:00Z';
const now = Date.parse('2026-11-28T09:20:00Z');

describe('Given вікно для польоту; When humanWindow', () => {
  it('Then вікно вже почалось і триває весь прогноз → «зараз → +48 год»', () => {
    const w = { start: '2026-11-28T09:00:00Z', end: '2026-11-30T08:59:00Z', hours: 48 };
    expect(humanWindow(w, last, now, 'uk')).toBe('зараз → +48 год');
    expect(humanWindow(w, last, now, 'en')).toBe('now → +48 h');
  });
  it('Then вікно вже почалось і скінчиться за 5 год → «зараз → +5 год»', () => {
    const w = { start: '2026-11-28T08:00:00Z', end: '2026-11-28T13:59:00Z', hours: 6 };
    expect(humanWindow(w, last, now, 'uk')).toBe('зараз → +5 год');
  });
  it('Then вікно пізніше → день і години, як раніше', () => {
    const w = { start: '2026-11-28T15:00:00Z', end: '2026-11-28T18:59:00Z', hours: 4 };
    expect(humanWindow(w, last, now, 'uk')).toBe('сб 17:00 – 20:59 · 4 год');
  });
  it('Then вікна немає → «Немає вікна ≥ 2 год до …»', () => {
    expect(humanWindow(null, last, now, 'uk')).toMatch(/^Немає вікна ≥ 2 год до /);
  });
});

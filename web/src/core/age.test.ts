import { describe, expect, it } from 'vitest';
import { forecastAge } from './age';

const gen = '2026-11-28T09:00:00Z';
const at = (iso: string) => Date.parse(iso);

describe('F3-AC9 / §7.11: вік прогнозу', () => {
  it('менше години — у хвилинах', () => {
    expect(forecastAge(gen, at('2026-11-28T09:25:00Z'))).toEqual({ hours: 25 / 60, stale: false, text: 'прогноз 25 хв тому' });
  });
  it('години — ціле число вниз', () => {
    const a = forecastAge(gen, at('2026-11-28T12:59:00Z'));
    expect(a.text).toBe('прогноз 3 год тому');
    expect(a.stale).toBe(false);
  });
  it('рівно 6 год — ще не застарів, понад 6 — застарів (§7.9)', () => {
    expect(forecastAge(gen, at('2026-11-28T15:00:00Z')).stale).toBe(false);
    const a = forecastAge(gen, at('2026-11-28T15:01:00Z'));
    expect(a.stale).toBe(true);
    expect(a.text).toBe('прогноз застарів: 6 год тому');
  });
  it('годинник телефона позаду — не відʼємний вік', () => {
    expect(forecastAge(gen, at('2026-11-28T08:00:00Z')).text).toBe('прогноз 0 хв тому');
  });
  it('невідомий час — застарів і про це сказано', () => {
    expect(forecastAge('bad', at(gen))).toEqual({ hours: NaN, stale: true, text: 'час прогнозу невідомий' });
  });
});

import { describe, expect, it } from 'vitest';
import { DATA_FILES, DATA_FRESH_H, dataPlan, type PagesMeta } from './datasync';

const now = Date.parse('2026-11-28T10:30:00Z');
const src = (id: string, status: string) => ({ id, status });
const meta = (over: Partial<PagesMeta> = {}): PagesMeta => ({
  generatedAt: '2026-11-28T09:05:00Z',
  mock: false,
  sources: [src('openmeteo', 'ok'), src('celestrak-galileo', 'ok'), src('noaa-kp', 'ok'), src('era5', 'ok')],
  ...over,
});

describe('#138: деплой не тягне Open-Meteo на кожен мерж', () => {
  it('Given cron (schedule) When деплой Then завжди повний make data (SPEC §5)', () => {
    expect(dataPlan('schedule', meta(), now)).toEqual({ fetch: true, reason: 'розклад (кожні 3 год)' });
  });

  it('Given push і свіжі повні дані на Pages When деплой Then беремо дані з Pages', () => {
    for (const ev of ['push', 'workflow_dispatch']) {
      const p = dataPlan(ev, meta(), now);
      expect(p.fetch).toBe(false);
      expect(p.reason).toBe('дані з Pages: 1 год тому, усі джерела ok');
    }
  });

  it('рівно 3 год — ще свіжі, понад 3 — повний make data', () => {
    expect(dataPlan('push', meta({ generatedAt: '2026-11-28T07:30:00Z' }), now).fetch).toBe(false);
    const p = dataPlan('push', meta({ generatedAt: '2026-11-28T07:29:00Z' }), now);
    expect(p).toEqual({ fetch: true, reason: `дані на Pages старші за ${DATA_FRESH_H} год (3.0 год)` });
  });

  it('Given джерело partial / nodata When push Then повний make data з причиною', () => {
    const p = dataPlan('push', meta({ sources: [src('openmeteo', 'partial'), src('era5', 'nodata')] }), now);
    expect(p).toEqual({ fetch: true, reason: 'на Pages не всі джерела ok: openmeteo=partial, era5=nodata' });
  });

  it('MOCK на Pages, немає джерел, немає meta чи битий час — повний make data', () => {
    expect(dataPlan('push', meta({ mock: true }), now)).toEqual({ fetch: true, reason: 'на Pages MOCK' });
    expect(dataPlan('push', meta({ sources: [] }), now)).toEqual({ fetch: true, reason: 'на Pages немає джерел' });
    expect(dataPlan('push', null, now)).toEqual({ fetch: true, reason: 'немає meta.json на Pages' });
    expect(dataPlan('push', meta({ generatedAt: 'bad' }), now)).toEqual({
      fetch: true,
      reason: 'невідомий час meta.generatedAt на Pages',
    });
  });

  it('час з майбутнього (понад 10 хв) — не віримо, повний make data', () => {
    expect(dataPlan('push', meta({ generatedAt: '2026-11-28T10:35:00Z' }), now).fetch).toBe(false);
    expect(dataPlan('push', meta({ generatedAt: '2026-11-28T11:00:00Z' }), now)).toEqual({
      fetch: true,
      reason: 'meta.generatedAt на Pages у майбутньому',
    });
  });

  it('перелік файлів даних = файли, які пише make data (крім static у репо)', () => {
    expect(DATA_FILES).toEqual(['meta', 'profile', 'galileo', 'kp', 'climate']);
  });
});

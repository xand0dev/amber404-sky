// F3-AC7: штамп знімка (час, висота, дрон, вердикт, джерело, «AMBER Sky») і доставка — share або завантаження.
import { describe, expect, it, vi } from 'vitest';
import { kyivDayHM } from '../../core';
import { deliver, fileName, stampLines } from './snapshot';
import { bundle, state } from './fixture.test-util';

const data = bundle();
data.meta.sources = [
  { id: 'openmeteo', name: 'Open-Meteo', license: 'CC BY 4.0', fetchedAt: '', status: 'ok', note: '' },
  { id: 'noaa-kp', name: 'NOAA SWPC Kp', license: 'public domain', fetchedAt: '', status: 'nodata', note: 'timeout' },
];
const prof = data.profiles[0];
const verdict = { level: 'NO-GO' as const, reasons: ['Обмерзання: −5.6 °C, вологість 97%', 'інша'] };

describe('Given знімок карти; When формуємо штамп', () => {
  const text = stampLines(data, state({ hour: 1, altM: 80, layer: 'gust' }), verdict, prof, 'uk').join('\n');
  it('Then «AMBER Sky» і що це демонстраційна модель', () => {
    expect(text).toContain('AMBER Sky');
    expect(text).toMatch(/не офіційний прогноз/);
  });
  it('Then час прогнозу (обрана година, Київ), висота, дрон, шар', () => {
    expect(text).toContain(kyivDayHM(data.meta.times[1]));
    expect(text).toContain('80 м');
    expect(text).toContain(prof.name);
    expect(text).toContain('Пориви');
  });
  it('Then вердикт у точці з першою причиною', () => {
    expect(text).toContain('50.450, 30.520');
    expect(text).toContain('НЕ МОЖНА — Обмерзання: −5.6 °C, вологість 97%');
    expect(text).not.toContain('інша');
  });
  it('Then джерела; джерело без даних позначене; MOCK видно', () => {
    expect(text).toContain('Open-Meteo');
    expect(text).toMatch(/NOAA SWPC Kp \(немає даних\)/);
    expect(text).toContain('MOCK');
  });
  it('Then англійською', () => {
    const en = stampLines(data, state(), { level: 'GO', reasons: ['Within profile'] }, prof, 'en').join('\n');
    expect(en).toContain('AMBER Sky');
    expect(en).toMatch(/not an official forecast/);
    expect(en).toContain('50 m');
    expect(en).toContain('GO — Within profile');
    expect(en).toMatch(/NOAA SWPC Kp \(no data\)/);
  });
});

describe('Given час прогнозу; Then назва файлу', () => {
  it('amber-sky-YYYY-MM-DD-HHMM.png за київським часом', () => {
    expect(fileName('2026-11-27T19:00:00Z')).toBe('amber-sky-2026-11-27-2100.png');
  });
});

describe('Given PNG; When доставляємо (§7.12)', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  it('телефон із share → меню «Поділитися» з одним PNG-файлом', async () => {
    const share = vi.fn().mockResolvedValue(undefined), download = vi.fn();
    const r = await deliver(blob, 'a.png', { nav: { canShare: () => true, share }, download });
    expect(r).toBe('shared');
    const files = share.mock.calls[0][0].files as File[];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('a.png'); expect(files[0].type).toBe('image/png');
    expect(download).not.toHaveBeenCalled();
  });
  it('користувач закрив меню (AbortError) → нічого не завантажуємо', async () => {
    const download = vi.fn();
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    expect(await deliver(blob, 'a.png', { nav: { canShare: () => true, share }, download })).toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });
  it('share зламався → завантаження', async () => {
    const download = vi.fn();
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    expect(await deliver(blob, 'a.png', { nav: { canShare: () => true, share }, download })).toBe('downloaded');
    expect(download).toHaveBeenCalledWith(blob, 'a.png');
  });
  it('ноутбук без share файлів → завантаження', async () => {
    const download = vi.fn();
    expect(await deliver(blob, 'a.png', { nav: {}, download })).toBe('downloaded');
    expect(await deliver(blob, 'a.png', { nav: { canShare: () => false, share: vi.fn() }, download })).toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(2);
  });
});

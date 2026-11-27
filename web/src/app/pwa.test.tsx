import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import manifestRaw from '../../public/manifest.webmanifest?raw';
import icon192 from '../../public/icons/icon-192.png?inline';
import icon512 from '../../public/icons/icon-512.png?inline';
import { AgeBadge, registerSW } from './pwa';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function pngSize(dataUrl: string): [number, number] {
  const b = atob(dataUrl.split(',')[1]);
  const u32 = (o: number) => ((b.charCodeAt(o) << 24) | (b.charCodeAt(o + 1) << 16) | (b.charCodeAt(o + 2) << 8) | b.charCodeAt(o + 3)) >>> 0;
  expect(b.slice(1, 4)).toBe('PNG');
  return [u32(16), u32(20)];
}

describe('F3-AC9: manifest з іконками 192/512', () => {
  const m = JSON.parse(manifestRaw) as { icons: { src: string; sizes: string; type: string }[]; display: string; start_url: string };
  it('іконки 192 і 512 PNG, файли відповідних розмірів', () => {
    const by = Object.fromEntries(m.icons.map((i) => [i.sizes, i]));
    expect(by['192x192']).toMatchObject({ src: 'icons/icon-192.png', type: 'image/png' });
    expect(by['512x512']).toMatchObject({ src: 'icons/icon-512.png', type: 'image/png' });
    expect(pngSize(icon192)).toEqual([192, 192]);
    expect(pngSize(icon512)).toEqual([512, 512]);
  });
  it('ставиться на головний екран', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
  });
});

describe('F3-AC9: реєстрація service worker', () => {
  it('реєструє ./sw.js відносно base', async () => {
    const register = vi.fn().mockResolvedValue({});
    await registerSW({ serviceWorker: { register } } as unknown as Navigator);
    expect(register).toHaveBeenCalledWith('./sw.js');
  });
  it('браузер без service worker — без помилки', async () => {
    await expect(registerSW({} as Navigator)).resolves.toBeUndefined();
  });
  it('помилка реєстрації не ламає застосунок', async () => {
    const register = vi.fn().mockRejectedValue(new Error('no'));
    await expect(registerSW({ serviceWorker: { register } } as unknown as Navigator)).resolves.toBeUndefined();
  });
});

describe('F3-AC9: плашка віку прогнозу', () => {
  it('показує вік і позначку офлайн, коли немає мережі', () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-28T12:10:00Z') });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<AgeBadge generatedAt="2026-11-28T09:00:00Z" />);
    expect(screen.getByText('прогноз 3 год тому')).toBeTruthy();
    expect(screen.getByText('офлайн · з кешу')).toBeTruthy();
    vi.restoreAllMocks();
  });
  it('оновлює вік з часом і реагує на повернення мережі', () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-28T09:30:00Z') });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<AgeBadge generatedAt="2026-11-28T09:00:00Z" />);
    expect(screen.getByText('прогноз 30 хв тому')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(60 * 60_000); });
    expect(screen.getByText('прогноз 1 год тому')).toBeTruthy();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByText('офлайн · з кешу')).toBeNull();
    vi.restoreAllMocks();
  });
  it('застарілий прогноз — попереджувальна плашка (§7.9)', () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-28T20:00:00Z') });
    render(<AgeBadge generatedAt="2026-11-28T09:00:00Z" />);
    expect(screen.getByText('прогноз застарів: 11 год тому').className).toContain('warn');
  });
});

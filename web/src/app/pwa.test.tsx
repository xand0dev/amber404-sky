import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import manifestRaw from '../../public/manifest.webmanifest?raw';
import icon192 from '../../public/icons/icon-192.png?inline';
import icon512 from '../../public/icons/icon-512.png?inline';
import shotNarrow from '../../public/icons/screen-narrow.png?inline';
import shotWide from '../../public/icons/screen-wide.png?inline';
import { MapFrame } from '../ui/MapFrame';
import { DAY_VARS, NIGHT_VARS } from '../ui/tokens';
import { LANG_KEY, LangProvider } from './lang';
import {
  AgeBadge, BANNER_KEY, Install, OfflineBadge, VISITS_KEY, registerSW, resetInstallForTest, runShortcut, setThemeColor, useReconnect,
} from './pwa';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); resetInstallForTest(); });

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

// ---- Issue #170: встановлення, банер, офлайн, manifest ----

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

/** Подія beforeinstallprompt, як її шле Chrome. */
function bip(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}
// Мова за замовчуванням у jsdom — en (navigator.language); тести — українською, якщо не задано інше.
const ui = () => (localStorage.getItem(LANG_KEY) || localStorage.setItem(LANG_KEY, 'uk'), render(<LangProvider><MapFrame><Install /></MapFrame></LangProvider>));
const installBtn = () => document.querySelector('.mapmore')?.querySelector('button.installbtn') ?? null;

describe('#170 AC1: кнопка «Встановити застосунок» у «⋯»', () => {
  it('без beforeinstallprompt і не на iOS — кнопки немає', () => {
    ui();
    expect(installBtn()).toBeNull();
  });
  it('після beforeinstallprompt — кнопка в меню «⋯», натиск відкриває системний запит', async () => {
    ui();
    const e = bip();
    act(() => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
    const b = installBtn() as HTMLButtonElement;
    expect(b.textContent).toBe('Встановити застосунок');
    await act(async () => { fireEvent.click(b); });
    expect(e.prompt).toHaveBeenCalledOnce();
    // Подію можна використати лише раз — кнопка зникає до наступної.
    expect(installBtn()).toBeNull();
  });
  it('англійською — «Install app»', () => {
    localStorage.setItem(LANG_KEY, 'en');
    ui();
    act(() => { window.dispatchEvent(bip()); });
    expect(installBtn()?.textContent).toBe('Install app');
  });
  it('iOS Safari — кнопка показує підказку «Поділитися → На екран «Додому»» з іконкою', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA_IPHONE);
    ui();
    fireEvent.click(installBtn() as HTMLButtonElement);
    const d = screen.getByRole('dialog', { name: 'Встановити на iPhone / iPad' });
    expect(d.textContent).toContain('Поділитися → На екран «Додому»');
    expect(d.querySelector('svg.shareicon')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Зрозуміло' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('#170 AC2: після встановлення кнопка зникає', () => {
  it('appinstalled — кнопки й банера немає', () => {
    localStorage.setItem(VISITS_KEY, '3');
    ui();
    act(() => { window.dispatchEvent(bip()); });
    expect(installBtn()).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Встановлення' })).toBeTruthy();
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(installBtn()).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Встановлення' })).toBeNull();
  });
  it('відкрито як застосунок (display-mode: standalone) — кнопки немає навіть на iOS', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA_IPHONE);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(display-mode: standalone)', addEventListener() {}, removeEventListener() {} }));
    ui();
    act(() => { window.dispatchEvent(bip()); });
    expect(installBtn()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('#170 AC1: одноразовий банер після 2-го візиту', () => {
  const banner = () => screen.queryByRole('complementary', { name: 'Встановлення' });
  it('перший візит — банера немає, лише кнопка в «⋯»', () => {
    ui();
    act(() => { window.dispatchEvent(bip()); });
    expect(localStorage.getItem(VISITS_KEY)).toBe('1');
    expect(installBtn()).toBeTruthy();
    expect(banner()).toBeNull();
  });
  it('другий візит — банер; «✕» ховає його, і більше він не з’являється', () => {
    localStorage.setItem(VISITS_KEY, '1');
    ui();
    act(() => { window.dispatchEvent(bip()); });
    expect(banner()?.textContent).toContain('Встановити');
    expect(localStorage.getItem(BANNER_KEY)).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }));
    expect(banner()).toBeNull();
    cleanup(); resetInstallForTest();
    ui();
    act(() => { window.dispatchEvent(bip()); });
    expect(banner()).toBeNull();
    expect(installBtn()).toBeTruthy();
  });
  it('«Встановити» в банері відкриває системний запит і ховає банер', async () => {
    localStorage.setItem(VISITS_KEY, '2');
    ui();
    const e = bip();
    act(() => { window.dispatchEvent(e); });
    await act(async () => { fireEvent.click(banner()!.querySelector('button.btn-primary') as HTMLButtonElement); });
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(banner()).toBeNull();
  });
});

describe('#170 AC3: явний індикатор «офлайн» і тихе оновлення', () => {
  it('без мережі — іконка й «офлайн · дані від HH:MM» (київський час прогнозу)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<OfflineBadge generatedAt="2026-11-28T09:05:00Z" />);
    const b = screen.getByRole('status');
    expect(b.textContent).toBe('офлайн · дані від 11:05');
    expect(b.querySelector('svg')).toBeTruthy();
  });
  it('з мережею — індикатора немає; втрата мережі — з’являється, повернення — зникає', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBadge generatedAt="2026-11-28T09:05:00Z" />);
    expect(screen.queryByRole('status')).toBeNull();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(screen.getByRole('status')).toBeTruthy();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('повернення мережі — колбек оновлення даних, без перезавантаження сторінки', () => {
    const refresh = vi.fn();
    function Probe() { useReconnect(refresh); return null; }
    render(<Probe />);
    expect(refresh).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('#170 AC4: manifest — screenshots, shortcuts, theme_color', () => {
  const m = JSON.parse(manifestRaw) as {
    theme_color: string; background_color: string;
    screenshots: { src: string; sizes: string; type: string; form_factor: string }[];
    shortcuts: { name: string; url: string; icons?: { src: string; sizes: string }[] }[];
  };
  it('вузький і широкий знімки, розміри як у файлах', () => {
    const by = Object.fromEntries(m.screenshots.map((x) => [x.form_factor, x]));
    expect(by.narrow).toMatchObject({ src: 'icons/screen-narrow.png', sizes: '400x800', type: 'image/png' });
    expect(by.wide).toMatchObject({ src: 'icons/screen-wide.png', sizes: '1280x800', type: 'image/png' });
    expect(pngSize(shotNarrow)).toEqual([400, 800]);
    expect(pngSize(shotWide)).toEqual([1280, 800]);
  });
  it('ярлики «Де я» і «Можна летіти» відкривають відповідні дії', () => {
    expect(m.shortcuts.map((x) => [x.name, x.url])).toEqual([['Де я', './?do=locate'], ['Можна летіти', './?do=go']]);
  });
  it('theme_color і background_color — денне тло з токенів', () => {
    expect(m.theme_color).toBe(DAY_VARS['--base']);
    expect(m.background_color).toBe(DAY_VARS['--base']);
  });
  it('meta theme-color стежить за темою: вночі — чорне тло нічної палітри', () => {
    setThemeColor(true);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(NIGHT_VARS['--base']);
    setThemeColor(false);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(DAY_VARS['--base']);
  });
});

describe('#170 AC4: дія ярлика після запуску', () => {
  it('«Де я» натискає кнопку позиції, коли вона є', () => {
    const click = vi.fn();
    document.body.innerHTML = '<button class="locbtn"></button>';
    document.querySelector('.locbtn')!.addEventListener('click', click);
    expect(runShortcut('locate', document)).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    document.body.innerHTML = '';
    expect(runShortcut('locate', document)).toBe(false);
  });
});

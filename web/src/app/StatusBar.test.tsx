import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx } from './state';
import { ThemeProvider } from './theme';
import { StatusBar } from './StatusBar';
import { LANG_KEY, LangProvider } from './lang';

vi.mock('./useVerdict', () => ({
  useVerdicts: () => ({ now: { level: 'GO', reasons: ['в межах профілю'] }, window: null, prof: { name: 'Квадрокоптер розвідки', nameEn: 'Recon quadcopter' } }),
}));
afterEach(cleanup);

describe('Given плашка статусу; Then у ній кнопка «Ніч»', () => {
  it('кнопка «Ніч» у header.status', () => {
    const ctx = {
      data: { meta: { mock: true, sources: [], times: ['2026-11-28T09:00:00Z'], generatedAt: new Date().toISOString() } },
      s: { altM: 50 }, set: () => {},
    } as unknown as Ctx;
    const { container } = render(<ThemeProvider><AppCtx.Provider value={ctx}><StatusBar /></AppCtx.Provider></ThemeProvider>);
    const b = screen.getByRole('button', { name: 'Ніч' });
    expect(container.querySelector('header.status')?.contains(b)).toBe(true);
  });
});

// Issue #108: назва дрона на плашці статусу — nameEn в EN, name в UK.
describe('Given назва дрона на плашці статусу', () => {
  const ctx = {
    data: { meta: { mock: true, sources: [], times: ['2026-11-28T09:00:00Z'], generatedAt: new Date().toISOString() } },
    s: { altM: 50 }, set: () => {},
  } as unknown as Ctx;
  const ui = () => render(<LangProvider><ThemeProvider><AppCtx.Provider value={ctx}><StatusBar /></AppCtx.Provider></ThemeProvider></LangProvider>);
  afterEach(() => localStorage.clear());
  it('EN → nameEn', () => {
    localStorage.setItem(LANG_KEY, 'en');
    const { container } = ui();
    expect(container.querySelector('.sub')?.textContent).toContain('Recon quadcopter');
  });
  it('UK → name', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    const { container } = ui();
    expect(container.querySelector('.sub')?.textContent).toContain('Квадрокоптер розвідки');
  });
});

// Issue #87: шапка — велике слово й один рядок «чому»; технічне в «Деталі»; MOCK, вік і статуси джерел — під кнопкою «Джерела».
describe('Given шапка з MOCK і джерелом nodata (issue #87)', () => {
  const ctx = {
    data: { meta: {
      mock: true, times: ['2026-11-28T09:00:00Z'], generatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      sources: [
        { id: 'om', name: 'Open-Meteo', status: 'ok', note: '' },
        { id: 'era5', name: 'Copernicus ERA5', status: 'nodata', note: 'немає ключа' },
      ],
    } },
    s: { altM: 50 }, set: () => {},
  } as unknown as Ctx;
  const ui = () => render(<LangProvider><ThemeProvider><AppCtx.Provider value={ctx}><StatusBar /></AppCtx.Provider></ThemeProvider></LangProvider>);
  afterEach(() => localStorage.clear());

  it('AC1: велике слово й лише перша причина в рядку «чому»', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    const { container } = ui();
    expect(container.querySelector('.word')?.textContent).toBe('МОЖНА');
    expect(container.querySelector('.why')?.textContent).toBe('в межах профілю');
  });

  it('AC2: дрон, висота й вікно — у згорнутому розкривачі «Деталі»', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    const { container } = ui();
    const det = container.querySelector('header.status details') as HTMLDetailsElement;
    expect(det).not.toBeNull();
    expect(det.open).toBe(false);
    expect(det.querySelector('summary')?.textContent).toMatch(/Деталі/);
    expect(det.contains(container.querySelector('.sub'))).toBe(true);
  });

  it('AC3: статуси джерел не на плашці; MOCK видно; кнопка «Джерела» з віком розкриває пояснення', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    const { container } = ui();
    expect(container.textContent).not.toMatch(/nodata/);
    expect(screen.getByText('MOCK', { exact: true })).toBeTruthy();
    const b = screen.getByRole('button', { name: /Джерела/ });
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.textContent).toMatch(/5 хв/);
    expect(b.className).toMatch(/warn/);
    fireEvent.click(b);
    expect(b.getAttribute('aria-expanded')).toBe('true');
    const pop = screen.getByRole('region', { name: 'Джерела' });
    expect(pop.textContent).toMatch(/Copernicus ERA5: немає даних · немає ключа/);
    expect(pop.textContent).toMatch(/Open-Meteo: ок/);
    expect(pop.textContent).toMatch(/MOCK — синтетичні дані/);
    expect(pop.textContent).toMatch(/прогноз 5 хв тому/);
  });

  it('AC5: англійською — Sources / Details', () => {
    localStorage.setItem(LANG_KEY, 'en');
    const { container } = ui();
    expect(container.querySelector('summary')?.textContent).toMatch(/Details/);
    fireEvent.click(screen.getByRole('button', { name: /Sources/ }));
    expect(screen.getByRole('region', { name: 'Sources' }).textContent).toMatch(/Copernicus ERA5: no data · немає ключа/);
  });
});

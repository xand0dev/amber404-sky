// Issue #44: перемикач UK/EN у плашці статусу, вибір у localStorage, за замовчуванням — мова браузера.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx } from './state';
import { ThemeProvider } from './theme';
import { LANG_KEY, LangProvider, ageLabel, useT, windowLabel } from './lang';
import { StatusBar } from './StatusBar';

vi.mock('./useVerdict', async () => {
  const { useT } = await import('./lang');
  return {
    useVerdicts: () => {
      const { t } = useT();
      return { now: { level: 'NO-GO', reasons: [t('r.wind', { v: '12.0', lim: '10.0' })] }, window: null, prof: { name: 'FPV 7"' } };
    },
  };
});

const ctx = {
  data: { meta: { mock: true, sources: [], times: ['2026-11-28T09:00:00Z'], generatedAt: new Date().toISOString() } },
  s: { altM: 50 }, set: () => {},
} as unknown as Ctx;
const ui = () => render(<LangProvider><ThemeProvider><AppCtx.Provider value={ctx}><StatusBar /></AppCtx.Provider></ThemeProvider></LangProvider>);
const navLang = (v: string) => vi.spyOn(navigator, 'language', 'get').mockReturnValue(v);

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Given перемикач UK/EN у плашці статусу', () => {
  it('браузер uk → UK за замовчуванням', () => {
    navLang('uk-UA');
    const { container } = ui();
    expect(container.querySelector('.word')?.textContent).toBe('НЕ МОЖНА');
    expect(screen.getByText('Вітер 12.0 м/с > ліміт 10.0 м/с')).toBeTruthy();
    expect(document.documentElement.lang).toBe('uk');
  });
  it('браузер іншою мовою → EN за замовчуванням', () => {
    navLang('de-DE');
    const { container } = ui();
    expect(container.querySelector('.word')?.textContent).toBe('NO-GO');
    expect(document.documentElement.lang).toBe('en');
  });
  it('When EN; Then рядки плашки й причини англійською, вибір у localStorage; кнопка — у header.status', () => {
    navLang('uk-UA');
    const { container } = ui();
    const en = screen.getByRole('button', { name: 'EN' });
    expect(container.querySelector('header.status')?.contains(en)).toBe(true);
    fireEvent.click(en);
    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(LANG_KEY)).toBe('en');
    expect(container.querySelector('.word')?.textContent).toBe('NO-GO');
    expect(screen.getByText('Wind 12.0 m/s > limit 10.0 m/s')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Night' })).toBeTruthy();
    const sub = container.querySelector('.sub')?.textContent ?? '';
    expect(sub).toMatch(/50 m · No window ≥ 2 h until /);
    expect(container.querySelector('header.status')?.textContent).not.toMatch(/[а-яіїєґ]/i);
    fireEvent.click(screen.getByRole('button', { name: 'UK' }));
    expect(localStorage.getItem(LANG_KEY)).toBe('uk');
    expect(screen.getByRole('button', { name: 'Ніч' })).toBeTruthy();
  });
  it('збережений вибір важливіший за мову браузера', () => {
    navLang('uk-UA');
    localStorage.setItem(LANG_KEY, 'en');
    const { container } = ui();
    expect(container.querySelector('.word')?.textContent).toBe('NO-GO');
  });
  it('localStorage недоступний — мова браузера, перемикання працює', () => {
    navLang('uk');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { container } = ui();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(container.querySelector('.word')?.textContent).toBe('NO-GO');
  });
});

describe('useT() для фіч і підписи часу', () => {
  function Probe() { const { t, lang } = useT(); return <output>{lang}|{t('lv.GO')}</output>; }
  it('без провайдера — українська', () => {
    render(<Probe />);
    expect(screen.getByRole('status').textContent).toBe('uk|МОЖНА');
  });
  it('вікно й вік прогнозу обома мовами', () => {
    const w = { start: '2026-11-28T07:00:00Z', end: '2026-11-28T09:59:00Z', hours: 3 };
    expect(windowLabel(w, '2026-11-29T10:00:00Z', 'uk')).toBe('сб 09:00 – 11:59 · 3 год');
    expect(windowLabel(w, '2026-11-29T10:00:00Z', 'en')).toBe('Sat 09:00 – 11:59 · 3 h');
    expect(windowLabel(null, '2026-11-29T10:00:00Z', 'en')).toBe('No window ≥ 2 h until Sun 12:00');
    const gen = '2026-11-28T08:00:00Z';
    expect(ageLabel(gen, Date.parse('2026-11-28T08:25:00Z'), 'en')).toEqual({ stale: false, text: 'forecast 25 min ago' });
    expect(ageLabel(gen, Date.parse('2026-11-28T15:01:00Z'), 'en')).toEqual({ stale: true, text: 'forecast stale: 7 h ago' });
    expect(ageLabel(gen, Date.parse('2026-11-28T15:01:00Z'), 'uk')).toEqual({ stale: true, text: 'прогноз застарів: 7 год тому' });
    expect(ageLabel('bad', 0, 'en')).toEqual({ stale: true, text: 'forecast time unknown' });
  });
});

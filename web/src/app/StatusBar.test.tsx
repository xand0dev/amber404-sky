import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

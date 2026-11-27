import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx } from './state';
import { ThemeProvider } from './theme';
import { StatusBar } from './StatusBar';

vi.mock('./useVerdict', () => ({
  useVerdicts: () => ({ now: { level: 'GO', reasons: ['в межах профілю'] }, window: null, prof: { name: 'FPV 7"' } }),
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

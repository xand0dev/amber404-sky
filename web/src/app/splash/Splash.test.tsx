// Issue #166 AC1: заставка поки вантажаться дані — лише при повільних даних, зникає fade.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Splash } from './Splash';
import { LANG_KEY, LangProvider } from '../lang';

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const view = (ready: boolean) => render(<LangProvider><Splash ready={ready} /></LangProvider>);
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('Given дані ще вантажаться', () => {
  it('When минуло < 300 мс Then заставки ще немає (без мигання)', () => {
    view(false);
    tick(299);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('When минуло 300 мс Then логотип AMBER Sky, вітер і «Завантажуємо прогноз…»', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    const { container } = view(false);
    tick(300);
    const st = screen.getByRole('status');
    expect(st.textContent).toContain('AMBER Sky');
    expect(st.textContent).toContain('Завантажуємо прогноз…');
    expect(container.querySelectorAll('.sp-wind path').length).toBeGreaterThanOrEqual(3);
  });
  it('англійською — через useT', () => {
    localStorage.setItem(LANG_KEY, 'en');
    view(false);
    tick(300);
    expect(screen.getByRole('status').textContent).toContain('Loading forecast…');
  });
});

describe('Given дані прийшли', () => {
  it('When < 300 мс Then заставку так і не показано', () => {
    const r = view(false);
    tick(100);
    r.rerender(<LangProvider><Splash ready /></LangProvider>);
    tick(1000);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('When заставка вже показана Then плавний fade, потім зникає', () => {
    const r = view(false);
    tick(400);
    r.rerender(<LangProvider><Splash ready /></LangProvider>);
    expect(screen.getByRole('status').classList).toContain('fade');
    tick(400);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Вимоги до вигляду', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/splash/splash.css'), 'utf8');
  const src = readFileSync(join(process.cwd(), 'src/app/splash/Splash.tsx'), 'utf8');
  it('CSS + SVG заставки ≤ 10 КБ', () => expect(css.length + src.length).toBeLessThanOrEqual(10 * 1024));
  it('prefers-reduced-motion — без анімацій і переходів', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    const rm = css.slice(css.search(/prefers-reduced-motion/));
    expect(rm).toMatch(/animation:\s*none/);
    expect(rm).toMatch(/transition:\s*none/);
  });
});

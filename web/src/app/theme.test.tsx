import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NIGHT_CSS as css, NIGHT_VARS } from './night';
import { NIGHT_KEY, NightToggle, ThemeProvider, readMapColors, useTheme } from './theme';

function Probe() {
  const { night, colors } = useTheme();
  return <output data-testid="probe">{night ? 'night' : 'day'}|{colors.base}</output>;
}
const ui = () => render(<ThemeProvider><NightToggle /><Probe /></ThemeProvider>);

beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.theme; });
afterEach(() => { cleanup(); document.documentElement.removeAttribute('style'); });

describe('Given кнопка «Ніч»; When увімкнено; Then червоно-чорна палітра і вибір у localStorage', () => {
  it('за замовчуванням день, кнопка не натиснута', () => {
    ui();
    const b = screen.getByRole('button', { name: 'Ніч' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.dataset.theme).toBe('day');
  });
  it('клік вмикає ніч: data-theme, aria-pressed, localStorage; повторний — вимикає', () => {
    ui();
    const b = screen.getByRole('button', { name: 'Ніч' });
    fireEvent.click(b);
    expect(document.documentElement.dataset.theme).toBe('night');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(NIGHT_KEY)).toBe('1');
    fireEvent.click(b);
    expect(document.documentElement.dataset.theme).toBe('day');
    expect(localStorage.getItem(NIGHT_KEY)).toBe('0');
  });
  it('після перезавантаження вибір відновлюється', () => {
    localStorage.setItem(NIGHT_KEY, '1');
    ui();
    expect(document.documentElement.dataset.theme).toBe('night');
    expect(screen.getByTestId('probe').textContent).toMatch(/^night/);
  });
  it('localStorage недоступний — працює без збереження', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Ніч' }));
    expect(document.documentElement.dataset.theme).toBe('night');
    get.mockRestore(); set.mockRestore();
  });
});

describe('Карта читає кольори з CSS-змінних або з контексту', () => {
  it('readMapColors бере змінні з :root', () => {
    document.documentElement.style.setProperty('--base', '#000');
    document.documentElement.style.setProperty('--ink', '#d23');
    expect(readMapColors()).toMatchObject({ base: '#000', ink: '#d23' });
  });
  it('useTheme().colors оновлюються після перемикання', () => {
    ui();
    expect(screen.getByTestId('probe').textContent).toBe('day|#1c2117');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Ніч' })); });
    expect(screen.getByTestId('probe').textContent).toBe('night|#000000');
  });
});

describe('CSS: нічна палітра, приглушена плашка, кнопка ≥ 44 px і видимий фокус', () => {
  const night = css.match(/:root\[data-theme="night"\]\{([^}]*)\}/)?.[1] ?? '';
  it('нічний блок перевизначає всі змінні палітри', () => {
    for (const v of ['--base', '--panel', '--rule', '--ink', '--dim', '--go', '--cau', '--no']) expect(night).toContain(`${v}:${NIGHT_VARS[v]}`);
  });
  it('з <style> провайдера змінні реально застосовуються до :root у нічному режимі', () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Ніч' }));
    expect(readMapColors()).toMatchObject({ base: '#000000', ink: '#c8372a' });
    expect(screen.getByTestId('probe').textContent).toBe('night|#000000');
  });
  it('усі кольори нічної палітри — червоні або чорні (G і B ≤ R/2)', () => {
    const hexes = [...night.matchAll(/#([0-9a-f]{6})/gi)].map((m) => m[1]);
    expect(hexes.length).toBeGreaterThanOrEqual(8);
    for (const h of hexes) {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      expect(g <= r / 2 && b <= r / 2, `#${h}`).toBe(true);
    }
  });
  it('яскравість плашки вердикту знижена', () => {
    const f = css.match(/\[data-theme="night"\] \.status\{[^}]*filter:brightness\((0?\.\d+)\)/)?.[1];
    expect(Number(f)).toBeLessThan(1);
  });
  it('кнопка ≥ 44 px і видимий фокус', () => {
    const btn = css.match(/\.nightbtn\{([^}]*)\}/)?.[1] ?? '';
    expect(btn).toMatch(/min-height:44px/);
    expect(btn).toMatch(/min-width:44px/);
    expect(css).toMatch(/\.nightbtn:focus-visible\{[^}]*outline:3px solid/);
  });
});

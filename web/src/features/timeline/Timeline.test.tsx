import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TimelineView } from './Timeline';
import type { Level } from '../../core';
import { LANG_KEY, LangProvider } from '../../app/lang';

const times = Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2026, 10, 27, 10 + h)).toISOString());
const order: Level[] = ['GO', 'CAUTION', 'NO-GO', 'NO-DATA'];
const levels = times.map((_, h) => order[h % 4]);

const NOW = Date.parse(times[0]) + 15 * 60_000;
function Harness({ start = 0, lv = levels }: { start?: number; lv?: Level[] }) {
  const [hour, setHour] = useState(start);
  return <TimelineView times={times} levels={lv} hour={hour} onPick={setHour} lat={50.45} lon={30.52} now={NOW} />;
}
const hourButtons = () => screen.getAllByRole('button').filter((b) => b.dataset.hour != null);
const selected = () => hourButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('F3-AC4: смуга 48 год', () => {
  it('колір кожної години = вердикт у точці (клас рівня → токен --go/--cau/--no, #88)', () => {
    render(<Harness />);
    const bs = hourButtons();
    expect(bs).toHaveLength(48);
    bs.forEach((b, h) => {
      expect(b.classList.contains(`lv-${levels[h]}`)).toBe(true);
      expect(b.style.background).toBe('');
      expect(b.getAttribute('aria-label')).toContain(levels[h]);
    });
  });
  it('клік — обрана година підсвічена, лише одна', () => {
    render(<Harness />);
    fireEvent.click(hourButtons()[5]);
    expect(selected()).toHaveLength(1);
    expect(selected()[0].dataset.hour).toBe('5');
    expect(selected()[0].className).toContain('on');
  });
  it('▶ — година йде вперед і підсвічування рухається; ⏸ — стоп', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Програти/ }));
    for (let i = 0; i < 3; i++) act(() => { vi.advanceTimersByTime(1000); });
    const h = Number(selected()[0].dataset.hour);
    expect(h).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: /Пауза/ }));
    for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(1000); });
    expect(Number(selected()[0].dataset.hour)).toBe(h);
  });
  it('▶ зупиняється на останній годині; з останньої — починає з 0', () => {
    vi.useFakeTimers();
    render(<Harness start={46} />);
    fireEvent.click(screen.getByRole('button', { name: /Програти/ }));
    for (let i = 0; i < 10; i++) act(() => { vi.advanceTimersByTime(1000); });
    expect(selected()[0].dataset.hour).toBe('47');
    const play = screen.getByRole('button', { name: /Програти/ });
    fireEvent.click(play);
    expect(selected()[0].dataset.hour).toBe('0');
  });
  it('позначки днів — окремі відрізки по ширині своїх годин', () => {
    render(<Harness />);
    const marks = screen.getAllByTestId('day-mark');
    expect(marks.map((m) => m.textContent)).toEqual(['пт 27', 'сб 28', 'нд 29']);
    expect(marks.map((m) => m.style.flexGrow)).toEqual(['12', '24', '12']);
  });
});

// Issue #116: EN — доступні імена й позначки днів англійською, без кирилиці.
describe('Given EN (issue #116)', () => {
  afterEach(() => localStorage.clear());
  it('Then «Play 48 h», «Forecast hour», «Fri 27»; ні title, ні aria-label без кирилиці', () => {
    localStorage.setItem(LANG_KEY, 'en');
    const { container } = render(<LangProvider><Harness /></LangProvider>);
    expect(screen.getByRole('button', { name: 'Play 48 h' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Forecast hour' })).toBeTruthy();
    expect(screen.getAllByTestId('day-mark')[0].textContent).toBe('Fri 27');
    fireEvent.click(screen.getByRole('button', { name: 'Play 48 h' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    const attrs = [...container.querySelectorAll('[aria-label],[title]')].map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`);
    expect(attrs.join('\n') + container.textContent).not.toMatch(/[Ѐ-ӿ]/);
  });
});

// Issue #172: день/ніч, «зараз», скраб, вікно.
describe('Given смуга для Києва від пт 27 12:00 (issue #172)', () => {
  it('AC1: нічні години затемнені (клас nt), ☾ на заході, ☀ на сході', () => {
    render(<Harness />);
    const bs = hourButtons();
    expect(bs[3].classList.contains('nt')).toBe(false);
    expect(bs[5].classList.contains('nt')).toBe(true);
    expect(bs[15].classList.contains('nt')).toBe(true);
    expect(bs[22].classList.contains('nt')).toBe(false);
    const edges = screen.getAllByTestId('sun-edge');
    expect(edges.map((e) => e.textContent)).toEqual(['☾', '☀', '☾', '☀']);
    expect(edges[0].style.left).toBe(`${4 * 32}px`);
    expect(edges[0].getAttribute('title')).toMatch(/^Захід сонця \d\d:\d\d$/);
    expect(edges[1].getAttribute('title')).toMatch(/^Схід сонця \d\d:\d\d$/);
  });
  it('AC2: вертикальна лінія «зараз» на своїй хвилині; межа доби — підпис дня й риска', () => {
    render(<Harness />);
    const now = screen.getByTestId('now-line');
    expect(now.style.left).toBe(`${0.25 * 32}px`);
    expect(now.getAttribute('title')).toBe('зараз');
    expect(hourButtons()[12].classList.contains('d0')).toBe(true);
    expect(hourButtons()[11].classList.contains('d0')).toBe(false);
    expect(screen.getAllByTestId('day-mark')[1].textContent).toBe('сб 28');
  });
  it('AC3: перетягування пальцем/мишею — година йде за вказівником, після відпускання — стоп', () => {
    render(<Harness />);
    const nav = screen.getByRole('navigation');
    fireEvent.pointerDown(hourButtons()[5], { clientX: 100, pointerId: 1 });
    expect(selected()[0].dataset.hour).toBe('5');
    fireEvent.pointerMove(nav, { clientX: 100 + 32 * 2, pointerId: 1 });
    expect(selected()[0].dataset.hour).toBe('7');
    fireEvent.pointerMove(nav, { clientX: 100 - 32 * 3, pointerId: 1 });
    expect(selected()[0].dataset.hour).toBe('2');
    fireEvent.pointerUp(nav, { clientX: 100 - 32 * 3, pointerId: 1 });
    fireEvent.pointerMove(nav, { clientX: 100 + 32 * 10, pointerId: 1 });
    expect(selected()[0].dataset.hour).toBe('2');
  });
  it('AC3: клавіатура ←/→ — година назад/вперед у межах смуги', () => {
    render(<Harness start={1} />);
    const nav = screen.getByRole('navigation');
    fireEvent.keyDown(nav, { key: 'ArrowRight' });
    expect(selected()[0].dataset.hour).toBe('2');
    fireEvent.keyDown(nav, { key: 'ArrowLeft' });
    fireEvent.keyDown(nav, { key: 'ArrowLeft' });
    fireEvent.keyDown(nav, { key: 'ArrowLeft' });
    expect(selected()[0].dataset.hour).toBe('0');
  });
  it('AC4: найближче вікно (перші ≥ 2 год МОЖНА поспіль) — рамка й підпис «вікно»', () => {
    const lv = times.map((_, h): Level => (h === 1 || (h >= 6 && h <= 8) || h >= 20 ? 'GO' : 'CAUTION'));
    render(<Harness lv={lv} />);
    const w = screen.getByTestId('win');
    expect(w.style.left).toBe(`${6 * 32}px`);
    expect(w.style.width).toBe(`${3 * 32}px`);
    expect(w.textContent).toBe('вікно');
  });
  it('AC4: вікна немає — немає й рамки', () => {
    render(<Harness lv={times.map((): Level => 'CAUTION')} />);
    expect(screen.queryByTestId('win')).toBeNull();
  });
  it('Given EN — «now», «window», «Sunset»/«Sunrise»', () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<LangProvider><Harness lv={times.map((): Level => 'GO')} /></LangProvider>);
    expect(screen.getByTestId('now-line').getAttribute('title')).toBe('now');
    expect(screen.getByTestId('win').textContent).toBe('window');
    expect(screen.getAllByTestId('sun-edge')[0].getAttribute('title')).toMatch(/^Sunset /);
    localStorage.clear();
  });
});

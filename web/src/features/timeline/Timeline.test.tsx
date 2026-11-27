import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TimelineView } from './Timeline';
import { LEVEL_COLOR } from '../layers/colors';
import type { Level } from '../../core';
import { LANG_KEY, LangProvider } from '../../app/lang';

const times = Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2026, 10, 27, 10 + h)).toISOString());
const order: Level[] = ['GO', 'CAUTION', 'NO-GO', 'NO-DATA'];
const levels = times.map((_, h) => order[h % 4]);

function Harness({ start = 0 }: { start?: number }) {
  const [hour, setHour] = useState(start);
  return <TimelineView times={times} levels={levels} hour={hour} onPick={setHour} />;
}
const hourButtons = () => screen.getAllByRole('button').filter((b) => b.dataset.hour != null);
const selected = () => hourButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('F3-AC4: смуга 48 год', () => {
  it('колір кожної години = вердикт у точці', () => {
    render(<Harness />);
    const bs = hourButtons();
    expect(bs).toHaveLength(48);
    bs.forEach((b, h) => {
      const ref = document.createElement('i');
      ref.style.background = LEVEL_COLOR[levels[h]];
      expect(b.style.background).toBe(ref.style.background);
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

// Issue #166 AC2–AC4: онбординг першого відкриття — 3 картки, «Пропустити», Esc, «Почати», повтор з «⋯».
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Onboarding } from './Onboarding';
import { LANG_KEY, LangProvider } from '../lang';
import { TOUR_KEY } from '../../core/tour';
import { MapFrame } from '../../ui/MapFrame';

beforeEach(() => { localStorage.clear(); localStorage.setItem(LANG_KEY, 'uk'); });
afterEach(cleanup);

const view = () => render(
  <LangProvider>
    <MapFrame><canvas className="map" /><Onboarding /></MapFrame>
    <section className="panel"><div className="row"><select /><input type="range" /></div></section>
  </LangProvider>,
);
const dialog = () => screen.queryByRole('dialog');

describe('Given перший візит', () => {
  it('Then онбординг: діалог aria-modal з першою карткою і фокусом усередині', () => {
    view();
    const d = dialog()!;
    expect(d).not.toBeNull();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.textContent).toContain('Вітер по висотах над усією Україною');
    expect(d.textContent).toContain('1 з 3');
    expect(d.contains(document.activeElement)).toBe(true);
  });
  it('When «Далі» двічі Then картки 2 і 3, на останній — «Почати»', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Далі' }));
    expect(dialog()!.textContent).toContain('Обери дрон і висоту — карта покаже МОЖНА / ОБЕРЕЖНО / НЕ МОЖНА');
    fireEvent.click(screen.getByRole('button', { name: 'Далі' }));
    expect(dialog()!.textContent).toContain('Тапни будь-яку точку або ⌖ — вердикт, причини й вікно польоту');
    expect(screen.queryByRole('button', { name: 'Далі' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Почати' }));
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBe('1');
  });
  it('When «Пропустити» Then закрито й прапорець стоїть', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Пропустити' }));
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBe('1');
  });
  it('When Esc Then закрито й прапорець стоїть', () => {
    view();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBe('1');
  });
  it('AC3: Tab з останньої кнопки повертає на першу, Shift+Tab — навпаки (фокус-пастка)', () => {
    view();
    const btns = [...dialog()!.querySelectorAll('button')];
    btns[btns.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(btns[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(btns[btns.length - 1]);
  });
  it('Підсвітка відповідного місця: карта, потім дрон і висота', () => {
    view();
    expect(document.querySelector('.mapwrap')!.classList).toContain('tour-on');
    fireEvent.click(screen.getByRole('button', { name: 'Далі' }));
    expect(document.querySelector('.panel .row')!.classList).toContain('tour-on');
    expect(document.querySelector('.mapwrap')!.classList).not.toContain('tour-on');
  });
});

describe('Given онбординг уже пройдено', () => {
  it('Then при відкритті не з\'являється', () => {
    localStorage.setItem(TOUR_KEY, '1');
    view();
    expect(dialog()).toBeNull();
  });
  it('When «⋯» → «Як це працює» Then знову з першої картки', () => {
    localStorage.setItem(TOUR_KEY, '1');
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Ще інструменти' }));
    fireEvent.click(screen.getByRole('button', { name: 'Як це працює' }));
    expect(dialog()!.textContent).toContain('1 з 3');
  });
  it('англійською — через useT', () => {
    localStorage.setItem(LANG_KEY, 'en');
    view();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(dialog()!.textContent).toContain('Wind by altitude over all of Ukraine');
  });
});

// F3-AC1: легенда зі шкалою §7.6 — колір + текст.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx, type LayerId } from '../../app/state';
import { Legend } from './Legend';
import { bundle, state } from '../map/fixture.test-util';

afterEach(cleanup);
const show = (layer: LayerId) => {
  const ctx = { data: bundle(), s: state({ layer }), set: () => {} } as Ctx;
  return render(<AppCtx.Provider value={ctx}><Legend /></AppCtx.Provider>);
};

describe('Given обраний шар; When відкрито карту; Then легенда зі шкалою', () => {
  it.each([
    ['wind', 'Вітер', '0', '26 м/с'], ['gust', 'Пориви', '0', '26 м/с'], ['cloud', 'Хмари', '0', '1500 м'],
    ['temp', 'Темп.', '−20', '30 °C'], ['vis', 'Видимість', '0', '40 км'],
  ] as [LayerId, string, string, string][])('%s: назва, мінімум і максимум з одиницею', (layer, name, lo, hi) => {
    show(layer);
    const lg = screen.getByRole('figure', { name: /Легенда/ });
    expect(lg.textContent).toContain(name);
    expect(screen.getByText(lo, { selector: '.lg-lo' })).toBeTruthy();
    expect(screen.getByText(hi, { selector: '.lg-hi' })).toBeTruthy();
  });
  it('вітер: підписано висоту, бо поле — на обраній висоті', () => {
    show('wind');
    expect(screen.getByRole('figure', { name: /Легенда/ }).textContent).toContain('50 м');
  });
  it('«Можна летіти»: кожен рівень — колір і текст', () => {
    show('go');
    for (const t of ['МОЖНА', 'ОБЕРЕЖНО', 'НЕ МОЖНА', 'НЕМАЄ ДАНИХ']) expect(screen.getByText(t)).toBeTruthy();
  });
  it('«Обмерзання»: так / ні', () => {
    show('icing');
    expect(screen.getByText('так')).toBeTruthy();
    expect(screen.getByText('ні')).toBeTruthy();
  });
});

// Issue #85 AC3: смужка легенди внизу карти (≤ 32 px + відступ 8 px) не накриває підписів міст на телефоні.
import { makeProjection, FULL_VIEW } from '../../core';
import cities from '../../../public/data/static/cities.json';

describe('Given телефон 375×812 і 400×800, вся Україна; When легенда внизу карти; Then підписи міст вище неї', () => {
  // Висота карти = 55% першого екрана (AC1); ширина = ширина екрана.
  it.each([[375, 812], [400, 800]])('%i×%i', (W, VH) => {
    const H = Math.round(VH * 0.55);
    const { project } = makeProjection(W, H, FULL_VIEW);
    const stripTop = H - 8 - 32;
    // Підпис міста: базова лінія y − 4, шрифт 12 px; квадратик міста — до y + 2.
    const low = cities.map((c) => ({ name: c.name, bottom: project(c.lat, c.lon)[1] + 2 })).filter((c) => c.bottom >= stripTop);
    expect(low).toEqual([]);
  });
});

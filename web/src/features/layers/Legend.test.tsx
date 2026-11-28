// F3-AC1: легенда зі шкалою §7.6 — колір + текст.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx, type LayerId } from '../../app/state';
import { Legend } from './Legend';
import { LayerPicker } from './LayerPicker';
import { LANG_KEY, LangProvider } from '../../app/lang';
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

describe('Issue #119: EN', () => {
  it('шари й легенда англійською, без кирилиці', () => {
    localStorage.setItem(LANG_KEY, 'en');
    try {
      const { container } = render(<LangProvider><AppCtx.Provider value={{ data: bundle(), s: state({ layer: 'wind', altM: 50 }), set: () => {} } as Ctx}><LayerPicker /><Legend /></AppCtx.Provider></LangProvider>);
      expect(screen.getByRole('radiogroup', { name: 'Map layer' })).toBeTruthy();
      expect(screen.getByRole('figure', { name: 'Legend: Wind · 50 m' })).toBeTruthy();
      expect(container.textContent).toContain('26 m/s');
      expect(container.textContent).not.toMatch(/[Ѐ-ӿ]/);
    } finally { localStorage.removeItem(LANG_KEY); }
  });
});

// Issue #140: якщо частина сітки без даних — у легенді пункт «▨ немає даних».
describe('Given частина сітки без даних (#140)', () => {
  const southless = () => {
    const d = bundle(); const nc = d.meta.grid.nc;
    const cut = (row: (number | null)[]) => row.map((v, i) => (Math.floor(i / nc) >= 12 ? null : v));
    return { ...d, profile: { ...d.profile, spd: d.profile.spd.map((l) => l.map(cut)), dir: d.profile.dir.map((l) => l.map(cut)) } };
  };
  it('вітер: пункт «немає даних» є; з повними даними — немає', () => {
    render(<AppCtx.Provider value={{ data: southless(), s: state(), set: () => {} } as unknown as Ctx}><Legend /></AppCtx.Provider>);
    expect(screen.getByText('немає даних', { selector: '.lg-nodata' })).toBeTruthy();
    cleanup();
    show('wind');
    expect(document.querySelector('.lg-nodata')).toBeNull();
  });
});

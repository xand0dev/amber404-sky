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

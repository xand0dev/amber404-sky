import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DroneProfile } from '../../contracts';
import { WindProfileView } from './WindProfile';
import { profileAlts, windProfile } from './windProfile';
import { fixture, LEVELS } from './fixture.test-util';

afterEach(cleanup);

const FPV: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
const WING: DroneProfile = { ...FPV, id: 'wingE', kind: 'wing', bandM: [150, 1000], windMs: 15 };
// Рівень l: 10, 50, 100, …, 500 (l = 0…10), 600…1000 (l = 11…15).
const lvl = (altM: number) => LEVELS.indexOf(altM);

describe('T3 §7.5a: дані профілю', () => {
  it('висоти до 500 м для FPV; до 1000 м для крила (робоча висота вище)', () => {
    expect(profileAlts(LEVELS, FPV)).toEqual([10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
    expect(profileAlts(LEVELS, WING)).toEqual(LEVELS);
  });
  it('сила й напрям на кожній висоті з core (weatherAt)', () => {
    const d = windProfile(fixture(), 50.45, 30.5, 0, FPV);
    expect(d.levels[0]).toMatchObject({ altM: 10 });
    expect(d.levels[0].ws).toBeCloseTo(2, 5);
    expect(d.levels[lvl(400)].ws).toBeCloseTo(10, 5);
    expect(d.levels[0].dir).toBeCloseTo(330, 5);
    expect(d.topM).toBe(500);
  });
  it('зсув ≥ 45° між шарами по 50 м при вітрі > 2 м/с — підпис на висоті верхнього шару', () => {
    // До 200 м — з 330°, від 250 м — з 30°: різниця 60°.
    const d = windProfile(fixture({ dirAt: (l) => (LEVELS[l] <= 200 ? 330 : 30) }), 50.45, 30.5, 0, FPV);
    expect(d.shear).toEqual([{ altM: 250, deg: 60 }]);
  });
  it('44° — не зсув; слабкий вітер — не зсув', () => {
    expect(windProfile(fixture({ dirAt: (l) => (LEVELS[l] <= 200 ? 0 : 44) }), 50.45, 30.5, 0, FPV).shear).toEqual([]);
    expect(windProfile(fixture({ spd: () => 1.5, dirAt: (l) => (LEVELS[l] <= 200 ? 0 : 90) }), 50.45, 30.5, 0, FPV).shear).toEqual([]);
  });
  it('шар без даних не «зшиває» сусідів у хибний зсув', () => {
    // 100 м без даних; 50 м з 0°, 150 м з 90° — не сусіди, зсуву немає.
    const d = windProfile(fixture({ spd: (l) => (LEVELS[l] === 100 ? null : 5), dirAt: (l) => (LEVELS[l] <= 50 ? 0 : 90) }), 50.45, 30.5, 0, FPV);
    expect(d.shear).toEqual([]);
    expect(d.levels[lvl(100)].ws).toBeNull();
  });
  it('межа хмар — з core (t і rh біля землі)', () => {
    const d = windProfile(fixture({ tempC: 10, rh: 90 }), 50.45, 30.5, 0, FPV);
    expect(d.cb).toBeGreaterThan(150);
    expect(d.cb).toBeLessThan(200);
  });
});

function view(extra: Partial<Parameters<typeof WindProfileView>[0]> = {}) {
  const data = windProfile(fixture({ dirAt: (l) => (LEVELS[l] <= 200 ? 330 : 30) }), 50.45, 30.5, 0, FPV);
  return render(<WindProfileView data={data} prof={FPV} altM={50} hourLabel="сб 10:00" lang="uk" {...extra} />);
}

describe('T3 §7.5a: графік на екрані', () => {
  it('лінія сили вітру й стрілка напряму на кожній висоті', () => {
    view();
    expect(screen.getByTestId('wp-line').getAttribute('points')?.split(' ')).toHaveLength(11);
    expect(screen.getAllByTestId('wp-arrow')).toHaveLength(11);
    expect(screen.getAllByTestId('wp-arrow')[0].getAttribute('transform')).toContain('rotate(150');
  });
  it('робоча висота дрона, ліміт вітру, хмари, обрана висота', () => {
    view();
    expect(screen.getByTestId('wp-band')).toBeTruthy();
    expect(screen.getByTestId('wp-limit')).toBeTruthy();
    expect(screen.getByText('ліміт 10')).toBeTruthy();
    expect(screen.getByTestId('wp-cloud')).toBeTruthy();
    expect(screen.getByTestId('wp-alt')).toBeTruthy();
  });
  it('підпис «зсув N°» і текстовий підсумок', () => {
    view();
    expect(screen.getByTestId('wp-shear').textContent).toBe('зсув 60°');
    expect(screen.getByTestId('wp-summary').textContent).toMatch(/^Зсув вітру: 250 м — 60° · хмари від \d+ м$/);
    expect(screen.getByRole('img', { name: /Профіль вітру в точці, година сб 10:00: від 2.0 до 12.0 м\/с, ліміт дрона 10 м\/с/ })).toBeTruthy();
  });
  it('без зсуву — «немає»', () => {
    const data = windProfile(fixture(), 50.45, 30.5, 0, FPV);
    render(<WindProfileView data={data} prof={FPV} altM={50} hourLabel="x" lang="uk" />);
    expect(screen.queryByTestId('wp-shear')).toBeNull();
    expect(screen.getByTestId('wp-summary').textContent).toMatch(/^Зсуву напряму ≥ 45° між шарами по 50 м немає/);
  });
  it('немає даних — без лінії, без падіння', () => {
    const data = windProfile(fixture({ spd: () => null }), 50.45, 30.5, 0, FPV);
    render(<WindProfileView data={data} prof={FPV} altM={50} hourLabel="x" lang="uk" />);
    expect(screen.queryByTestId('wp-line')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('від — до —');
  });
  it('англійською — без кирилиці', () => {
    view({ lang: 'en', hourLabel: 'Sat 10:00' });
    expect(screen.getByTestId('wp-shear').textContent).toBe('shear 60°');
    expect(screen.getByRole('region', { name: 'Wind profile' }).textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
});

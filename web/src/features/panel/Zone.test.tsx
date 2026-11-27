import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DroneProfile } from '../../contracts';
import { ZoneView } from './Zone';
import { dayHM } from './place';
import { energyInput, energyWhy, ringsKm, stepFor, zoneFor, type AnyProfile } from './zoneLogic';
import { effectiveEndurance, type EnergyInput } from '../../core';

afterEach(cleanup);

const P: DroneProfile = {
  id: 'recon', name: 'Квадрокоптер розвідки', use: '', massKg: 1, energy: 'battery', enduranceMin: 30, cruiseMs: 15, windMs: 12, gustMs: 15,
  tMinC: -10, precipMmH: 0.2, bandM: [50, 300], defaultAltM: 120, kind: 'multirotor', source: 'assumption',
};
const calm = () => [0, 0] as [number, number];
// Вітер з півночі 5 м/с: дме на південь, v = −5.
const north5 = () => [0, -5] as [number, number];
const at = (z: ReturnType<typeof zoneFor>, brg: number) => z.pts[Math.round(brg / 7.5)].distM;

describe('§7.5b: розрахунок зони', () => {
  it('Given штиль, 30 хв, 15 м/с When туди й назад Then коло ≈ tas × T×0.8 / 2 з 48 променів', () => {
    const z = zoneFor(P, 50, 30, 20, calm, 'roundtrip');
    expect(z.pts).toHaveLength(48);
    const expected = (15 * 30 * 60 * 0.8) / 2; // 10.8 км
    for (const q of z.pts) {
      expect(q.distM).toBeLessThanOrEqual(expected);
      expect(q.distM).toBeGreaterThan(expected - 300);
      expect(q.stop).toBe('energy');
    }
  });
  it('Given штиль When лише туди Then удвічі далі', () => {
    const rt = zoneFor(P, 50, 30, 20, calm, 'roundtrip'), ow = zoneFor(P, 50, 30, 20, calm, 'oneway');
    expect(ow.maxM / rt.maxM).toBeGreaterThan(1.9);
    expect(ow.maxM / rt.maxM).toBeLessThan(2.1);
  });
  it('Given вітер з півночі When туди й назад Then найкоротша вздовж вітру, найдовша поперек', () => {
    const z = zoneFor(P, 50, 30, 20, north5, 'roundtrip');
    expect(at(z, 90)).toBeGreaterThan(at(z, 0));
    expect(at(z, 90)).toBeGreaterThan(at(z, 180));
  });
  it('Given вітер з півночі When лише туди Then зона витягнута за вітром (на південь)', () => {
    const z = zoneFor(P, 50, 30, 20, north5, 'oneway');
    expect(at(z, 180)).toBeGreaterThan(at(z, 0) * 1.5);
  });
  it('Given вітер понад ліміт дрона Then кожен промінь обривається на ліміті (червона точка)', () => {
    const z = zoneFor(P, 50, 30, 20, () => [0, -13], 'roundtrip');
    expect(z.counts['wind-limit']).toBe(48);
    expect(z.maxM).toBe(0);
  });
  it('Given немає даних про вітер Then no-data, а не зона', () => {
    const z = zoneFor(P, 50, 30, 20, () => null, 'roundtrip');
    expect(z.counts['no-data']).toBe(48);
    expect(z.maxM).toBe(0);
  });
  it('Given −20 °C Then час × 0.7 (холод) і зона менша', () => {
    const warm = zoneFor(P, 50, 30, 20, calm, 'roundtrip'), cold = zoneFor(P, 50, 30, -20, calm, 'roundtrip');
    expect(cold.min).toBeCloseTo(21, 5);
    expect(cold.why).toContain('холод 0.70');
    expect(cold.maxM).toBeLessThan(warm.maxM * 0.75);
  });
  it('Given свій дрон з вантажем і паливом Then розкладка враховує вантаж і паливо', () => {
    const own: AnyProfile = { ...P, massKg: 2, payloadKg: 2 };
    expect(effectiveEndurance(energyInput(own, 20)).why).toContain('вантаж 0.35');
    const fuel: AnyProfile = { ...P, energy: 'fuel', kind: 'wing', fuelL: 2, burnLh: 1 };
    expect(effectiveEndurance(energyInput(fuel, -30)).min).toBe(120);
  });
  it('крок не дрібніший за 250 м і ≤ ~200 кроків на промінь', () => {
    expect(stepFor(15, 1440)).toBe(250);
    expect(stepFor(25, 300 * 60 * 0.8)).toBeGreaterThanOrEqual(1500);
  });
  it('кільця 1–2–5: 10.8 км → 5, 10 км', () => {
    expect(ringsKm(10_800)).toEqual([5, 10]);
    expect(ringsKm(1500)).toEqual([0.5, 1, 1.5]);
    expect(ringsKm(0)).toEqual([]);
  });
});

function view(zone = zoneFor(P, 50, 30, 20, north5, 'roundtrip'), extra: Partial<Parameters<typeof ZoneView>[0]> = {}) {
  return render(<ZoneView zone={zone} lat={50} lon={30} mode="roundtrip" onMode={() => {}} wind={{ ws: 5, dir: 0 }} altM={120} hourLabel="сб 10:00" lang="uk" {...extra} />);
}

describe('§7.5b: картка зони', () => {
  it('Then контур, кільця відстаней і стрілка вітру', () => {
    view();
    expect(screen.getByTestId('zone-contour').getAttribute('points')?.split(' ')).toHaveLength(48);
    expect(screen.getAllByTestId('zone-ring').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('zone-wind')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Зона польоту: найдалі .* км, вітер 5.0 м\/с з 0°/ })).toBeTruthy();
  });
  it('Then час польоту з розкладкою (холод, вантаж) і резерв 20%', () => {
    view();
    expect(screen.getByTestId('zone-time').textContent).toMatch(/паспорт 30 хв × холод 1.00 × вантаж 1.00 = 30.0 хв · з резервом 20% — 24.0 хв/);
  });
  it('Given обрив на ліміті Then червоні точки і підпис', () => {
    view(zoneFor(P, 50, 30, 20, () => [0, -13], 'roundtrip'));
    expect(screen.getAllByTestId('zone-wind-limit')).toHaveLength(48);
    expect(screen.getByText(/Обрив на ліміті вітру: 48 з 48/)).toBeTruthy();
    expect(screen.queryByTestId('zone-contour')).toBeNull();
  });
  it('When перемикач режиму Then onMode і aria-pressed', () => {
    const modes: string[] = [];
    view(undefined, { onMode: (m) => modes.push(m) });
    expect(screen.getByRole('button', { name: 'Туди й назад' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Лише туди' }));
    expect(modes).toEqual(['oneway']);
  });
});

describe('§7.5b: картка не конфліктує з шаром зони на карті (F0 #22, клас .zone)', () => {
  it('секція картки без класу zone', () => {
    view();
    const sec = screen.getByRole('region', { name: 'Зона польоту' });
    expect(sec.classList.contains('zone')).toBe(false);
    expect(sec.classList.contains('pzone')).toBe(true);
  });
});

describe('uk/en: розкладка часу польоту (§7.3a)', () => {
  const cases: EnergyInput[] = [
    { energy: 'battery', enduranceMin: 30, massKg: 1, kind: 'multirotor', t: 20 },
    { energy: 'battery', enduranceMin: 12, massKg: 2, payloadKg: 2, kind: 'multirotor', t: -20 },
    { energy: 'battery', enduranceMin: 150, massKg: 5, payloadKg: 1, kind: 'wing', t: -5 },
    { energy: 'fuel', fuelL: 2, burnLh: 1.5, massKg: 20, kind: 'wing', t: -30 },
    { energy: 'fuel', enduranceMin: 300, massKg: 20, kind: 'wing', t: 0 },
  ];
  it('українською — дослівно як core/effectiveEndurance', () => {
    for (const e of cases) expect(energyWhy(e, 'uk')).toBe(effectiveEndurance(e).why);
  });
  it('англійською — ті самі числа', () => {
    expect(energyWhy(cases[1], 'en')).toBe('datasheet 12 min × cold 0.70 × payload 0.35');
    expect(energyWhy(cases[3], 'en')).toBe('2 L / 1.5 L/h');
    expect(energyWhy(cases[4], 'en')).toBe('datasheet 300 min (fuel)');
  });
  it('картка зони англійською: заголовок, км, розкладка без кирилиці', () => {
    const z = zoneFor(P, 50, 30, 20, north5, 'roundtrip', 'en');
    view(z, { lang: 'en', hourLabel: dayHM('2026-11-28T08:00:00Z', 'en') });
    expect(screen.getByRole('heading').textContent).toBe('Flight zone · 120 m');
    expect(screen.getAllByTestId('zone-ring')[0].textContent).toMatch(/ km$/);
    expect(screen.getByTestId('zone-time').textContent).toBe('T = datasheet 30 min × cold 1.00 × payload 1.00 = 30.0 min · with 20% reserve — 24.0 min');
    expect(screen.getByRole('region', { name: 'Flight zone' }).textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
});

describe('uk/en: година в київському часі', () => {
  it('сб 10:00 / Sat 10:00', () => {
    expect(dayHM('2026-11-28T08:00:00Z', 'uk')).toBe('сб 10:00');
    expect(dayHM('2026-11-28T08:00:00Z', 'en')).toBe('Sat 10:00');
    expect(dayHM('oops', 'en')).toBe('—');
  });
});

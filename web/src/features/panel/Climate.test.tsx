import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Climate } from '../../contracts';
import { ClimateCard } from './Climate';
import { CLIMATE_KEY, climateFor, kyivMonth } from './climateData';

afterEach(cleanup);

const CITIES = [
  { name: 'Київ', lat: 50.45, lon: 30.52 }, { name: 'Львів', lat: 49.84, lon: 24.03 }, { name: 'Одеса', lat: 46.48, lon: 30.72 },
  { name: 'Харків', lat: 49.99, lon: 36.23 }, { name: 'Дніпро', lat: 48.46, lon: 35.05 }, { name: 'Житомир', lat: 50.25, lon: 28.66 },
];
const row = (base: number) => Array.from({ length: 12 }, (_, i) => base + i);
const CL: Climate = {
  generatedAt: '2026-11-28T00:00:00Z', sources: ['era5'], year: 2025,
  cities: Object.fromEntries(['Київ', 'Львів', 'Харків', 'Одеса', 'Дніпро'].map((c, k) => [c, { fpv7: row(10 * k), fpv10: row(1), heavy: row(2), wing: row(3) }])),
};

describe('§7.8: клімат ERA5 для точки й дрона', () => {
  it('ключі як у pipeline/sky/climate/fetch.py: wing = крило електро', () => {
    expect(CLIMATE_KEY).toEqual({ fpv7: 'fpv7', fpv10: 'fpv10', heavy: 'heavy', wingE: 'wing' });
  });
  it('найближче з 5 міст ERA5: під Житомиром — Київ (Житомира в ERA5 немає)', () => {
    const v = climateFor(CL, CITIES, 50.25, 28.66, 'fpv7');
    expect(v.kind).toBe('ok');
    if (v.kind === 'ok') { expect(v.city).toBe('Київ'); expect(v.months).toEqual(row(0)); expect(v.year).toBe(2025); expect(v.km).toBeGreaterThan(100); }
  });
  it('у Львові — ряд Львова; крило електро бере «wing»', () => {
    const v = climateFor(CL, CITIES, 49.84, 24.03, 'wingE');
    expect(v.kind === 'ok' && v.city === 'Львів' && v.months[0] === 3).toBe(true);
  });
  it('класи, яких ERA5 не рахував (recon, wingF, agro, свій дрон) — «не рахували», а не чужі числа', () => {
    for (const id of ['recon', 'wingF', 'agro', 'own']) expect(climateFor(CL, CITIES, 50.45, 30.52, id).kind).toBe('noclass');
  });
  it('немає climate.json → немає даних', () => {
    expect(climateFor(null, CITIES, 50.45, 30.52, 'fpv7')).toEqual({ kind: 'nodata' });
  });
  it('місяць обраної години — за Києвом: 31.12 23:30 UTC — уже січень', () => {
    expect(kyivMonth('2026-11-28T08:00:00Z')).toBe(10);
    expect(kyivMonth('2026-12-31T23:30:00Z')).toBe(0);
  });
});

describe('§7.8: картка на екрані', () => {
  const ok = climateFor(CL, CITIES, 50.45, 30.52, 'fpv7');
  it('12 стовпчиків, поточний місяць виділено, фраза «У листопаді льотних N% годин»', () => {
    render(<ClimateCard view={ok} month={10} drone="FPV 7″" coveredNames={[]} lang="uk" />);
    expect(screen.getAllByTestId('cl-bar')).toHaveLength(12);
    expect(screen.getAllByTestId('cl-bar').filter((b) => b.getAttribute('class')?.includes('on'))).toHaveLength(1);
    expect(screen.getByTestId('cl-month').textContent).toBe('У листопаді льотних 10% годин');
    expect(screen.getByText(/Київ, 2025 · 0 км від точки/)).toBeTruthy();
    expect(screen.getByText(/Copernicus ERA5 \(era5\)/)).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Січ 0%, Лют 1%');
  });
  it('не рахували для класу — список, для яких є', () => {
    render(<ClimateCard view={{ kind: 'noclass', covered: [] }} month={0} drone="x" coveredNames={['FPV 7″', 'Крило електро']} lang="uk" />);
    expect(screen.getByTestId('cl-noclass').textContent).toBe('Клімат ERA5 рахували лише для: FPV 7″, Крило електро.');
    expect(screen.queryByTestId('cl-bar')).toBeNull();
  });
  it('англійською — місто латиницею, без кирилиці', () => {
    render(<ClimateCard view={ok} month={11} drone="FPV 7″" coveredNames={[]} lang="en" />);
    expect(screen.getByTestId('cl-month').textContent).toBe('In December, 11% of hours are flyable');
    expect(screen.getByRole('region', { name: 'Copernicus ERA5 climate' }).textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
});

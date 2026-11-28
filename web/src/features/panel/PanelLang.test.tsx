import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useState } from 'react';
import type { DroneProfile } from '../../contracts';
import { AppCtx, type AppState } from '../../app/state';
import { LANG_KEY, LangProvider } from '../../app/lang';
import type { Bundle } from '../../app/data';
import { Panel } from './Panel';
import { fixture } from './fixture.test-util';

const P = (id: string, name: string, nameEn?: string): DroneProfile => ({
  id, name, ...(nameEn ? { nameEn } : {}), use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
});
const PROFILES = [P('recon', 'Квадрокоптер розвідки', 'Recon quadcopter'), P('x', 'Без перекладу')];
const CITIES = [{ name: 'Київ', lat: 50.45, lon: 30.52 }];

function Harness() {
  const [data] = useState<Bundle>({ ...fixture({ spd: () => 5 }), climate: null, profiles: PROFILES, cities: CITIES, borders: { features: [] } });
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'recon', layer: 'wind' });
  const ctx = useMemo(() => ({ data, s, set: (p: Partial<AppState>) => setS((o) => ({ ...o, ...p })) }), [data, s]);
  return <LangProvider><AppCtx.Provider value={ctx}><Panel /></AppCtx.Provider></LangProvider>;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('#108: назви дронів мовою інтерфейсу в панелі', () => {
  it('EN: список «Drone» — nameEn; без nameEn — name', () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<Harness />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Recon quadcopter', 'Без перекладу']);
  });
  it('EN: збережений запис (і звіт) — nameEn', () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save weather' }));
    expect(screen.getByTestId('saved-list').textContent).toContain('Recon quadcopter');
    expect(JSON.parse(localStorage.getItem('amber404.saved') ?? '[]')[0].drone).toBe('Recon quadcopter');
  });
  it('UK: список — name', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    render(<Harness />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Квадрокоптер розвідки', 'Без перекладу']);
  });
});

describe('#117: уся панель англійською — без кирилиці', () => {
  it('EN: точка біля Києва, збережене, зона, таблиця, маршрут, свій дрон', () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save weather' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kyiv');
    const panel = screen.getByRole('region', { name: 'Точка' }); // aria-label сталий — на ньому тримаються e2e
    // Виняток — назва дрона без перекладу в даних тесту («Без перекладу»), її показ перевірено вище.
    const text = (panel.textContent ?? '').replace('Без перекладу', '');
    expect(text.match(/[^\s]*[А-Яа-яІіЇїЄєҐґ][^\s]*/g)).toBeNull();
  });
  it('EN: місто у збереженому записі — латиницею', () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save weather' }));
    expect(JSON.parse(localStorage.getItem('amber404.saved') ?? '[]')[0].place).toBe('Kyiv (50.450, 30.520)');
  });
});

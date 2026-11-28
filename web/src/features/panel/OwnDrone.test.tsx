import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useCallback, useMemo, useState } from 'react';
import type { DroneProfile } from '../../contracts';
import { AppCtx, useApp, type AppState } from '../../app/state';
import type { Bundle } from '../../app/data';
import { Panel } from './Panel';
import { dropOwn, fromProfile, loadOwn, OWN_ID, OWN_KEY, saveOwn, toProfile, upsertOwn, validate } from './ownDroneStore';
import { fixture } from './fixture.test-util';
import { resetRoute, setRoute } from '../route/routeStore';

const FPV: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('F4-AC6: логіка свого дрона', () => {
  it('стартові значення — з обраного профілю', () => {
    const o = fromProfile(FPV);
    expect(o).toMatchObject({ kind: 'multirotor', massKg: 1, windMs: 10, band0: 10, band1: 90, energy: 'battery', enduranceMin: 10, payloadKg: 0 });
    expect(validate(o)).toEqual([]);
  });
  it('перевірка полів: маса > 0, висота до > від, для палива — літри й витрата', () => {
    const o = fromProfile(FPV);
    expect(validate({ ...o, massKg: 0 })).toEqual(['massKg']);
    expect(validate({ ...o, band1: 5 })).toEqual(['band1']);
    expect(validate({ ...o, payloadKg: NaN })).toEqual(['payloadKg']);
    expect(validate({ ...o, energy: 'fuel', fuelL: 0, burnLh: 1 })).toEqual(['fuelL']);
  });
  it('акумулятор: паспортний час і вантаж у профілі', () => {
    const p = toProfile({ ...fromProfile(FPV), payloadKg: 1.5, enduranceMin: 12 }, 'Свій дрон');
    expect(p).toMatchObject({ id: OWN_ID, enduranceMin: 12, payloadKg: 1.5, source: 'користувач (свій дрон)' });
    expect(p.fuelL).toBeUndefined();
  });
  it('паливо: T = літри / витрата × 60', () => {
    const p = toProfile({ ...fromProfile(FPV), kind: 'wing', energy: 'fuel', fuelL: 3, burnLh: 1.5, band0: 300, band1: 1000 }, 'x');
    expect(p.enduranceMin).toBe(120);
    expect(p.defaultAltM).toBe(300);
  });
  it('лише localStorage; зіпсований або невалідний запис → null', () => {
    saveOwn(fromProfile(FPV));
    expect(localStorage.getItem(OWN_KEY)).toContain('"massKg":1');
    expect(loadOwn()?.massKg).toBe(1);
    localStorage.setItem(OWN_KEY, '{bad');
    expect(loadOwn()).toBeNull();
    localStorage.setItem(OWN_KEY, JSON.stringify({ ...fromProfile(FPV), massKg: -1 }));
    expect(loadOwn()).toBeNull();
  });
  it('список профілів: свій дрон додається один раз і прибирається', () => {
    const own = toProfile(fromProfile(FPV), 'x');
    const l = upsertOwn(upsertOwn([FPV], own), own);
    expect(l.map((p) => p.id)).toEqual(['fpv7', OWN_ID]);
    expect(dropOwn(l).map((p) => p.id)).toEqual(['fpv7']);
  });
});

// Кнопка тесту: перенести обрану точку (як клік на карті).
function Move() { const { set } = useApp(); return <button type="button" onClick={() => set({ lat: 50.6, lon: 30.6 })}>move</button>; }

// Обв'язка як у App: справжній стан і setProfiles.
function Harness() {
  const base = fixture({ spd: () => 5 });
  const [data, setData] = useState<Bundle>({
    ...base, climate: null, profiles: [FPV], cities: [{ name: 'Київ', lat: 50.45, lon: 30.52 }], borders: { features: [] },
  });
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: 'wind' });
  const setProfiles = useCallback((f: (l: DroneProfile[]) => DroneProfile[]) => setData((d) => ({ ...d, profiles: f(d.profiles) })), []);
  const ctx = useMemo(() => ({ data, s, set: (p: Partial<AppState>) => setS((o) => ({ ...o, ...p })), setProfiles }), [data, s, setProfiles]);
  return <AppCtx.Provider value={ctx}><Move /><Panel /></AppCtx.Provider>;
}

const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement;

describe('F4-AC6: свій дрон у панелі', () => {
  it('Given свій дрон з ліміту вітру 4 м/с і вантажем When збережено Then вердикт, зона й маршрут за ним, розкладка видна, дані в localStorage', () => {
    render(<Harness />);
    // До: FPV 7″, вітер 5 м/с < 10 — не NO-GO через вітер.
    expect(screen.getByTestId('point-level').textContent).not.toBe('НЕ МОЖНА');
    fireEvent.change(field(/Ліміт вітру/), { target: { value: '4' } });
    fireEvent.change(field(/Ліміт поривів/), { target: { value: '20' } });
    fireEvent.change(field(/Маса без вантажу/), { target: { value: '2' } });
    fireEvent.change(field(/^Вантаж/), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти й обрати' }));

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(OWN_ID);
    expect(screen.getByRole('option', { name: 'Свій дрон' })).toBeTruthy();
    // Вердикт: вітер 5 > 4.
    expect(screen.getByTestId('point-level').textContent).toBe('НЕ МОЖНА');
    expect(screen.getByText(/Вітер 5.0 м\/с > ліміт 4.0 м\/с/)).toBeTruthy();
    // Зона: усі промені обриваються на ліміті вітру свого дрона.
    expect(screen.getByText(/Обрив на ліміті вітру: 48 з 48/)).toBeTruthy();
    // Розкладка часу: вантаж (2 / (2 + 2))^1.5 = 0.35.
    expect(screen.getByTestId('zone-time').textContent).toMatch(/вантаж 0.35/);
    // Маршрут: та сама розкладка.
    const route = screen.getByRole('region', { name: /Маршрут/ });
    // A — обрана точка, B — тап по карті (RouteLayer пише в routeStore).
    act(() => setRoute({ b: { lat: 50.6, lon: 30.6 } }));
    expect(within(route).getByText(/вантаж 0.35/)).toBeTruthy();
    act(() => resetRoute());
    // Лише localStorage.
    expect(JSON.parse(localStorage.getItem(OWN_KEY) ?? '{}')).toMatchObject({ windMs: 4, payloadKg: 2 });
    expect(screen.getByRole('status').textContent).toMatch(/рахуються за своїм дроном/);
  });
  it('Given помилка в полі When зберегти Then повідомлення, нічого не збережено', () => {
    render(<Harness />);
    fireEvent.change(field(/Маса без вантажу/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти й обрати' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Маса без вантажу/);
    expect(localStorage.getItem(OWN_KEY)).toBeNull();
  });
  it('Given збережений раніше When відкрили сайт Then свій дрон у списку; видалити — повертає FPV', () => {
    saveOwn({ ...fromProfile(FPV), windMs: 4 });
    render(<Harness />);
    expect(screen.getByRole('option', { name: 'Свій дрон' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: OWN_ID } });
    expect(screen.getByTestId('point-level').textContent).toBe('НЕ МОЖНА');
    fireEvent.click(screen.getByRole('button', { name: 'Видалити свій дрон' }));
    expect(screen.queryByRole('option', { name: 'Свій дрон' })).toBeNull();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('fpv7');
    expect(localStorage.getItem(OWN_KEY)).toBeNull();
  });
  it('паливо: поля літрів і витрати замість часу', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Паливо' }));
    expect(field(/Паливо, л/)).toBeTruthy();
    expect(field(/Витрата/)).toBeTruthy();
    expect(screen.queryByLabelText(/Час польоту за паспортом/)).toBeNull();
  });
});

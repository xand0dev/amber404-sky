// Issue #169: «▶ Демо» — послідовність кроків на фейковому таймері, зупинка дотиком / клавішею, «Пропустити», ?demo=1.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useMemo, useState } from 'react';
import { AppCtx, type AppState, type Ctx } from '../../app/state';
import { ViewCtx } from '../../app/view/view';
import { LANG_KEY, LangProvider } from '../../app/lang';
import { MapFrame } from '../../ui/MapFrame';
import { DEMO_STEPS, DEMO_TOTAL_MS, FULL_VIEW, type View } from '../../core';
import { fixture } from '../panel/fixture.test-util';
import { DemoTour } from './DemoTour';

const POLTAVA = { name: 'Полтава', nameEn: 'Poltava', lat: 49.59, lon: 34.55 };
const PROFILES = [
  { id: 'heavy', name: 'Важкий', massKg: 20, energy: 'battery', enduranceMin: 30, cruiseMs: 12, windMs: 12, gustMs: 15, tMinC: -10, precipMmH: 1, bandM: [10, 300], defaultAltM: 100, kind: 'multirotor', source: 'assumption' },
  { id: 'fpv7', name: 'FPV 7″', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 12, tMinC: -10, precipMmH: 1, bandM: [10, 300], defaultAltM: 50, kind: 'multirotor', source: 'assumption' },
];

let last: { s: AppState; view: View } = { s: {} as AppState, view: FULL_VIEW };

function Harness({ galileo = true, climate = true }: { galileo?: boolean; climate?: boolean }) {
  const f = fixture();
  const n = f.meta.times.length;
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 300, hour: 5, droneId: 'heavy', layer: 'gust' });
  const [view, setView] = useState<View>({ lat: 50, lon: 30, zoom: 4 });
  useEffect(() => { last = { s, view }; });
  const data = useMemo(() => ({
    ...f,
    meta: { ...f.meta, sources: [
      { id: 'openmeteo', name: 'Open-Meteo', license: '', fetchedAt: f.meta.generatedAt, status: 'ok', note: '' },
      { id: 'celestrak-galileo', name: 'Galileo', license: '', fetchedAt: f.meta.generatedAt, status: galileo ? 'ok' : 'nodata', note: '' },
      { id: 'era5', name: 'ERA5', license: '', fetchedAt: f.meta.generatedAt, status: climate ? 'ok' : 'nodata', note: '' },
    ] },
    galileo: galileo ? { generatedAt: f.meta.generatedAt, sources: ['mock'], elevationMaskDeg: 10, points: [POLTAVA], visible: [Array(n).fill(8)], pdop: [Array(n).fill(1.42)] } : null,
    climate: null, profiles: PROFILES, cities: [POLTAVA], borders: { features: [] },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [galileo, climate]);
  const ctx = { data, s, set: (p: Partial<AppState>) => setS((o) => ({ ...o, ...p })) } as unknown as Ctx;
  const vctx = useMemo(() => ({ view, setView }), [view, setView]);
  return (
    <AppCtx.Provider value={ctx}><ViewCtx.Provider value={vctx}>
      <MapFrame><canvas className="map" /><DemoTour /></MapFrame>
    </ViewCtx.Provider></AppCtx.Provider>
  );
}

const view = (p: { galileo?: boolean; climate?: boolean } = {}) => render(<LangProvider><Harness {...p} /></LangProvider>);
const caption = () => document.querySelector('.demo-cap');
const start = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Ще інструменти' }));
  fireEvent.click(screen.getByRole('button', { name: '▶ Демо' }));
};
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const at = (i: number) => DEMO_STEPS.slice(0, i).reduce((a, s) => a + s.ms, 0);

beforeEach(() => {
  localStorage.clear(); localStorage.setItem(LANG_KEY, 'uk');
  vi.useFakeTimers({ now: Date.parse('2026-11-28T07:30:00Z') });
  window.history.replaceState(null, '', '/');
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState(null, '', '/'); });

describe('AC1: кнопка «▶ Демо» в меню «⋯»', () => {
  it('Given тур не йде Then підпису немає; When «▶ Демо» Then перший крок', () => {
    view();
    expect(caption()).toBeNull();
    start();
    expect(caption()!.textContent).toContain('вітер на 120 м');
    expect(caption()!.textContent).toContain('1 з 5');
  });
});

describe('AC2: послідовність кроків на фейковому таймері', () => {
  it('вітер 120 м → FPV 7″ 50 м «Можна летіти» → Полтава → 48 год → Galileo і ERA5 → кінець', () => {
    view();
    start();
    tick(50);
    expect(last.s).toMatchObject({ layer: 'wind', altM: 120, hour: 0 });
    expect(last.view).toEqual(FULL_VIEW);

    tick(at(1));
    expect(last.s).toMatchObject({ droneId: 'fpv7', altM: 50, layer: 'go' });
    expect(caption()!.textContent).toContain('Можна летіти');

    tick(DEMO_STEPS[1].ms);
    expect(last.s).toMatchObject({ lat: 49.59, lon: 34.55 });
    expect(caption()!.textContent).toContain('Точка біля Полтави');
    tick(DEMO_STEPS[2].ms - 100);
    expect(last.view.zoom).toBeGreaterThan(1);
    expect(last.view.lat).toBeCloseTo(49.59, 5);

    tick(100 + DEMO_STEPS[3].ms / 2);
    expect(last.s.hour).toBeGreaterThan(5);
    expect(last.s.hour).toBeLessThan(47);
    expect(caption()!.textContent).toContain('48 год');
    tick(DEMO_STEPS[3].ms / 2);
    expect(last.s.hour).toBe(47);

    expect(caption()!.textContent).toContain('Galileo: 8 супутників, PDOP 1.4');
    expect(caption()!.textContent).toContain('5 з 5');

    tick(DEMO_TOTAL_MS);
    expect(caption()).toBeNull();
    expect(last.s).toMatchObject({ lat: 49.59, lon: 34.55, droneId: 'fpv7', altM: 50, layer: 'go', hour: 47 });
  });

  it('AC4: точка — справжній рівень і причина з вердикту, без вигаданого', () => {
    view();
    start();
    tick(at(2) + 50);
    expect(caption()!.textContent).toMatch(/Точка біля Полтави: (МОЖНА|ОБЕРЕЖНО|НЕ МОЖНА|НЕМАЄ ДАНИХ)/);
  });

  it('AC4: Galileo й ERA5 nodata → «немає даних», без чисел', () => {
    view({ galileo: false, climate: false });
    start();
    tick(at(4) + 50);
    const c = caption()!.textContent!;
    expect(c).toContain('Galileo: немає даних');
    expect(c).toContain('ERA5: немає даних');
    expect(c).not.toContain('PDOP');
  });
});

describe('AC3: будь-який дотик чи клавіша зупиняє тур, стан лишається', () => {
  it('Given крок 2 When дотик до карти Then тур зупинено, далі нічого не змінюється', () => {
    view();
    start();
    tick(at(1) + 50);
    fireEvent.pointerDown(document.querySelector('canvas.map')!);
    expect(caption()).toBeNull();
    const s = { ...last.s };
    tick(DEMO_TOTAL_MS);
    expect(last.s).toEqual(s);
    expect(last.s).toMatchObject({ droneId: 'fpv7', altM: 50, layer: 'go' });
  });
  it('When клавіша Then зупинено', () => {
    view();
    start();
    tick(500);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(caption()).toBeNull();
  });
  it('When «Пропустити» Then зупинено', () => {
    view();
    start();
    tick(500);
    fireEvent.click(screen.getByRole('button', { name: 'Пропустити' }));
    expect(caption()).toBeNull();
  });
});

describe('AC1: ?demo=1 — тур одразу', () => {
  it('Given ?demo=1 Then тур іде без натискань', () => {
    window.history.replaceState(null, '', '/?demo=1');
    view();
    expect(caption()!.textContent).toContain('1 з 5');
  });
  it('англійською — через useT', () => {
    localStorage.setItem(LANG_KEY, 'en');
    window.history.replaceState(null, '', '/?demo=1');
    view();
    expect(caption()!.textContent).toContain('Wind at 120 m');
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });
});

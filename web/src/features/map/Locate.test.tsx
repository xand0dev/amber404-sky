// Issue #161 (F3): кнопка «Де я» — мок navigator.geolocation: успіх, відмова, поза рамкою, стеження вмик/вимик, OPSEC.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { AppCtx, type AppState, type Ctx } from '../../app/state';
import { ViewCtx } from '../../app/view/view';
import { LangProvider } from '../../app/lang';
import { FULL_VIEW, type View } from '../../core';
import { GEO_OPTS } from '../../core/locate';
import { bundle, state } from './fixture.test-util';
import { Locate } from './Locate';

type Ok = (p: GeolocationPosition) => void;
type Fail = (e: GeolocationPositionError) => void;
const pos = (latitude: number, longitude: number, accuracy = 30) => ({ coords: { latitude, longitude, accuracy }, timestamp: 0 }) as GeolocationPosition;
const err = (code: number) => ({ code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

let geo: { getCurrentPosition: ReturnType<typeof vi.fn>; watchPosition: ReturnType<typeof vi.fn>; clearWatch: ReturnType<typeof vi.fn> };
let once: { ok: Ok; fail: Fail } | null, watch: { ok: Ok; fail: Fail } | null;
const latest = {} as { s: AppState; view: View; set: (p: Partial<AppState>) => void };

beforeEach(() => {
  once = null; watch = null;
  geo = {
    getCurrentPosition: vi.fn((ok: Ok, fail: Fail) => { once = { ok, fail }; }),
    watchPosition: vi.fn((ok: Ok, fail: Fail) => { watch = { ok, fail }; return 7; }),
    clearWatch: vi.fn(),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function Harness({ en = false }: { en?: boolean }) {
  const [s, setS] = useState<AppState>(state());
  const [view, setView] = useState<View>(FULL_VIEW);
  const set = (p: Partial<AppState>) => setS((o) => ({ ...o, ...p }));
  useEffect(() => { Object.assign(latest, { s, view, set }); });
  const ctx = { data: bundle(), s, set } as Ctx;
  const ui = (
    <AppCtx.Provider value={ctx}>
      <ViewCtx.Provider value={{ view, setView }}>
        <div className="mapwrap"><canvas className="map" /><Locate /></div>
      </ViewCtx.Provider>
    </AppCtx.Provider>
  );
  // Без провайдера мова — українська (типова); EN — через LangProvider і вибір у localStorage.
  return en ? <LangProvider>{ui}</LangProvider> : ui;
}

const btn = () => screen.getByRole('button', { name: 'Де я' });
const dot = () => document.querySelector('svg.locate[role="img"]');
const status = () => screen.getByRole('status').textContent;

describe('Given карта; When «Де я»', () => {
  it('AC1: кнопка-приціл з доступним ім’ям «Де я»', () => {
    render(<Harness />);
    expect(btn().textContent).toContain('⌖');
  });

  it('AC2, AC3: успіх → getCurrentPosition з високою точністю й 10 с; точка, коло, вигляд міста, обрана точка', () => {
    render(<Harness />);
    fireEvent.click(btn());
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), GEO_OPTS);
    act(() => once!.ok(pos(49.84, 24.03, 50)));
    expect(latest.s).toMatchObject({ lat: 49.84, lon: 24.03 });
    expect(latest.view.lat).toBeCloseTo(49.84, 5);
    expect(latest.view.lon).toBeCloseTo(24.03, 5);
    expect(latest.view.zoom).toBeGreaterThan(10);
    expect(dot()).not.toBeNull();
    const [acc, me] = [...dot()!.querySelectorAll('circle')];
    expect(acc.getAttribute('class')).toBe('locacc');
    expect(Number(acc.getAttribute('r'))).toBeGreaterThan(0);
    expect(me.getAttribute('class')).toBe('locme');
    expect(Number(me.getAttribute('cx'))).toBeCloseTo(200, 0);
    expect(Number(me.getAttribute('cy'))).toBeCloseTo(150, 0);
  });

  it('AC5: відмова в дозволі → «Немає доступу до геолокації», без точки й без падіння', () => {
    render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.fail(err(1)));
    expect(status()).toBe('Немає доступу до геолокації');
    expect(dot()).toBeNull();
    expect(latest.s).toMatchObject({ lat: 50.45, lon: 30.52 });
  });

  it('AC5: таймаут → те саме повідомлення', () => {
    render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.fail(err(3)));
    expect(status()).toBe('Немає доступу до геолокації');
  });

  it('AC5: без API геолокації → повідомлення, без падіння', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    render(<Harness />);
    fireEvent.click(btn());
    expect(status()).toBe('Немає доступу до геолокації');
  });

  it('AC5: позиція поза рамкою карти → «Ви поза зоною карти», точка й панель не змінюються', () => {
    render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.ok(pos(52.23, 21.01)));
    expect(status()).toBe('Ви поза зоною карти');
    expect(dot()).toBeNull();
    expect(latest.s).toMatchObject({ lat: 50.45, lon: 30.52 });
    expect(latest.view).toEqual(FULL_VIEW);
  });

  it('AC4: друге натискання — стеження: точка рухається, панель лишається; третє — вимикає', () => {
    render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.ok(pos(49.84, 24.03)));
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn());
    expect(geo.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), GEO_OPTS);
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    const x0 = Number(dot()!.querySelector('.locme')!.getAttribute('cx'));
    act(() => watch!.ok(pos(49.84, 24.05)));
    const x1 = Number(dot()!.querySelector('.locme')!.getAttribute('cx'));
    expect(x1).toBeGreaterThan(x0);
    expect(latest.s).toMatchObject({ lat: 49.84, lon: 24.03 });
    fireEvent.click(btn());
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
    expect(btn().getAttribute('aria-pressed')).toBe('false');
  });

  it('AC4: людина обрала іншу точку під час стеження — панель не перескакує на позицію', () => {
    render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.ok(pos(49.84, 24.03)));
    fireEvent.click(btn());
    // Клік по карті в іншому місці (те саме, що робить MapView через set).
    act(() => latest.set({ lat: 48.46, lon: 35.05 }));
    act(() => watch!.ok(pos(49.9, 24.1)));
    expect(latest.s).toMatchObject({ lat: 48.46, lon: 35.05 });
    expect(dot()).not.toBeNull();
  });

  it('AC4: стеження зупиняється, коли компонент зникає', () => {
    const r = render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.ok(pos(49.84, 24.03)));
    fireEvent.click(btn());
    r.unmount();
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });

  it('AC6 OPSEC: після «Де я» й стеження — жодного fetch / XHR, нічого в localStorage, URL і консолі', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const beacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const store = vi.spyOn(Storage.prototype, 'setItem');
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const url = location.href;
    render(<Harness />);
    fireEvent.click(btn());
    act(() => once!.ok(pos(49.84, 24.03)));
    fireEvent.click(btn());
    act(() => watch!.ok(pos(49.85, 24.04)));
    fireEvent.click(btn());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    for (const l of logs) expect(l).not.toHaveBeenCalled();
    expect(location.href).toBe(url);
    vi.unstubAllGlobals();
  });

  it('AC7: англійською — «My location» і повідомлення англійською', () => {
    localStorage.setItem('amber404.lang', 'en');
    render(<Harness en />);
    const b = screen.getByRole('button', { name: 'My location' });
    fireEvent.click(b);
    act(() => once!.fail(err(1)));
    expect(status()).toBe('No access to geolocation');
  });
});

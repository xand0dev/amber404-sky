import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx } from '../state';
import { ZoneLayer } from './ZoneLayer';
import { clearZoneCache } from './model';

afterEach(() => { cleanup(); clearZoneCache(); });

const G = { lat0: 52.5, lon0: 22, step: 0.5, nr: 18, nc: 38 };
const N = G.nr * G.nc;
const f2 = (x: number) => Array.from({ length: 2 }, () => Array<number>(N).fill(x));
const ctx = {
  data: {
    meta: { grid: G, times: ['2026-11-28T09:00:00Z', '2026-11-28T10:00:00Z'], sources: [] },
    profile: { levels: [10, 50], spd: [f2(30), f2(30)], dir: [f2(0), f2(0)], gust: f2(0), temp: f2(150), precip: f2(0), rh: f2(50), vis: f2(400) },
    galileo: null, kp: null,
    profiles: [{ id: 'fpv7', name: 'FPV 7″', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, kind: 'multirotor' }],
  },
  s: { lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: 'wind' }, set: () => {},
} as unknown as Ctx;

const view = () => render(<AppCtx.Provider value={ctx}><main className="mapwrap"><canvas className="map" /><ZoneLayer /></main></AppCtx.Provider>);

describe('Given шар «Зона» (SPEC §7.5b)', () => {
  it('Then окремий canvas над полем погоди, кліки проходять до карти', () => {
    const { container } = view();
    const zone = container.querySelector('canvas.zone');
    expect(zone).not.toBeNull();
    expect(container.querySelector('canvas.map')!.compareDocumentPosition(zone!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(zone!.getAttribute('aria-hidden')).toBe('true');
  });

  it('Then за замовчуванням увімкнено; When «Зона»; Then вимкнено й canvas прихований', () => {
    const { container } = view();
    const b = screen.getByRole('button', { name: 'Зона' });
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/туди й назад/)).toBeTruthy();
    fireEvent.click(b);
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect((container.querySelector('canvas.zone') as HTMLElement).hidden).toBe(true);
    expect(screen.queryByText(/туди й назад/)).toBeNull();
  });

  it('Then підпис: з чого порахований час, резерв 20%, крейсер, вітер і assumption', () => {
    view();
    const cap = screen.getByText(/туди й назад/).closest('p')!;
    expect(cap.textContent).toMatch(/10\.0 хв/);
    expect(cap.textContent).toMatch(/резерв 20%/);
    expect(cap.textContent).toMatch(/22 м\/с/);
    expect(cap.textContent).toMatch(/вітер 3\.0 м\/с/);
    expect(cap.textContent).toMatch(/assumption/);
  });

  it('Given вітер у точці старту понад ліміт; Then підпис «відсутня» і червона точка в легенді', () => {
    const strong = { ...ctx, data: { ...ctx.data, profile: { ...ctx.data.profile, spd: [f2(120), f2(120)] } } } as unknown as Ctx;
    const { container } = render(<AppCtx.Provider value={strong}><main className="mapwrap"><ZoneLayer /></main></AppCtx.Provider>);
    const cap = container.querySelector('.zonecap')!;
    expect(cap.textContent).toMatch(/туди й назад відсутня/);
    expect(cap.textContent).toMatch(/вітер понад ліміт 10 м\/с/);
    expect(cap.querySelector('.zonedot')).not.toBeNull();
  });
  // Issue #85 AC4: на телефоні підпис згорнутий до одного рядка, деталі — тапом.
  it('Then підпис згорнутий в один рядок; When тап; Then деталі розгорнуто; When ще тап; Then знову згорнуто', () => {
    const { container } = view();
    const b = container.querySelector('.zonecap button')!;
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.zonecap')!.classList.contains('open')).toBe(false);
    fireEvent.click(b);
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.zonecap')!.classList.contains('open')).toBe(true);
    fireEvent.click(b);
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });
});

// Issue #87 AC2: у згорнутому підписі — лише відстань і вітер; формула часу й assumption — тапом («Деталі»).
describe('Given підпис зони (issue #87)', () => {
  it('Then згорнутий: без формули й assumption; When тап; Then деталі видно', () => {
    const { container } = view();
    const det = container.querySelector('.zonecap .zonedet') as HTMLElement;
    expect(det.hidden).toBe(true);
    expect(det.textContent).toMatch(/резерв 20%/);
    expect(det.textContent).toMatch(/assumption/);
    const rest = container.querySelector('.zonecap .zonetxt')!.textContent!.replace(det.textContent!, '');
    expect(rest).not.toMatch(/assumption|хв/);
    expect(rest).toMatch(/Деталі/);
    fireEvent.click(container.querySelector('.zonecap button')!);
    expect(det.hidden).toBe(false);
  });
});

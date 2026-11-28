import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { AppCtx, type Ctx } from '../state';
import { clearZoneCache, zoneFor } from '../zone/model';
import { FULL_VIEW, makeProjection, type View } from '../../core';
import { ViewCtx } from './view';
import { ViewControls } from './ViewControls';

const W = 400, H = 300;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(W);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(H);
});
afterEach(() => { cleanup(); clearZoneCache(); vi.restoreAllMocks(); });

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

const seen = { v: FULL_VIEW as View };
function Harness({ onMap, c = ctx }: { onMap: () => void; c?: Ctx }) {
  const [view, setView] = useState<View>(FULL_VIEW);
  useEffect(() => { seen.v = view; }, [view]);
  return (
    <AppCtx.Provider value={c}>
      <ViewCtx.Provider value={{ view, setView }}>
        <main className="mapwrap"><canvas className="map" onClick={onMap} /><ViewControls /></main>
      </ViewCtx.Provider>
    </AppCtx.Provider>
  );
}
const view = () => {
  const onMap = vi.fn();
  const r = render(<Harness onMap={onMap} />);
  return { onMap, map: r.container.querySelector('canvas.map')! };
};
const ptr = (type: string, target: EventTarget, id: number, x: number, y: number) =>
  act(() => { target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }), { pointerId: id })); });

describe('Given карта з масштабом (issue #64)', () => {
  it('Then кнопки + / −, «До зони», «Україна»', () => {
    view();
    for (const n of ['Наблизити', 'Віддалити', 'До зони', 'Україна']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
  });

  it('When «+»; Then масштаб більший; When «−»; Then назад, не дрібніше «вся Україна»', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Наблизити' }));
    expect(seen.v.zoom).toBeCloseTo(2, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Віддалити' }));
    fireEvent.click(screen.getByRole('button', { name: 'Віддалити' }));
    expect(seen.v.zoom).toBe(1);
  });

  it('When колесо миші вгору; Then наближення', () => {
    const { map } = view();
    fireEvent.wheel(map, { deltaY: -200, clientX: 200, clientY: 150 });
    expect(seen.v.zoom).toBeGreaterThan(1);
  });

  it('When перетягування; Then карта зсувається, а клік після перетягування не обирає точку', () => {
    const { map, onMap } = view();
    fireEvent.click(screen.getByRole('button', { name: 'Наблизити' }));
    const before = seen.v;
    ptr('pointerdown', map, 1, 100, 100);
    ptr('pointermove', window, 1, 160, 100);
    ptr('pointerup', window, 1, 160, 100);
    fireEvent.click(map);
    expect(onMap).not.toHaveBeenCalled();
    expect(seen.v.lon).toBeLessThan(before.lon);
    expect(seen.v.zoom).toBe(before.zoom);
  });

  it('When тап без перетягування; Then клік доходить до карти (вибір точки)', () => {
    const { map, onMap } = view();
    ptr('pointerdown', map, 1, 100, 100);
    ptr('pointerup', window, 1, 102, 101);
    fireEvent.click(map);
    expect(onMap).toHaveBeenCalledTimes(1);
  });

  it('When pinch двома пальцями; Then масштаб зростає', () => {
    const { map } = view();
    ptr('pointerdown', map, 1, 150, 150);
    ptr('pointerdown', map, 2, 250, 150);
    ptr('pointermove', window, 2, 350, 150);
    expect(seen.v.zoom).toBeCloseTo(2, 6);
  });

  it('When «До зони»; Then контур зони вміщено з полями 15%; When «Україна»; Then повний вигляд', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'До зони' }));
    const z = zoneFor(ctx.data, ctx.s)!;
    const p = makeProjection(W, H, seen.v);
    const xy = z.points.map((q) => p.project(q.lat, q.lon));
    for (const [x, y] of xy) {
      expect(x).toBeGreaterThanOrEqual(W * 0.15 - 1e-6); expect(x).toBeLessThanOrEqual(W * 0.85 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(H * 0.15 - 1e-6); expect(y).toBeLessThanOrEqual(H * 0.85 + 1e-6);
    }
    expect(seen.v.zoom).toBeGreaterThan(10);
    fireEvent.click(screen.getByRole('button', { name: 'Україна' }));
    expect(seen.v).toEqual(FULL_VIEW);
  });
});

// Issue #89: вітер понад ліміт — зони немає; «До зони» не наближає до суцільного кольору без кордонів і міст.
describe('Given зони немає (вітер понад ліміт, #89)', () => {
  const f = (x: number) => Array.from({ length: 2 }, () => Array<number>(N).fill(x));
  const windy = { ...ctx, data: { ...ctx.data, profile: { ...ctx.data.profile, spd: [f(300), f(300)] } } } as unknown as Ctx;
  it('When «До зони»; Then точка в центрі й видно щонайменше ±20 км навколо', () => {
    render(<Harness onMap={vi.fn()} c={windy} />);
    fireEvent.click(screen.getByRole('button', { name: 'До зони' }));
    const p = makeProjection(W, H, seen.v);
    const [x, y] = p.project(windy.s.lat, windy.s.lon);
    expect(Math.abs(x - W / 2)).toBeLessThan(1);
    expect(Math.abs(y - H / 2)).toBeLessThan(1);
    const [latTop] = p.unproject(W / 2, 0), [latBot] = p.unproject(W / 2, H);
    expect((latTop - latBot) * 111).toBeGreaterThanOrEqual(40);
  });
});

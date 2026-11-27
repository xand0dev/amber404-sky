import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeProjection } from '../../core';
import { Draw } from './Draw';
import { KEY } from './store';

const W = 400, H = 300;
const rect = { left: 0, top: 0, right: W, bottom: H, width: W, height: H, x: 0, y: 0, toJSON: () => ({}) };

beforeEach(() => { vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect); });
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const mount = () => render(<main className="mapwrap"><canvas className="map" /><Draw /></main>);
const layer = (c: HTMLElement) => c.querySelector('svg.drawlayer') as SVGSVGElement;
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Малювання' }));
const tool = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const tap = (c: HTMLElement, x: number, y: number) => fireEvent.click(layer(c), { clientX: x, clientY: y });
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '[]');

describe('Given шар малюнків (SPEC §7.13)', () => {
  it('Then окремий SVG у mapwrap над полем погоди; поки інструмент не обрано — кліки йдуть на карту', () => {
    const { container } = mount();
    const svg = layer(container);
    expect(svg).not.toBeNull();
    expect(container.querySelector('canvas.map')!.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(svg.classList.contains('drawing')).toBe(false);
    open(); tool('Лінія');
    expect(layer(container).classList.contains('drawing')).toBe(true);
  });

  it('Then інструменти: точка з підписом, лінія, стрілка, область, текст; колір; скасувати; лише в браузері; без цілей', () => {
    mount(); open();
    for (const n of ['Точка', 'Лінія', 'Стрілка', 'Область', 'Текст']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.getByLabelText('Колір')).toBeTruthy();
    expect(screen.getByLabelText('Підпис')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy();
    expect(screen.getByText(/лише в цьому браузері/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/ціль|цілі|target/i);
  });
});

describe('Given лінія, стрілка й точка з підписом (F3-AC8); When намалювати й перезавантажити', () => {
  it('Then усе на місці: координати через core/projection, колір, підпис', () => {
    const p = makeProjection(W, H);
    const first = mount();
    open();
    fireEvent.change(screen.getByLabelText('Колір'), { target: { value: '#e0532f' } });
    tool('Лінія'); tap(first.container, 100, 100); tap(first.container, 200, 150);
    tool('Готово');
    tool('Стрілка'); tap(first.container, 50, 200); tap(first.container, 150, 250); tap(first.container, 250, 220);
    tool('Готово');
    fireEvent.change(screen.getByLabelText('Підпис'), { target: { value: 'Старт' } });
    tool('Точка'); tap(first.container, 300, 80);
    tool('Область'); tap(first.container, 10, 10); tap(first.container, 60, 10); tap(first.container, 30, 50);
    tool('Готово');
    fireEvent.change(screen.getByLabelText('Підпис'), { target: { value: 'Сад' } });
    tool('Текст'); tap(first.container, 320, 260);

    const s = saved();
    expect(s.map((x: { kind: string }) => x.kind)).toEqual(['line', 'arrow', 'point', 'area', 'text']);
    expect(s[0].color).toBe('#e0532f');
    expect(s[0].coords[0][0]).toBeCloseTo(p.unproject(100, 100)[0], 9);
    expect(s[0].coords[0][1]).toBeCloseTo(p.unproject(100, 100)[1], 9);
    expect(s[2].label).toBe('Старт');

    first.unmount();
    const { container } = mount();
    const svg = layer(container);
    expect(svg.querySelectorAll('polyline')).toHaveLength(2);
    expect(svg.querySelectorAll('polyline[marker-end]')).toHaveLength(1);
    expect(svg.querySelectorAll('polygon')).toHaveLength(1);
    expect(svg.textContent).toContain('Старт');
    expect(svg.textContent).toContain('Сад');
    const [x, y] = p.project(s[0].coords[0][0], s[0].coords[0][1]);
    expect(svg.querySelector('polyline')!.getAttribute('points')!.startsWith(`${x.toFixed(1)},${y.toFixed(1)}`)).toBe(true);
  });

  it('Then лінія з однієї точки не зберігається; точка/текст без підпису — підказка', () => {
    const { container } = mount(); open();
    tool('Лінія'); tap(container, 100, 100); tool('Готово');
    expect(saved()).toEqual([]);
    tool('Текст'); tap(container, 100, 100);
    expect(screen.getByRole('alert').textContent).toMatch(/Підпис/);
    expect(saved()).toEqual([]);
  });
});

describe('Given малюнки; When скасувати й видалити', () => {
  it('Then «Скасувати» знімає останню дію, «Видалити» — обрану фігуру', () => {
    const { container } = mount(); open();
    fireEvent.change(screen.getByLabelText('Підпис'), { target: { value: 'A' } });
    tool('Точка'); tap(container, 10, 10); tap(container, 20, 20); tap(container, 30, 30);
    expect(saved()).toHaveLength(3);
    tool('Скасувати');
    expect(saved()).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /Видалити/ })[0]);
    expect(saved()).toHaveLength(1);
    tool('Скасувати');
    expect(saved()).toHaveLength(2);
  });
  it('Then «Скасувати» під час малювання лінії знімає останню вершину', () => {
    const { container } = mount(); open();
    tool('Лінія'); tap(container, 10, 10); tap(container, 20, 20); tap(container, 30, 30);
    tool('Скасувати'); tool('Готово');
    expect(saved()[0].coords).toHaveLength(2);
  });
});

describe('Given малюнки; When експорт / імпорт', () => {
  it('Then експорт GeoJSON і KML — файли в браузері, без мережі', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { container } = mount(); open();
    tool('Лінія'); tap(container, 100, 100); tap(container, 200, 150); tool('Готово');
    tool('Експорт GeoJSON'); tool('Експорт KML');
    expect(clickSpy).toHaveBeenCalledTimes(2);
    const gj = JSON.parse(await blobs[0].text());
    expect(gj.type).toBe('FeatureCollection');
    expect(gj.features[0].geometry.type).toBe('LineString');
    expect(await blobs[1].text()).toContain('<LineString>');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Then імпорт GeoJSON додає фігури й зберігає їх', async () => {
    mount(); open();
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Точка' }, geometry: { type: 'Point', coordinates: [30.5, 50.4] } }] };
    const f = new File([JSON.stringify(fc)], 'a.geojson', { type: 'application/geo+json' });
    fireEvent.change(screen.getByLabelText('Імпорт GeoJSON'), { target: { files: [f] } });
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0]).toMatchObject({ kind: 'point', coords: [[50.4, 30.5]], label: 'Точка' });
  });

  it('Then не GeoJSON — повідомлення, малюнки не змінюються', async () => {
    mount(); open();
    const f = new File(['{"a":1}'], 'a.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Імпорт GeoJSON'), { target: { files: [f] } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/GeoJSON/);
    expect(saved()).toEqual([]);
  });
});

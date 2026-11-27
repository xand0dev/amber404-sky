import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Overlay } from './Overlay';
import { loadOverlay, saveOverlay } from './store';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Given власна карта-підкладка (SPEC §7.14)', () => {
  it('Then окремий canvas під полем погоди в mapwrap, перед картою F3', () => {
    const { container } = render(<main className="mapwrap"><Overlay /><canvas className="map" /></main>);
    const under = container.querySelector('canvas.underlay');
    expect(under).not.toBeNull();
    expect(under!.compareDocumentPosition(container.querySelector('canvas.map')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Then панель: файл png/jpg, 3 точки прив\'язки, прозорість 0–100%, позначка assumption', () => {
    render(<main className="mapwrap"><Overlay /></main>);
    fireEvent.click(screen.getByRole('button', { name: 'Підкладка' }));
    expect(screen.getByLabelText('Файл карти').getAttribute('accept')).toBe('image/png,image/jpeg');
    for (const i of [1, 2, 3]) expect(screen.getByLabelText(`Точка ${i}: широта`)).toBeTruthy();
    const r = screen.getByLabelText('Прозорість погоди') as HTMLInputElement;
    expect([r.min, r.max]).toEqual(['0', '100']);
    expect(screen.getByText(/assumption/)).toBeTruthy();
    expect(screen.getByText(/не покидає браузер/)).toBeTruthy();
  });

  it('Given прозорість 30%; Then поле погоди (.map) має opacity 0.7', () => {
    const { container } = render(<main className="mapwrap"><Overlay /></main>);
    fireEvent.click(screen.getByRole('button', { name: 'Підкладка' }));
    fireEvent.change(screen.getByLabelText('Прозорість погоди'), { target: { value: '30' } });
    expect((container.querySelector('.mapwrap') as HTMLElement).style.getPropertyValue('--wx-op')).toBe('0.7');
  });

  it('Given 3 точки на одній прямій; When «Накласти»; Then помилка, без мережі', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<main className="mapwrap"><Overlay /></main>);
    fireEvent.click(screen.getByRole('button', { name: 'Підкладка' }));
    const set = (l: string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    [[0, 0, 50, 30], [10, 10, 49.9, 30.1], [20, 20, 49.8, 30.2]].forEach(([x, y, la, lo], i) => {
      set(`Точка ${i + 1}: x`, String(x)); set(`Точка ${i + 1}: y`, String(y));
      set(`Точка ${i + 1}: широта`, String(la)); set(`Точка ${i + 1}: довгота`, String(lo));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Накласти' }));
    expect(screen.getByRole('alert').textContent).toMatch(/одній прямій/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Given браузер без IndexedDB; Then збереження не падає, завантаження — null', () => {
  it('saveOverlay / loadOverlay', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(saveOverlay({ image: new Blob(['x']), anchors: [], opacity: 50 })).resolves.toBe(false);
    await expect(loadOverlay()).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

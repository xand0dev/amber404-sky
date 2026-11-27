// F3-AC7: кнопка 📷 — доступне ім'я, збирає PNG і віддає його в deliver, статус у aria-live.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx } from '../../app/state';
import { bundle, state } from './fixture.test-util';

let release: (b: Blob) => void = () => {};
vi.mock('./compose', () => ({ composeSnapshot: vi.fn(() => new Promise<Blob>((res) => { release = res; })) }));
const deliverMock = vi.fn().mockResolvedValue('downloaded');
vi.mock('./snapshot', async (orig) => ({ ...(await orig<typeof import('./snapshot')>()), deliver: (...a: unknown[]) => deliverMock(...a) }));

import { SnapButton } from './SnapButton';
afterEach(cleanup);

const show = () => render(<AppCtx.Provider value={{ data: bundle(), s: state(), set: () => {} } as Ctx}><div className="mapwrap"><canvas className="map" /><SnapButton reduce={false} /></div></AppCtx.Provider>);

describe('Given карта; When 📷', () => {
  it('кнопка має доступне ім’я', () => {
    show();
    expect(screen.getByRole('button', { name: 'Знімок карти' }).textContent).toContain('📷');
  });
  it('під час збирання кнопка неактивна, далі PNG іде в deliver і статус оголошено', async () => {
    show();
    const b = screen.getByRole('button', { name: 'Знімок карти' });
    fireEvent.click(b);
    expect(b).toHaveProperty('disabled', true);
    await act(async () => { release(new Blob(['x'], { type: 'image/png' })); });
    expect(deliverMock).toHaveBeenCalledTimes(1);
    expect(deliverMock.mock.calls[0][1]).toMatch(/^amber-sky-\d{4}-\d{2}-\d{2}-\d{4}\.png$/);
    expect(b).toHaveProperty('disabled', false);
    expect(screen.getByRole('status').textContent).toBe('Знімок збережено');
  });
});

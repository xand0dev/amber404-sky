// F3-AC5: reduced motion → замість частинок статичні стрілки; без нього — canvas частинок, що не заважає кліку.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppCtx, type Ctx } from '../../app/state';
import { MapView } from './MapView';
import { LANG_KEY, LangProvider } from '../../app/lang';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundle, state } from './fixture.test-util';

let reduce = false;
const listeners = new Set<() => void>();
beforeEach(() => {
  listeners.clear();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() { return q.includes('reduce') && reduce; }, media: q,
    addEventListener: (_: string, f: () => void) => listeners.add(f), removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const show = () => render(<AppCtx.Provider value={{ data: bundle(), s: state(), set: () => {} } as Ctx}><MapView /></AppCtx.Provider>);

describe('Given prefers-reduced-motion', () => {
  it('reduce → canvas частинок немає (стрілки на полі)', () => {
    reduce = true;
    const { container } = show();
    expect(container.querySelector('canvas.wind-particles')).toBeNull();
  });
  it('без reduce → canvas частинок є, прихований від читачів екрана й не перехоплює кліки', () => {
    reduce = false;
    const { container } = show();
    const cv = container.querySelector<HTMLCanvasElement>('canvas.wind-particles');
    expect(cv).not.toBeNull();
    expect(cv?.getAttribute('aria-hidden')).toBe('true');
    expect(cv?.style.pointerEvents).toBe('none');
  });
  it('зміна налаштування на льоту перемикає режим', () => {
    reduce = false;
    const { container } = show();
    expect(container.querySelector('canvas.wind-particles')).not.toBeNull();
    reduce = true;
    act(() => listeners.forEach((f) => f()));
    expect(container.querySelector('canvas.wind-particles')).toBeNull();
  });
});

describe('Given наведення миші на карту (F3-AC6)', () => {
  const hover = (pointerType: string, x = 200, y = 150) => {
    reduce = true;
    const { container } = show();
    const cv = container.querySelector<HTMLCanvasElement>('canvas.map')!;
    cv.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(cv, { pointerType, clientX: x, clientY: y });
    return cv;
  };
  it('рух миші → підказка: вітер, пориви, температура, видимість, вердикт', () => {
    hover('mouse');
    const tip = screen.getByRole('tooltip');
    for (const t of ['Вітер 50 м', 'Пориви', 'Темп.', 'Видимість', 'Вердикт']) expect(tip.textContent).toContain(t);
    expect(tip.textContent).toMatch(/м\/с/);
  });
  it('миша пішла з карти → підказки немає', () => {
    const cv = hover('mouse');
    fireEvent.pointerLeave(cv, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('дотик (телефон) → підказки немає, тап обирає точку', () => {
    hover('touch');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('курсор поза сіткою → підказки немає', () => {
    hover('mouse', 2, 2);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

// Issue #116: EN — доступне ім'я карти англійською.
describe('Given EN (issue #116)', () => {
  afterEach(() => localStorage.clear());
  it('Then canvas.map — «Map: tap to pick a point»', () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<LangProvider><AppCtx.Provider value={{ data: bundle(), s: state(), set: () => {} } as Ctx}><MapView /></AppCtx.Provider></LangProvider>);
    expect(document.querySelector('canvas.map')?.getAttribute('aria-label')).toBe('Map: tap to pick a point');
  });
});

// Issue #167 AC4: пульсуюче бурштинове кільце обраної точки — окремий шар над картою; reduced-motion — статичне.
describe('Given обрана точка (issue #167)', () => {
  const CSS = readFileSync(join(process.cwd(), 'src/features/map/pulse.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  it('шар кільця є, прихований від читачів екрана', () => {
    reduce = false;
    const { container } = show();
    const p = container.querySelector('.pulse');
    expect(p).not.toBeNull();
    expect(p?.getAttribute('aria-hidden')).toBe('true');
    expect(p?.querySelector('.pulse-ring')).not.toBeNull();
  });
  it('CSS: анімація бурштиновим токеном, reduced-motion — без анімації, уночі — червоне', () => {
    expect(CSS).toMatch(/@keyframes/);
    expect(CSS).toMatch(/var\(--cau\)/);
    expect(CSS).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none/);
    expect(CSS).toMatch(/data-theme="night"[\s\S]*var\(--ink\)/);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,6}\b/i); // лише токени (#88)
  });
});

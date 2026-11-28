// #168 AC3, AC5: шлейф стирається при зміні вигляду; прихована вкладка — анімація на паузі.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AppCtx, type Ctx } from '../../app/state';
import { ViewCtx } from '../../app/view/view';
import { FULL_VIEW, type View } from '../../core';
import { WindParticles } from './WindParticles';
import { bundle, state } from './fixture.test-util';

let frames: FrameRequestCallback[] = [];
let hidden = false;
const ctx = {
  clearRect: vi.fn(), fillRect: vi.fn(), setTransform: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  strokeStyle: '', fillStyle: '', globalCompositeOperation: '', lineWidth: 0, lineCap: '',
};

beforeEach(() => {
  frames = []; hidden = false;
  Object.values(ctx).forEach((f) => typeof f === 'function' && f.mockClear());
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { delete frames[id - 1]; });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Запустити всі кадри, що чекають, і повернути, скільки їх було. */
const tick = (t: number) => {
  const pending = frames.filter(Boolean); frames = [];
  act(() => pending.forEach((f) => f(t)));
  return pending.length;
};

const tree = (view: View) => (
  <AppCtx.Provider value={{ data: bundle(), s: state(), set: () => {} } as unknown as Ctx}>
    <ViewCtx.Provider value={{ view, setView: () => {} }}><WindParticles /></ViewCtx.Provider>
  </AppCtx.Provider>
);

describe('Given частинки летять', () => {
  it('When вигляд не змінюється — Then шлейф лише згасає, не стирається повністю', () => {
    render(tree(FULL_VIEW));
    tick(16); tick(32); tick(48);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled(); // згасання попереднього кадру
  });
  it('When панорамування чи масштаб — Then у наступному кадрі шлейф стерто (clearRect на весь canvas)', () => {
    const r = render(tree(FULL_VIEW));
    tick(16); tick(32);
    r.rerender(tree({ ...FULL_VIEW, zoom: 2 }));
    tick(48);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 300);
    ctx.clearRect.mockClear();
    r.rerender(tree({ ...FULL_VIEW, zoom: 2, lon: FULL_VIEW.lon + 1 }));
    tick(64);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });
});

describe('Given вкладка прихована (visibilitychange)', () => {
  it('Then нових кадрів немає; після повернення анімація відновлюється', () => {
    render(tree(FULL_VIEW));
    expect(tick(16)).toBe(1);
    hidden = true;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(tick(32)).toBe(0);
    expect(tick(48)).toBe(0);
    hidden = false;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(tick(64)).toBe(1);
  });
  it('Then прихована з самого початку — анімація не стартує', () => {
    hidden = true;
    render(tree(FULL_VIEW));
    expect(tick(16)).toBe(0);
  });
});

// Спільний стан вигляду карти (issue #64): центр і масштаб. Шари (MapView, Overlay, ZoneLayer) беруть проєкцію з core/projection.ts за цим виглядом.
// Issue #174: setView — плавний перехід (кнопки, «Де я», місто, тур), jump — миттєво (колесо, щипок, перетягування).
import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { FULL_VIEW, type View } from '../../core';
import { createViewAnimator } from './anim';

export interface ViewState {
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  /** Миттєва зміна для жестів; без неї — setView. */
  jump?: Dispatch<SetStateAction<View>>;
}
export const ViewCtx = createContext<ViewState>({ view: FULL_VIEW, setView: () => {} });
export const useView = (): ViewState => useContext(ViewCtx);

const REDUCED = '(prefers-reduced-motion: reduce)';
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches;
const raf = (f: FrameRequestCallback) => requestAnimationFrame(f);
const caf = (id: number) => cancelAnimationFrame(id);
const now = () => performance.now();

/** Стан вигляду з плавними переходами (issue #174) — для ViewCtx.Provider. */
export function useViewState(init: View = FULL_VIEW): ViewState {
  const [view, setRaw] = useState(init);
  const [anim] = useState(() => {
    let cur = init; // те, що зараз на екрані (state відстає на рендер)
    return createViewAnimator({ get: () => cur, set: (v) => { cur = v; setRaw(v); }, raf, caf, now, reduced });
  });
  useEffect(() => anim.cancel, [anim]);
  return useMemo(() => ({ view, setView: anim.to, jump: anim.jump }), [view, anim]);
}

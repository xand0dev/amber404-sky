// Issue #85 (F3): рамка карти для телефона — тонкий ряд інструментів над картою (≤ 48 px) і меню «⋯» для решти.
// Кнопки живуть у своїх компонентах (Малювання, Підкладка, Зона — F0; Знімок — F3) і переносяться в ряд через портал,
// тож карта нічим не закрита згори. Без рамки (окремі тести компонентів) InBar рендерить кнопку на місці.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './mapframe.css';

interface Slots { bar: HTMLElement | null; more: HTMLElement | null; wrap: HTMLElement | null }
const SlotsCtx = createContext<Slots>({ bar: null, more: null, wrap: null });

/** mapwrap карти — для жестів і знімка, коли їхні кнопки перенесено в ряд. */
export const useMapWrap = () => useContext(SlotsCtx).wrap;

/** Переносить кнопку в ряд над картою (bar) або в меню «⋯» (more). */
export function InBar({ slot = 'bar', children }: { slot?: 'bar' | 'more'; children: ReactNode }) {
  const el = useContext(SlotsCtx)[slot];
  return el ? createPortal(children, el) : <>{children}</>;
}

export function MapFrame({ children }: { children: ReactNode }) {
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [more, setMore] = useState<HTMLDivElement | null>(null);
  const [wrap, setWrap] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  // Вибір у меню закриває його (портал: React-події йдуть деревом компонентів, тож слухаємо DOM).
  useEffect(() => {
    if (!more) return;
    const close = (e: MouseEvent) => { if ((e.target as Element).closest('button')) setOpen(false); };
    more.addEventListener('click', close);
    return () => more.removeEventListener('click', close);
  }, [more]);

  return (
    <SlotsCtx.Provider value={{ bar, more, wrap }}>
      <div className="mapbarwrap">
        <div ref={setBar} className="mapbar" role="toolbar" aria-label="Інструменти карти">
          <button type="button" className="morebtn" aria-label="Ще інструменти" title="Ще інструменти" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span aria-hidden="true">⋯</span>
          </button>
        </div>
        <div ref={setMore} className="mapmore" hidden={!open} />
      </div>
      <main ref={setWrap} className="mapwrap">{children}</main>
    </SlotsCtx.Provider>
  );
}

// Issue #166 AC2–AC3: онбординг першого відкриття — 3 картки поверх карти з підсвіткою місця інтерфейсу.
// Прапорець у localStorage (core/tour); «Пропустити», Esc і «Почати» закривають; повтор — «⋯» → «Як це працює».
// Діалог aria-modal з фокус-пасткою; картка ставиться поруч із підсвіченим місцем, не перекриваючи його (placeCard).
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../lang';
import { InBar } from '../../ui/MapFrame';
import { TOUR_STEPS, markTourSeen, placeCard, tourSeen, type Rect } from '../../core/tour';
import './onboarding.css';

const store = () => (typeof localStorage === 'undefined' ? null : localStorage);
const ON = 'tour-on';

/** Перший видимий елемент зі списку селекторів кроку; якщо видимих немає — перший знайдений. */
function target(sels: readonly string[]): Element | null {
  const els = sels.map((s) => document.querySelector(s)).filter((e): e is Element => e != null);
  return els.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? els[0] ?? null;
}

export function Onboarding() {
  const { t } = useT();
  const [step, setStep] = useState<number | null>(() => { const s = store(); return s && tourSeen(s) ? null : 0; });
  const back = useRef<HTMLElement | null>(null);
  const open = (n: number) => { back.current = document.activeElement as HTMLElement | null; setStep(n); };
  const close = useCallback(() => {
    const s = store();
    if (s) markTourSeen(s);
    setStep(null);
    back.current?.focus?.();
  }, []);
  return (
    <>
      <InBar slot="more"><button type="button" className="tourbtn" onClick={() => open(0)}>{t('tour.menu')}</button></InBar>
      {step != null && createPortal(<Card step={step} setStep={setStep} close={close} />, document.body)}
    </>
  );
}

function Card({ step, setStep, close }: { step: number; setStep: (n: number) => void; close: () => void }) {
  const { t } = useT();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const last = step === TOUR_STEPS.length - 1;

  // Підсвітка: клас на цілі, рамка й затемнення навколо; картка — поруч, не перекриваючи ціль.
  useLayoutEffect(() => {
    const el = target(TOUR_STEPS[step].targets);
    el?.classList.add(ON);
    el?.scrollIntoView?.({ block: 'nearest' });
    const place = () => {
      const r = el?.getBoundingClientRect();
      const rect = r && r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
      const c = box.current?.getBoundingClientRect();
      setSpot(rect);
      setPos(placeCard(rect, { w: window.innerWidth, h: window.innerHeight }, { w: c?.width ?? 0, h: c?.height ?? 0 }));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      el?.classList.remove(ON);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [step]);
  useEffect(() => { primary.current?.focus(); }, [step]);

  // Esc — закрити; Tab / Shift+Tab — по колу всередині діалогу.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('button')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
      e.preventDefault();
      f[n].focus();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [close]);

  return (
    <div className="tour">
      <div className="tour-back" />
      {spot && <div className="tour-spot" style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }} />}
      <div ref={box} className="tour-card" role="dialog" aria-modal="true" aria-label={t('tour.label')} aria-describedby={`${id}-t`}
        style={pos ? { left: pos.x, top: pos.y } : { opacity: 0 }}>
        <p className="tour-n">{t('tour.step', { n: String(step + 1), total: String(TOUR_STEPS.length) })}</p>
        <p id={`${id}-t`} className="tour-t">{t(TOUR_STEPS[step].key)}</p>
        <div className="tour-act">
          <button type="button" onClick={close}>{t('tour.skip')}</button>
          <button ref={primary} type="button" className="btn-primary" onClick={() => (last ? close() : setStep(step + 1))}>
            {t(last ? 'tour.start' : 'tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

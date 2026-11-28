// Issue #169: «▶ Демо» — автоматичний 30-секундний тур SPEC §3 на живих даних (логіка кроків — core/demo.ts).
// Кнопка в меню «⋯» або ?demo=1. Тур лише змінює стан екрана; будь-який дотик, коліщатко чи клавіша зупиняє його
// й лишає все як є. Підпис унизу — значення з даних; джерело nodata → «немає даних», без чисел.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, type AppState } from '../../app/state';
import { useView } from '../../app/view/view';
import { useVerdicts } from '../../app/useVerdict';
import { useT } from '../../app/lang';
import { humanWindow, useNow } from '../../app/when';
import { InBar } from '../../ui/MapFrame';
import {
  DEMO_STEPS, demoCaption, demoFrame, demoPatch, demoPoint, demoViewAt, isDemoUrl,
  type DemoFrame, type DemoStepId, type SrcStatus, type View,
} from '../../core';
import './tour.css';

/** Крок таймера: 50 мс — плавний перехід вигляду без зайвих перемальовувань. */
const TICK_MS = 50;
/** Що прокрутити у видиму частину на кроці (телефон: панель і смуга годин — під картою). */
const SCROLL: Record<DemoStepId, string> = { wind: '.mapwrap', go: '.mapwrap', point: '.panel .point', play: '.tl', space: '.panel .climate' };
const STOP_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;

const sameView = (a: View, b: View) => a.lat === b.lat && a.lon === b.lon && a.zoom === b.zoom;
const search = () => (typeof location === 'undefined' ? '' : location.search);
/** prefers-reduced-motion — без анімації вигляду й прокрутки. */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DemoTour() {
  const { t } = useT();
  const [startAt, setStartAt] = useState<number | null>(() => (isDemoUrl(search()) ? Date.now() : null));
  const [frame, setFrame] = useState<DemoFrame | null>(null);
  const running = startAt != null;
  return (
    <>
      <InBar slot="more"><button type="button" className="demobtn" onClick={() => setStartAt(Date.now())}>{t('demo.menu')}</button></InBar>
      {running && <Runner startAt={startAt} frame={frame} setFrame={setFrame} stop={() => { setStartAt(null); setFrame(null); }} />}
    </>
  );
}

function Runner({ startAt, frame, setFrame, stop }: { startAt: number; frame: DemoFrame | null; setFrame: (f: DemoFrame | null) => void; stop: () => void }) {
  const { data, s, set } = useApp();
  const { view, setView } = useView();
  const [reduce] = useState(reducedMotion);
  const point = demoPoint(data.cities);
  const n = data.meta.times.length;
  // Свіжі значення для таймера без перезапуску інтервалу.
  const live = useRef({ s, view, set, setView, stop, reduce });
  useLayoutEffect(() => { live.current = { s, view, set, setView, stop, reduce }; });

  // Кроки: щотику — кадр за часом від старту; стан змінюємо лише коли значення справді інше.
  useEffect(() => {
    const step = () => {
      const L = live.current;
      const f = demoFrame(Date.now() - startAt);
      if (!f) { L.stop(); return; }
      setFrame(f);
      const p = demoPatch(f.id, f.t, point, n);
      if ((Object.keys(p) as (keyof typeof p)[]).some((k) => L.s[k as keyof AppState] !== p[k])) L.set(p as Partial<AppState>);
      const v = demoViewAt(f.id, f.t, point, L.reduce);
      if (v && !sameView(v, L.view)) L.setView(v);
    };
    step();
    const id = setInterval(step, TICK_MS);
    return () => clearInterval(id);
  }, [startAt, point?.lat, point?.lon, n, setFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Будь-який дотик, коліщатко чи клавіша — людина бере керування, стан лишається.
  useEffect(() => {
    const halt = () => live.current.stop();
    for (const e of STOP_EVENTS) window.addEventListener(e, halt, true);
    return () => { for (const e of STOP_EVENTS) window.removeEventListener(e, halt, true); };
  }, []);

  // Показати потрібне місце екрана на новому кроці.
  const id = frame?.id;
  useEffect(() => {
    if (!id) return;
    document.querySelector(SCROLL[id])?.scrollIntoView?.({ block: 'nearest', behavior: live.current.reduce ? 'auto' : 'smooth' });
  }, [id]);

  return frame ? createPortal(<Caption frame={frame} onSkip={stop} />, document.body) : null;
}

function Caption({ frame, onSkip }: { frame: DemoFrame; onSkip: () => void }) {
  const { data } = useApp();
  const { lang, t } = useT();
  const { wx, now, window } = useVerdicts();
  const nowMs = useNow();
  const last = data.meta.times[data.meta.times.length - 1];
  const st = (id: string, has = true): SrcStatus => (has ? data.meta.sources.find((x) => x.id === id)?.status ?? 'ok' : 'nodata');
  const text = demoCaption(frame.id, lang, {
    forecast: st('openmeteo'), galileo: st('celestrak-galileo', !!data.galileo), climate: st('era5', !!data.climate),
    level: now?.level, reason: now?.reasons[0], window: now ? t('demo.window', { w: humanWindow(window, last, nowMs, lang) }) : undefined,
    galVisible: wx.galVisible, galPdop: wx.galPdop,
  });
  return (
    <div className="demo-cap" role="region" aria-label={t('demo.label')}>
      <div className="demo-bar" aria-hidden="true"><span style={{ width: `${((frame.step + frame.t) / DEMO_STEPS.length) * 100}%` }} /></div>
      <p className="demo-n">{t('tour.step', { n: String(frame.step + 1), total: String(DEMO_STEPS.length) })} · {t('demo.stop')}</p>
      <p key={frame.id} className="demo-t" aria-live="polite">{text}</p>
      <button type="button" className="demo-skip" onClick={onSkip}>{t('tour.skip')}</button>
    </div>
  );
}

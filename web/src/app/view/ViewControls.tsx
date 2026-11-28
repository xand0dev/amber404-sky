// Масштаб карти (issue #64): pinch, колесо, перетягування, кнопки + / −, «До зони», «Україна».
// Жести слухаємо на mapwrap; клік після перетягування гасимо, тап без руху, як і раніше, обирає точку (MapView, F3).
import { useEffect, useRef } from 'react';
import { FULL_VIEW, fitView, gestureStep, zoomAt } from '../../core';
import { useZone } from '../zone/ZoneLayer';
import { useView } from './view';
import { useT } from '../lang';
import { InBar, useMapWrap } from '../../ui/MapFrame';
import './view.css';

/** Рух, після якого дотик — уже перетягування, а не тап (px). assumption. */
const TAP_PX = 6;
/** Поля навколо контуру зони — 15% з кожного боку (issue #64). */
const ZONE_PAD = 0.15;
const BTN_FACTOR = 2;
/** «До зони» показує щонайменше ±MIN_KM навколо точки: коли зони немає (вітер понад ліміт) чи вона крихітна, карта
 *  не наближається до суцільного кольору без кордонів і міст (issue #89). assumption — видно місто й сусідні дороги. */
const MIN_KM = 20;

type XY = [number, number];

export function ViewControls() {
  const ref = useRef<HTMLDivElement>(null);
  const { setView } = useView();
  const z = useZone();
  const { t } = useT();
  // Кнопки — у ряду над картою (issue #85), тож жести слухаємо на mapwrap з рамки; без рамки — на батьківському елементі.
  const frame = useMapWrap();

  useEffect(() => {
    const wrap = frame ?? ref.current?.parentElement;
    if (!wrap) return;
    const size = (): [number, number] => [wrap.clientWidth, wrap.clientHeight];
    const local = (e: MouseEvent): XY => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const pts = new Map<number, XY>();
    let start: XY | null = null, dragged = false;

    const down = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return; // кнопки й панелі над картою — не жест
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) { start = p; dragged = false; } else dragged = true;
    };
    const move = (e: PointerEvent) => {
      const old = pts.get(e.pointerId);
      if (!old) return;
      const p = local(e);
      if (start && Math.hypot(p[0] - start[0], p[1] - start[1]) > TAP_PX) dragged = true;
      if (!dragged) return;
      const prev = [...pts.values()].slice(0, 2);
      pts.set(e.pointerId, p);
      const next = [...pts.values()].slice(0, 2);
      const [W, H] = size();
      setView((v) => gestureStep(v, W, H, prev, next));
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (!pts.size) start = null; };
    // Клік після перетягування чи pinch не має обирати точку.
    const click = (e: MouseEvent) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } };
    const wheel = (e: WheelEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const [W, H] = size(), [x, y] = local(e);
      setView((v) => zoomAt(v, W, H, Math.exp(-dy * 0.002), x, y));
    };

    wrap.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    wrap.addEventListener('click', click, true);
    wrap.addEventListener('wheel', wheel, { passive: false });
    return () => {
      wrap.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      wrap.removeEventListener('click', click, true);
      wrap.removeEventListener('wheel', wheel);
    };
  }, [setView, frame]);

  const size = (): [number, number] => {
    const wrap = frame ?? ref.current?.parentElement;
    return wrap ? [wrap.clientWidth, wrap.clientHeight] : [0, 0];
  };
  const zoomBy = (f: number) => { const [W, H] = size(); setView((v) => zoomAt(v, W, H, f, W / 2, H / 2)); };
  const toZone = () => {
    if (!z) return;
    const [W, H] = size();
    const dLat = MIN_KM / 111, dLon = MIN_KM / (111 * Math.cos((z.lat * Math.PI) / 180));
    const box: XY[] = [[z.lat - dLat, z.lon - dLon], [z.lat + dLat, z.lon + dLon]];
    setView(fitView([[z.lat, z.lon], ...box, ...z.points.map((q): XY => [q.lat, q.lon])], W, H, ZONE_PAD));
  };

  return (
    <InBar>
      <div ref={ref} className="viewctl" role="group" aria-label={t('view.group')}>
        <button type="button" aria-label={t('view.in')} onClick={() => zoomBy(BTN_FACTOR)}>+</button>
        <button type="button" aria-label={t('view.out')} onClick={() => zoomBy(1 / BTN_FACTOR)}>−</button>
        <button type="button" aria-label={t('view.zone')} title={t('view.zone')} onClick={toZone} disabled={!z}>◎</button>
        <button type="button" aria-label={t('view.full')} title={t('view.fullTitle')} onClick={() => setView(FULL_VIEW)}>⤢</button>
      </div>
    </InBar>
  );
}

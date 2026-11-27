// Шар «Зона польоту» (SPEC §7.5b, issue #22): контур туди й назад, кільця відстаней, стрілка вітру, червоні точки обриву.
// Окремий canvas над полем погоди (MapView, F3), проєкція — спільна з core/projection.ts. Кліки проходять до карти.
import { useEffect, useMemo, useRef, useState } from 'react';
import { fromUV, makeProjection } from '../../core';
import { useApp } from '../state';
import { useTheme } from '../theme';
import { useView } from '../view/view';
import { zoneFor, zoneShapes, type ZoneState } from './model';
import './zone.css';

/** Зона для обраної точки, висоти, години й дрона; null — немає профілю дрона. */
export function useZone(): ZoneState | null {
  const { data, s } = useApp();
  const { lat, lon, altM, hour, droneId } = s;
  return useMemo(() => zoneFor(data, { lat, lon, altM, hour, droneId }), [data, lat, lon, altM, hour, droneId]);
}

const MIN_RING_PX = 14;
const km = (m: number) => (m >= 10_000 ? `${Math.round(m / 1000)} км` : `${+(m / 1000).toFixed(1)} км`);

export function ZoneLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(true);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const z = useZone();
  const { colors } = useTheme();
  const { view } = useView();

  // Розмір шару = розмір mapwrap.
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const upd = () => setSize([cv.clientWidth, cv.clientHeight]);
    upd();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', upd); return () => window.removeEventListener('resize', upd); }
    const ro = new ResizeObserver(upd);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const [W, H] = size, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    if (!on || !z || !W || !H) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sh = zoneShapes(z, makeProjection(W, H, view));
    const path = (pts: [number, number][]) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

    // Кільця відстаней — пунктир із підписом на півночі; на дрібному масштабі не малюємо, щоб не злипались.
    const rings = sh.rings.filter((r) => sh.center[1] - r.pts[0][1] >= MIN_RING_PX);
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = colors.ink; ctx.globalAlpha = 0.55;
    for (const r of rings) { path(r.pts); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = colors.ink;
    for (const r of rings) { const [x, y] = r.pts[0]; ctx.fillText(km(r.distM), x, y - 3); }

    // Контур зони туди й назад.
    if (z.maxDistM > 0) {
      path(sh.contour);
      ctx.fillStyle = colors.cau; ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.base; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = colors.cau; ctx.lineWidth = 2; ctx.stroke();
    }

    // Промені, що обірвались на ліміті вітру, — червона точка.
    ctx.fillStyle = colors.no; ctx.strokeStyle = colors.base; ctx.lineWidth = 1;
    for (const [x, y] of sh.dots) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }

    // Стрілка вітру від точки старту — куди дме.
    if (sh.arrow) {
      const [[x0, y0], [x1, y1]] = sh.arrow, a = Math.atan2(y1 - y0, x1 - x0);
      const draw = () => {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.moveTo(x1 - Math.cos(a - 0.5) * 8, y1 - Math.sin(a - 0.5) * 8); ctx.lineTo(x1, y1);
        ctx.lineTo(x1 - Math.cos(a + 0.5) * 8, y1 - Math.sin(a + 0.5) * 8); ctx.stroke();
      };
      ctx.lineCap = 'round';
      ctx.strokeStyle = colors.base; ctx.lineWidth = 5; draw();
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 2.5; draw();
    }
  }, [on, z, size, colors, view]);

  const ws = z?.wind ? fromUV(z.wind[0], z.wind[1])[0] : null;
  return (
    <>
      <canvas ref={ref} className="zone" aria-hidden="true" hidden={!on} />
      <button type="button" className="zonebtn" aria-pressed={on} onClick={() => setOn(!on)}>Зона</button>
      {on && z && (
        <p className="zonecap">
          <b>Зона туди й назад</b> {z.maxDistM > 0 ? `до ${km(z.maxDistM)}` : 'відсутня'} · {z.enduranceMin.toFixed(1)} хв ({z.why}) − резерв 20% · {z.prof.cruiseMs} м/с
          {' · '}{ws == null ? 'немає даних про вітер' : `вітер ${ws.toFixed(1)} м/с`}
          {z.cut.length > 0 && <> · <span className="zonedot" aria-hidden="true" /> вітер понад ліміт {z.prof.windMs} м/с</>}
          {' · '}assumption
        </p>
      )}
    </>
  );
}

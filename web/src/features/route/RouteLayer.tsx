// F4: маршрут на карті. A — обрана точка, B — тап по карті в режимі «Обрати B». Лінія A → B, мітка B, відстань.
// Окремий canvas над картою (як шар зони); у режимі вибору — прозорий шар ловить один тап.
import { useEffect, useRef, useState } from 'react';
import { distanceM, makeProjection } from '../../core';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { useTheme } from '../../app/theme';
import { useView } from '../../app/view/view';
import { pt as tr } from '../panel/strings';
import { setRoute, useRoute } from './routeStore';
import './route.css';

const inBox = (lat: number, lon: number) => lat >= 44 && lat <= 52.5 && lon >= 22 && lon <= 40.5;

export function RouteLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const { s } = useApp();
  const { lang } = useT();
  const { colors } = useTheme();
  const { view } = useView();
  const { b, picking } = useRoute();

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
    if (!b || !W || !H) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { project } = makeProjection(W, H, view);
    const [ax, ay] = project(s.lat, s.lon), [bx, by] = project(b.lat, b.lon);
    const ang = Math.atan2(by - ay, bx - ax);
    // Лінія: темна підкладка + світла пунктирна, щоб читалась на будь-якому полі.
    ctx.lineCap = 'round';
    ctx.strokeStyle = colors.base; ctx.lineWidth = 6; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = colors.ink; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    // Стрілка напрямку посередині.
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (Math.hypot(bx - ax, by - ay) > 40) {
      ctx.fillStyle = colors.ink; ctx.beginPath();
      ctx.moveTo(mx + Math.cos(ang) * 8, my + Math.sin(ang) * 8);
      ctx.lineTo(mx + Math.cos(ang + 2.5) * 8, my + Math.sin(ang + 2.5) * 8);
      ctx.lineTo(mx + Math.cos(ang - 2.5) * 8, my + Math.sin(ang - 2.5) * 8);
      ctx.closePath(); ctx.fill();
    }
    // Мітки A і B.
    const tag = (x: number, y: number, t: string) => {
      ctx.fillStyle = colors.ink; ctx.strokeStyle = colors.base; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = colors.base; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t, x, y + 0.5);
    };
    tag(ax + 14, ay - 14, 'A');
    tag(bx, by, 'B');
    // Відстань біля середини.
    const km = `${(distanceM({ lat: s.lat, lon: s.lon }, b) / 1000).toFixed(1)} ${tr('unit.km', lang)}`;
    ctx.font = '600 12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.save(); ctx.shadowColor = colors.base; ctx.shadowBlur = 4; ctx.fillStyle = colors.ink;
    ctx.fillText(km, mx + 8, my - 6); ctx.fillText(km, mx + 8, my - 6);
    ctx.restore();
  }, [b, s.lat, s.lon, size, view, colors, lang]);

  return (
    <>
      <canvas ref={ref} className="routecv" aria-hidden="true" />
      {picking && (
        <div className="routepick" data-testid="route-pick"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const [lat, lon] = makeProjection(r.width, r.height, view).unproject(e.clientX - r.left, e.clientY - r.top);
            if (inBox(lat, lon)) setRoute({ b: { lat, lon }, picking: false });
          }}>
          <p className="routebanner" role="status">
            <span>{tr('rt.tapMap', lang)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setRoute({ picking: false }); }}>{tr('rt.cancel', lang)}</button>
          </p>
        </div>
      )}
    </>
  );
}

// F3 (Іван): карта — плавне поле шару, кордони, міста, частинки вітру (reduced motion → стрілки), вибір точки, легенда.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/state';
import { makeProjection } from '../../core';
import { Legend } from '../layers/Legend';
import { drawWindArrows } from './arrows';
import { fieldPixels, nodeStep } from './field';
import { SnapButton } from './SnapButton';
import { WindParticles } from './WindParticles';
import { HoverTip, type HoverPos } from './HoverTip';
import { useReducedMotion } from './useReducedMotion';

/** Поле рахуємо в сітці кожні FIELD_PX css-пікселів і згладжуємо при масштабуванні (≤ 300 мс, F3-AC2). */
const FIELD_PX = 3;
type MapCanvas = HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] };

export function MapView() {
  const { data, s, set } = useApp();
  const ref = useRef<MapCanvas>(null);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<HoverPos | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const { project: px, unproject } = makeProjection(W, H);
    cv.unproject = unproject;

    ctx.fillStyle = '#1c2117'; ctx.fillRect(0, 0, W, H);
    // Плавне поле: значення в кожній точці з core (білінійно), далі згладжене масштабування.
    const fw = Math.max(1, Math.ceil(W / FIELD_PX)), fh = Math.max(1, Math.ceil(H / FIELD_PX));
    const off = document.createElement('canvas');
    off.width = fw; off.height = fh;
    const octx = off.getContext('2d');
    if (octx) {
      const fu = (x: number, y: number) => unproject(x * FIELD_PX, y * FIELD_PX);
      octx.putImageData(new ImageData(fieldPixels(data, s, fw, fh, fu, nodeStep(fu)), fw, fh), 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, fw * FIELD_PX, fh * FIELD_PX);
    }

    for (const f of data.borders.features) {
      ctx.strokeStyle = f.iso === 'UKR' ? '#e6e2cc' : 'rgba(230,226,204,.35)';
      ctx.lineWidth = f.iso === 'UKR' ? 1.6 : 0.8;
      for (const ring of f.rings) { ctx.beginPath(); ring.forEach(([lo, la], i) => { const [x, y] = px(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
    }
    // prefers-reduced-motion (§7.10): замість частинок — статичні стрілки вітру обраної висоти.
    if (reduce) drawWindArrows(ctx, data, s, px);
    // Підписи міст з темною обводкою, щоб читались на будь-якому кольорі поля.
    ctx.font = '600 12px system-ui'; ctx.lineJoin = 'round';
    for (const c of data.cities) {
      const [x, y] = px(c.lat, c.lon);
      ctx.fillStyle = '#e6e2cc'; ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.strokeStyle = 'rgba(17,21,14,.85)'; ctx.lineWidth = 3; ctx.strokeText(c.name, x + 5, y - 4);
      ctx.fillText(c.name, x + 5, y - 4);
    }
    const [cx, cy] = px(s.lat, s.lon);
    ctx.strokeStyle = '#e2a72e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16); ctx.stroke();
  }, [data, s, reduce]);

  return (
    <>
      <canvas ref={ref} className="map" aria-label="Карта: торкніться, щоб обрати точку"
        onClick={(e) => {
          const cv = e.currentTarget as MapCanvas;
          const r = cv.getBoundingClientRect();
          const [lat, lon] = cv.unproject?.(e.clientX - r.left, e.clientY - r.top) ?? [s.lat, s.lon];
          if (lat >= 44 && lat <= 52.5 && lon >= 22 && lon <= 40.5) set({ lat, lon });
        }}
        onPointerMove={(e) => {
          // F3-AC6: підказка лише для миші/пера; на дотик тап обирає точку.
          if (e.pointerType === 'touch') { setHover(null); return; }
          const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          const [lat, lon] = makeProjection(r.width, r.height).unproject(x, y);
          setHover({ x, y, lat, lon, W: r.width, H: r.height });
        }}
        onPointerLeave={() => setHover(null)} />
      {!reduce && <WindParticles />}
      <Legend />
      <SnapButton reduce={reduce} />
      {hover && <HoverTip at={hover} />}
    </>
  );
}

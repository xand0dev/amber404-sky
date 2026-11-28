// F3 (Іван): карта — плавне поле шару, кордони, міста, частинки вітру (reduced motion → стрілки), вибір точки, легенда.
// Issue #100: підкладка (рельєф / супутник) під полем, поле — з повзунком прозорості; ріки й озера — над полем, під частинками.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/state';
import { useView } from '../../app/view/view';
import { useT } from '../../app/lang';
import { useTheme } from '../../app/theme';
import { cityName } from './translit';
import { makeProjection } from '../../core';
import { Legend } from '../layers/Legend';
import { drawWindArrows } from './arrows';
import { fieldPixels, nodeStep } from './field';
import { placeLabels } from './labels';
import { drawNodata, nodataCells } from './nodata';
import { SnapButton } from './SnapButton';
import { WindParticles } from './WindParticles';
import { HoverTip, type HoverPos } from './HoverTip';
import { useReducedMotion } from './useReducedMotion';
import { Basemap } from './Basemap';
import { drawWater, fieldAlpha, type WaterLine } from './basemaps';
import { loadWater, useBasemap } from './basemapStore';

/** Поле рахуємо в сітці кожні FIELD_PX css-пікселів і згладжуємо при масштабуванні (≤ 300 мс, F3-AC2). */
const FIELD_PX = 3;
type MapCanvas = HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] };

export function MapView() {
  const { data, s, set } = useApp();
  const { lang } = useT();
  // Кольори карти — з палітри теми: уночі (#36, #89) лише червоні, щоб не збивати нічний зір.
  const { night, colors } = useTheme();
  const ref = useRef<MapCanvas>(null);
  const reduce = useReducedMotion();
  const { view } = useView();
  const [hover, setHover] = useState<HoverPos | null>(null);
  const prefs = useBasemap();
  const alpha = fieldAlpha(prefs), clear = prefs.base === 'relief' || prefs.base === 'satellite';
  const [water, setWater] = useState<WaterLine[]>([]);
  useEffect(() => { let alive = true; void loadWater().then((w) => { if (alive) setWater(w); }); return () => { alive = false; }; }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const { project: px, unproject } = makeProjection(W, H, view);
    cv.unproject = unproject;

    // Над рельєфом і супутником тло прозоре — підкладку видно (canvas.basemap під картою).
    if (!clear) { ctx.fillStyle = colors.base; ctx.fillRect(0, 0, W, H); }
    // Плавне поле: значення в кожній точці з core (білінійно), далі згладжене масштабування.
    const fw = Math.max(1, Math.ceil(W / FIELD_PX)), fh = Math.max(1, Math.ceil(H / FIELD_PX));
    const off = document.createElement('canvas');
    off.width = fw; off.height = fh;
    const octx = off.getContext('2d');
    if (octx) {
      const fu = (x: number, y: number) => unproject(x * FIELD_PX, y * FIELD_PX);
      octx.putImageData(new ImageData(fieldPixels(data, s, fw, fh, fu, nodeStep(fu), night), fw, fh), 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = alpha;
      ctx.drawImage(off, 0, 0, fw * FIELD_PX, fh * FIELD_PX);
      ctx.globalAlpha = 1;
    }
    // Місця без даних (#140) — штрихування поверх поля, щоб прогалину не плутали з «поле не домалювалось».
    drawNodata(ctx, nodataCells(data, s), data.meta.grid.step, px, colors.ink, W, H);
    ctx.globalAlpha = night ? 0.6 : 1;
    drawWater(ctx, water, px, night ? colors.ink : undefined);
    ctx.globalAlpha = 1;

    for (const f of data.borders.features) {
      ctx.strokeStyle = colors.ink; ctx.globalAlpha = f.iso === 'UKR' ? 1 : 0.35;
      ctx.lineWidth = f.iso === 'UKR' ? 1.6 : 0.8;
      for (const ring of f.rings) { ctx.beginPath(); ring.forEach(([lo, la], i) => { const [x, y] = px(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    // prefers-reduced-motion (§7.10): замість частинок — статичні стрілки вітру обраної висоти.
    if (reduce) drawWindArrows(ctx, data, s, px, night ? colors.ink : undefined);
    // Підписи міст з темною обводкою, щоб читались на будь-якому кольорі поля; без накладань (#89, labels.ts).
    ctx.font = '600 12px system-ui'; ctx.lineJoin = 'round';
    const names = data.cities.map((c) => cityName(c, lang));
    const pts = data.cities.map((c) => px(c.lat, c.lon));
    const [mx, my] = px(s.lat, s.lon); // маркер обраної точки (хрестик 32 px) — підписи його не закривають
    const spots = placeLabels(pts.map(([x, y], i) => ({ x, y, w: ctx.measureText(names[i]).width, h: 14 })), W, H, [{ x: mx - 18, y: my - 18, w: 36, h: 36 }]);
    ctx.fillStyle = colors.ink;
    for (const [x, y] of pts) ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.strokeStyle = colors.base; ctx.lineWidth = 3;
    spots.forEach((sp, i) => {
      if (!sp) return;
      ctx.strokeText(names[i], sp.tx, sp.by);
      ctx.fillText(names[i], sp.tx, sp.by);
    });
    const [cx, cy] = px(s.lat, s.lon);
    ctx.strokeStyle = night ? colors.ink : colors.cau; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16); ctx.stroke();
  }, [data, s, reduce, view, lang, alpha, clear, water, night, colors]);

  return (
    <>
      <Basemap />
      <canvas ref={ref} className="map" aria-label={lang === 'en' ? 'Map: tap to pick a point' : 'Карта: торкніться, щоб обрати точку'}
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
          const [lat, lon] = makeProjection(r.width, r.height, view).unproject(x, y);
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

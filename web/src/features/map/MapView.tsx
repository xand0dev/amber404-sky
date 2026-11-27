// F3 (Іван): стартова карта від F0 — поле шару, кордони, міста, стрілки вітру, вибір точки.
// Частинки, легенда й плавна інтерполяція — задачі F3.
import { useEffect, useRef } from 'react';
import { useApp } from '../../app/state';
import { bilinear, evaluate, fromUV, isIcing, weatherAt, windAt } from '../../core';
import { layerColor } from '../layers/colors';

const BOX = { lat0: 52.6, lat1: 43.9, lon0: 21.9, lon1: 40.6 };

export function MapView() {
  const { data, s, set } = useApp();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const k = Math.cos((48.5 * Math.PI) / 180);
    const sc = Math.min(W / ((BOX.lon1 - BOX.lon0) * k), H / (BOX.lat0 - BOX.lat1));
    const ox = (W - (BOX.lon1 - BOX.lon0) * k * sc) / 2, oy = (H - (BOX.lat0 - BOX.lat1) * sc) / 2;
    const px = (lat: number, lon: number): [number, number] => [ox + (lon - BOX.lon0) * k * sc, oy + (BOX.lat0 - lat) * sc];
    (cv as HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] }).unproject = (x, y) =>
      [BOX.lat0 - (y - oy) / sc, BOX.lon0 + (x - ox) / (k * sc)];

    ctx.fillStyle = '#1c2117'; ctx.fillRect(0, 0, W, H);
    const g = data.meta.grid, P = data.profile, h = s.hour;
    const prof = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];
    const src = { meta: data.meta, profile: P, kp: data.kp, galileo: data.galileo };
    const cell = 0.25;
    for (let lat = 44; lat < 52.5; lat += cell) for (let lon = 22; lon < 40.5; lon += cell) {
      const la = lat + cell / 2, lo = lon + cell / 2;
      let v: number | string | null;
      if (s.layer === 'wind') { const w = windAt(g, P, s.altM, h, la, lo); v = w ? fromUV(w[0], w[1])[0] : null; }
      else if (s.layer === 'gust') { const x = bilinear(g, P.gust[h], la, lo); v = x == null ? null : x / 10; }
      else if (s.layer === 'temp') { const x = bilinear(g, P.temp[h], la, lo); v = x == null ? null : x / 10; }
      else if (s.layer === 'vis') { const x = bilinear(g, P.vis[h], la, lo); v = x == null ? null : x / 10; }
      else { const wx = weatherAt(src, la, lo, s.altM, h);
        if (s.layer === 'cloud') v = wx.cb; else if (s.layer === 'icing') v = isIcing(wx.t, wx.rh, wx.p) ? 1 : 0;
        else v = evaluate(wx, prof, s.altM).level; }
      const [x0, y0] = px(lat + cell, lon), [x1, y1] = px(lat, lon + cell);
      ctx.fillStyle = layerColor(s.layer, v); ctx.fillRect(x0, y0, x1 - x0 + 0.6, y1 - y0 + 0.6);
    }
    ctx.lineWidth = 1;
    for (const f of data.borders.features) {
      ctx.strokeStyle = f.iso === 'UKR' ? '#e6e2cc' : 'rgba(230,226,204,.35)';
      ctx.lineWidth = f.iso === 'UKR' ? 1.6 : 0.8;
      for (const ring of f.rings) { ctx.beginPath(); ring.forEach(([lo, la], i) => { const [x, y] = px(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(230,226,204,.75)'; ctx.lineWidth = 1.2;
    for (let lat = 44.5; lat < 52.5; lat += 1) for (let lon = 22.5; lon < 40.5; lon += 1) {
      const w = windAt(g, P, s.altM, h, lat, lon); if (!w) continue;
      const [x, y] = px(lat, lon), len = Math.min(18, 4 + Math.hypot(w[0], w[1]) * 1.2), a = Math.atan2(-w[1], w[0]);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
      ctx.lineTo(ex - Math.cos(a - 0.5) * 5, ey - Math.sin(a - 0.5) * 5); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(a + 0.5) * 5, ey - Math.sin(a + 0.5) * 5); ctx.stroke();
    }
    ctx.fillStyle = '#e6e2cc'; ctx.font = '600 12px system-ui';
    for (const c of data.cities) { const [x, y] = px(c.lat, c.lon); ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillText(c.name, x + 5, y - 4); }
    const [cx, cy] = px(s.lat, s.lon);
    ctx.strokeStyle = '#e2a72e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16); ctx.stroke();
  }, [data, s]);

  return (
    <canvas ref={ref} className="map" aria-label="Карта: торкніться, щоб обрати точку"
      onClick={(e) => {
        const cv = e.currentTarget as HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] };
        const r = cv.getBoundingClientRect();
        const [lat, lon] = cv.unproject?.(e.clientX - r.left, e.clientY - r.top) ?? [s.lat, s.lon];
        if (lat >= 44 && lat <= 52.5 && lon >= 22 && lon <= 40.5) set({ lat, lon });
      }} />
  );
}

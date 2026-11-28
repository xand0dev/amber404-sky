// F3: анімація частинок вітру обраної висоти — окремий canvas поверх поля, поле щокадру не перемальовується.
// #168: колір за швидкістю (шкала легенди), шлейф із згасанням, очищення при зміні вигляду, пауза у прихованій вкладці.
import { useEffect, useRef } from 'react';
import { useApp } from '../../app/state';
import { useTheme } from '../../app/theme';
import { useView } from '../../app/view/view';
import { makeProjection } from '../../core';
import { bucketColors, drawTrails, particleCount, seed, step, viewChanged, windSampler, type WindFn } from './particles';
import './wind.css';

export function WindParticles() {
  const { data, s } = useApp();
  const { colors, night } = useTheme();
  const { view } = useView();
  const ref = useRef<HTMLCanvasElement>(null);
  const wind = useRef<{ fn: WindFn; W: number; H: number } | null>(null);
  const palette = useRef(bucketColors(night, colors.ink));
  useEffect(() => { palette.current = bucketColors(night, colors.ink); }, [night, colors.ink]);

  // Нова година, висота чи дані — лише новий семплер; цикл анімації не перезапускається.
  const viewRef = useRef(view);
  const dirty = useRef(false); // вигляд змінився — стерти шлейф і розкидати частинки заново
  const src = useRef({ data, s });
  useEffect(() => { src.current = { data, s }; wind.current = null; }, [data, s]);
  useEffect(() => {
    if (viewChanged(viewRef.current, view)) dirty.current = true;
    viewRef.current = view; wind.current = null;
  }, [view]);

  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let raf = 0, last = 0, W = 0, H = 0, ps = seed(0, 1, 1, Math.random), x0 = new Float32Array(0), y0 = x0;
    const reseed = () => {
      ps = seed(particleCount(W, H, viewRef.current.zoom), W, H, Math.random);
      x0 = new Float32Array(ps.length); y0 = new Float32Array(ps.length);
    };
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
      if (w !== W || h !== H) { // розмір змінився — новий буфер (він уже чистий) і нові частинки
        W = w; H = h; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        reseed(); wind.current = null; dirty.current = false;
      }
      if (dirty.current) { ctx.clearRect(0, 0, W, H); reseed(); dirty.current = false; }
      if (!wind.current || wind.current.W !== W || wind.current.H !== H) {
        const { data: d, s: st } = src.current;
        wind.current = { fn: windSampler(d, st, makeProjection(W, H, viewRef.current).unproject), W, H };
      }
      const dt = last ? (t - last) / 1000 : 0; last = t;
      for (let i = 0; i < ps.length; i++) { x0[i] = ps[i].x; y0[i] = ps[i].y; }
      step(ps, dt, wind.current.fn, W, H, Math.random);
      drawTrails(ctx, ps, x0, y0, palette.current, W, H);
    };
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    // Прихована вкладка — жодних кадрів; після повернення крок не стрибає (last = 0).
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) start();
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return <canvas ref={ref} className="wind-particles" aria-hidden="true" style={{ pointerEvents: 'none' }} />;
}

// F3: анімація частинок вітру обраної висоти — окремий canvas поверх поля, поле щокадру не перемальовується.
import { useEffect, useRef } from 'react';
import { useApp } from '../../app/state';
import { useTheme } from '../../app/theme';
import { makeProjection } from '../../core';
import { particleCount, seed, step, windSampler, type WindFn } from './particles';

export function WindParticles() {
  const { data, s } = useApp();
  const { colors } = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);
  const wind = useRef<{ fn: WindFn; W: number; H: number } | null>(null);
  const ink = useRef(colors.ink);
  useEffect(() => { ink.current = colors.ink; }, [colors.ink]);

  // Нова година, висота чи дані — лише новий семплер; цикл анімації не перезапускається.
  useEffect(() => { wind.current = null; }, [data, s.altM, s.hour]);

  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let raf = 0, last = 0, W = 0, H = 0, ps = seed(0, 1, 1, Math.random);
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
      if (w !== W || h !== H) { // розмір змінився — новий буфер і нові частинки
        W = w; H = h; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ps = seed(particleCount(W, H), W, H, Math.random); wind.current = null;
      }
      if (!wind.current || wind.current.W !== W || wind.current.H !== H) {
        wind.current = { fn: windSampler(data, s, makeProjection(W, H).unproject), W, H };
      }
      const dt = last ? (t - last) / 1000 : 0; last = t;
      const x0 = ps.map((p) => p.x), y0 = ps.map((p) => p.y);
      step(ps, dt, wind.current.fn, W, H, Math.random);
      // Сліди: старе згасає, нові відрізки поверх.
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = ink.current; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ps.forEach((p, i) => { if (p.age === 0) return; ctx.moveTo(x0[i], y0[i]); ctx.lineTo(p.x, p.y); });
      ctx.stroke(); ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // data і s читаються через wind.current, який скидається ефектом вище.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="map particles" aria-hidden="true" style={{ pointerEvents: 'none' }} />;
}

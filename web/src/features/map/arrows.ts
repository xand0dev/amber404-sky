// F3: статичні стрілки вітру обраної висоти (reduced motion і знімок 📷 замість частинок). Вітер — з core.windAt.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import { windAt } from '../../core';

export function drawWindArrows(ctx: CanvasRenderingContext2D, data: Bundle, s: AppState, project: (lat: number, lon: number) => [number, number]): void {
  const g = data.meta.grid, P = data.profile;
  ctx.save();
  ctx.strokeStyle = 'rgba(230,226,204,.75)'; ctx.lineWidth = 1.2;
  for (let lat = 44.5; lat < 52.5; lat += 1) for (let lon = 22.5; lon < 40.5; lon += 1) {
    const w = windAt(g, P, s.altM, s.hour, lat, lon); if (!w) continue;
    const [x, y] = project(lat, lon), len = Math.min(18, 4 + Math.hypot(w[0], w[1]) * 1.2), a = Math.atan2(-w[1], w[0]);
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
    ctx.lineTo(ex - Math.cos(a - 0.5) * 5, ey - Math.sin(a - 0.5) * 5); ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(a + 0.5) * 5, ey - Math.sin(a + 0.5) * 5); ctx.stroke();
  }
  ctx.restore();
}

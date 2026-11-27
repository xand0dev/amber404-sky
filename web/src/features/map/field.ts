// F3: поле шару без DOM — значення в точці (лише через core) і RGBA-пікселі для карти (SPEC §7.1, §7.6).
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import type { DroneProfile } from '../../contracts';
import { bilinear, cellOf, evaluate, fromUV, isIcing, weatherAt, windAt, type Projection } from '../../core';
import { layerRGBA } from '../layers/colors';

/** Значення шару в точці: число в одиницях шкали §7.6, рівень вердикту, 1/0 для обмерзання або null. */
export function sampleLayer(data: Bundle, s: AppState, prof: DroneProfile, lat: number, lon: number): number | string | null {
  const g = data.meta.grid, P = data.profile, h = s.hour;
  if (!cellOf(g, lat, lon)) return null;
  const sc = (f: (number | null)[][], k: number) => { const row = f[h]; const x = row ? bilinear(g, row, lat, lon) : null; return x == null ? null : x / k; };
  switch (s.layer) {
    case 'wind': { const w = windAt(g, P, s.altM, h, lat, lon); return w ? fromUV(w[0], w[1])[0] : null; }
    case 'gust': return sc(P.gust, 10);
    case 'temp': return sc(P.temp, 10);
    case 'vis': return sc(P.vis, 10); // м/100 → км
    default: {
      const wx = weatherAt({ meta: data.meta, profile: P, kp: data.kp, galileo: data.galileo }, lat, lon, s.altM, h);
      if (s.layer === 'cloud') return wx.cb;
      if (s.layer === 'icing') return wx.t == null || wx.rh == null ? null : isIcing(wx.t, wx.rh, wx.p) ? 1 : 0;
      return evaluate(wx, prof, s.altM).level;
    }
  }
}

/** Крок вузлів у пікселях поля: ≈ 0.125° (у 4 рази густіше за сітку 0.5°), не менше 1 px. */
export function nodeStep(unproject: Projection['unproject']): number {
  const [la0] = unproject(0, 0), [la1] = unproject(0, 1);
  return Math.max(1, Math.floor(0.125 / Math.abs(la0 - la1)));
}

/**
 * RGBA-пікселі поля W×H; поза сіткою — прозоро, без даних — колір «немає даних».
 * Значення з core рахуємо у вузлах кожні `step` px, між вузлами колір інтерполюється білінійно (F3-AC2: ≤ 300 мс).
 */
export function fieldPixels(data: Bundle, s: AppState, W: number, H: number, unproject: Projection['unproject'], step = 1): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(W * H * 4);
  const prof = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];
  const g = data.meta.grid;
  const nw = Math.ceil(W / step) + 1, nh = Math.ceil(H / step) + 1;
  const node = new Float32Array(nw * nh * 4); // альфа 0 — вузол поза сіткою
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const [lat, lon] = unproject(i * step + 0.5, j * step + 0.5);
    if (!cellOf(g, lat, lon)) continue;
    node.set(layerRGBA(s.layer, sampleLayer(data, s, prof, lat, lon)), (j * nw + i) * 4);
  }
  // Проєкція відокремлювана: широта залежить лише від y, довгота — лише від x. Рахуємо раз на рядок / стовпець.
  const latS = g.lat0 - (g.nr - 1) * g.step, lonE = g.lon0 + (g.nc - 1) * g.step;
  const lonOf = new Float64Array(W);
  for (let x = 0; x < W; x++) lonOf[x] = unproject(x + 0.5, 0.5)[1];
  const acc = (k: number, w: number, c: Float64Array) => {
    if (w === 0 || node[k + 3] === 0) return;
    c[0] += node[k] * w; c[1] += node[k + 1] * w; c[2] += node[k + 2] * w; c[3] += node[k + 3] * w; c[4] += w;
  };
  const c = new Float64Array(5);
  for (let y = 0; y < H; y++) {
    const lat = unproject(0.5, y + 0.5)[0];
    if (lat < latS || lat > g.lat0) continue;
    const j = Math.floor(y / step), fy = (y - j * step) / step;
    for (let x = 0; x < W; x++) {
      const lon = lonOf[x];
      if (lon < g.lon0 || lon > lonE) continue;
      const i = Math.floor(x / step), fx = (x - i * step) / step, k = (j * nw + i) * 4;
      // Білінійно лише по вузлах у межах сітки (вага перенормовується біля краю).
      c.fill(0);
      acc(k, (1 - fx) * (1 - fy), c); acc(k + 4, fx * (1 - fy), c);
      acc(k + nw * 4, (1 - fx) * fy, c); acc(k + nw * 4 + 4, fx * fy, c);
      const o = (y * W + x) * 4;
      if (c[4] === 0) { // усі сусідні вузли поза сіткою — рахуємо піксель напряму
        out.set(layerRGBA(s.layer, sampleLayer(data, s, prof, lat, lon)), o);
        continue;
      }
      out[o] = c[0] / c[4]; out[o + 1] = c[1] / c[4]; out[o + 2] = c[2] / c[4]; out[o + 3] = c[3] / c[4];
    }
  }
  return out;
}

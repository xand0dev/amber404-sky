// F3: поле шару без DOM — значення в точці (лише через core) і RGBA-пікселі для карти (SPEC §7.1, §7.6).
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import type { DroneProfile } from '../../contracts';
import { bilinear, cellOf, evaluate, fromUV, isIcing, weatherAt, windAt } from '../../core';
import { layerRGBA } from '../layers/colors';

/** Рамка карти з запасом навколо сітки (lat 44…52.5, lon 22…40.5). */
export const BOX = { lat0: 52.6, lat1: 43.9, lon0: 21.9, lon1: 40.6 };

export interface Projection {
  project: (lat: number, lon: number) => [number, number];
  unproject: (x: number, y: number) => [number, number];
}

/** Рівнокутна-подібна проєкція: довготу стискаємо на cos(48.5°), рамка вписана й відцентрована. */
export function projection(W: number, H: number): Projection {
  const k = Math.cos((48.5 * Math.PI) / 180);
  const sc = Math.min(W / ((BOX.lon1 - BOX.lon0) * k), H / (BOX.lat0 - BOX.lat1));
  const ox = (W - (BOX.lon1 - BOX.lon0) * k * sc) / 2, oy = (H - (BOX.lat0 - BOX.lat1) * sc) / 2;
  return {
    project: (lat, lon) => [ox + (lon - BOX.lon0) * k * sc, oy + (BOX.lat0 - lat) * sc],
    unproject: (x, y) => [BOX.lat0 - (y - oy) / sc, BOX.lon0 + (x - ox) / (k * sc)],
  };
}

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

/** RGBA-пікселі поля W×H; поза сіткою — прозоро, без даних — колір «немає даних». */
export function fieldPixels(data: Bundle, s: AppState, W: number, H: number, unproject: Projection['unproject']): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(W * H * 4);
  const prof = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [lat, lon] = unproject(x + 0.5, y + 0.5);
    if (!cellOf(data.meta.grid, lat, lon)) continue;
    const c = layerRGBA(s.layer, sampleLayer(data, s, prof, lat, lon)), i = (y * W + x) * 4;
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = c[3];
  }
  return out;
}

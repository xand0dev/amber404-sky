// Кольори й шкали шарів (SPEC §7.6). Одна рампа для поля на карті й для легенди.
import type { LayerId } from '../../app/state';

export type RGBA = [number, number, number, number];

export type Scale =
  | { kind: 'ramp'; min: number; max: number; unit: string; /** true — мале значення гірше (червоне) */ lowBad: boolean }
  | { kind: 'classes'; items: { value: string | number; text: string; rgba: RGBA }[] };

export const NODATA_RGBA: RGBA = [70, 80, 58, 128];

export const LEVEL_RGBA: Record<string, RGBA> = {
  GO: [140, 191, 79, 153], CAUTION: [226, 167, 46, 179], 'NO-GO': [224, 83, 47, 191], 'NO-DATA': NODATA_RGBA,
};

/** CSS-кольори рівнів (їх читають timeline і route — не міняти рядки). */
export const LEVEL_COLOR: Record<string, string> = { GO: 'rgba(140,191,79,.6)', CAUTION: 'rgba(226,167,46,.7)', 'NO-GO': 'rgba(224,83,47,.75)', 'NO-DATA': 'rgba(70,80,58,.6)' };

export const SCALES: Record<LayerId, Scale> = {
  wind: { kind: 'ramp', min: 0, max: 26, unit: 'м/с', lowBad: false },
  gust: { kind: 'ramp', min: 0, max: 26, unit: 'м/с', lowBad: false },
  cloud: { kind: 'ramp', min: 0, max: 1500, unit: 'м', lowBad: true },
  temp: { kind: 'ramp', min: -20, max: 30, unit: '°C', lowBad: true },
  vis: { kind: 'ramp', min: 0, max: 40, unit: 'км', lowBad: true },
  go: { kind: 'classes', items: [
    { value: 'GO', text: 'МОЖНА', rgba: LEVEL_RGBA.GO },
    { value: 'CAUTION', text: 'ОБЕРЕЖНО', rgba: LEVEL_RGBA.CAUTION },
    { value: 'NO-GO', text: 'НЕ МОЖНА', rgba: LEVEL_RGBA['NO-GO'] },
    { value: 'NO-DATA', text: 'НЕМАЄ ДАНИХ', rgba: NODATA_RGBA },
  ] },
  icing: { kind: 'classes', items: [
    { value: 1, text: 'так', rgba: [120, 170, 230, 179] },
    { value: 0, text: 'ні', rgba: [46, 74, 52, 102] },
  ] },
};

const STOPS = [[46, 74, 52], [120, 150, 60], [226, 167, 46], [224, 83, 47], [150, 40, 60]];

/** Неперервна рампа: t 0 (добре) … 1 (погано). */
export function ramp(t: number): RGBA {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1), i = Math.min(Math.floor(x), STOPS.length - 2), f = x - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, 199];
}

export function layerRGBA(layer: LayerId, v: number | string | null): RGBA {
  if (v == null) return NODATA_RGBA;
  const sc = SCALES[layer];
  if (sc.kind === 'classes') return sc.items.find((i) => i.value === v)?.rgba ?? NODATA_RGBA;
  if (typeof v !== 'number') return NODATA_RGBA;
  const t = (v - sc.min) / (sc.max - sc.min);
  return ramp(sc.lowBad ? 1 - t : t);
}

export const css = ([r, g, b, a]: RGBA) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${(a / 255).toFixed(2)})`;

/** Сумісність зі старим API: колір як CSS-рядок. */
export function layerColor(layer: LayerId, v: number | string | null): string {
  return css(layerRGBA(layer, v));
}

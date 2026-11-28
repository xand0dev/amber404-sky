// F3-AC1: шкали шарів за SPEC §7.6, неперервна рампа.
import { describe, expect, it } from 'vitest';
import { NODATA_RGBA, SCALES, layerRGBA } from './colors';

describe('Given шари §7.6; Then межі шкал як у SPEC', () => {
  it('вітер і пориви 0…26 м/с, хмари 0…1500 м, темп. −20…30 °C, видимість 0…40 км', () => {
    const r = (id: keyof typeof SCALES) => { const x = SCALES[id]; return x.kind === 'ramp' ? [x.min, x.max, x.unit] : null; };
    expect(r('wind')).toEqual([0, 26, 'м/с']);
    expect(r('gust')).toEqual([0, 26, 'м/с']);
    expect(r('cloud')).toEqual([0, 1500, 'м']);
    expect(r('temp')).toEqual([-20, 30, '°C']);
    expect(r('vis')).toEqual([0, 40, 'км']);
  });
  it('«Можна летіти» — GO / CAUTION / NO-GO, «Обмерзання» — так / ні', () => {
    const go = SCALES.go, ic = SCALES.icing;
    expect(go.kind === 'classes' && go.items.map((i) => i.value)).toEqual(['GO', 'CAUTION', 'NO-GO', 'NO-DATA']);
    expect(ic.kind === 'classes' && ic.items.map((i) => i.text)).toEqual(['так', 'ні']);
  });
});

describe('Given сусідні значення; When фарбуємо; Then колір плавний', () => {
  it('10.0 і 10.1 м/с — різні, але близькі кольори', () => {
    const a = layerRGBA('wind', 10), b = layerRGBA('wind', 10.1);
    expect(a).not.toEqual(b);
    for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k])).toBeLessThanOrEqual(3);
  });
  it('немає даних → окремий сірий колір', () => {
    expect(layerRGBA('wind', null)).toEqual(NODATA_RGBA);
    expect(layerRGBA('go', 'NO-DATA')).toEqual(NODATA_RGBA);
  });
});

// Issue #89 (нічний режим #36): уночі поле лише червоне (G і B ≤ R/2), а гірше значення — яскравіше.
describe('Given нічний режим; When фарбуємо поле; Then лише червоний канал і порядок «гірше — яскравіше»', () => {
  const red = ([r, g, b]: number[]) => g <= r / 2 && b <= r / 2;
  it('рампи: усі кольори червоні, яскравість зростає з «поганістю»', () => {
    for (const layer of ['wind', 'gust', 'cloud', 'temp', 'vis'] as const) {
      const sc = SCALES[layer];
      if (sc.kind !== 'ramp') continue;
      const vs = [0, 0.25, 0.5, 0.75, 1].map((t) => sc.min + (sc.max - sc.min) * t);
      const rs = vs.map((v) => layerRGBA(layer, v, true));
      for (const c of rs) expect(red(c), `${layer} ${c}`).toBe(true);
      const bright = rs.map((c) => c[0]);
      const ordered = sc.lowBad ? [...bright].reverse() : bright;
      for (let i = 1; i < ordered.length; i++) expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });
  it('класи «Можна летіти»: МОЖНА < ОБЕРЕЖНО < НЕ МОЖНА за яскравістю; немає даних — червоне й тьмяне', () => {
    const [go, cau, no, nd] = (['GO', 'CAUTION', 'NO-GO', 'NO-DATA'] as const).map((v) => layerRGBA('go', v, true));
    for (const c of [go, cau, no, nd]) expect(red(c)).toBe(true);
    expect(go[0]).toBeLessThan(cau[0]);
    expect(cau[0]).toBeLessThan(no[0]);
    expect(red(layerRGBA('icing', 1, true)) && red(layerRGBA('wind', null, true))).toBe(true);
  });
  it('удень — як раніше', () => {
    expect(layerRGBA('wind', 5, false)).toEqual(layerRGBA('wind', 5));
  });
});

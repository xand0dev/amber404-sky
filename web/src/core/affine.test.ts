import { describe, expect, it } from 'vitest';
import { applyAffine, composeAffine, fitAffine, invertAffine, type Affine, type Anchor } from './affine';
import { toUTM } from './mgrs';
import { distanceM } from './route';

// Синтетична «топокарта»: скан у проєкції UTM (як карти Генштабу в СК-42/UTM), 10 м на піксель, повернутий на 3°.
const O = toUTM(50.45, 30.52); // лівий верхній кут — Київ
const ROT = (3 * Math.PI) / 180, MPP = 10;
function pixelOf(lat: number, lon: number): [number, number] {
  const u = toUTM(lat, lon), de = u.e - O.e, dn = O.n - u.n;
  return [(de * Math.cos(ROT) + dn * Math.sin(ROT)) / MPP, (-de * Math.sin(ROT) + dn * Math.cos(ROT)) / MPP];
}
const anchor = (lat: number, lon: number): Anchor => { const [x, y] = pixelOf(lat, lon); return { x, y, lat, lon }; };

describe('Given зображення карти і 3 точки прив\'язки (F5-AC1, SPEC §7.14)', () => {
  const pts = [anchor(50.45, 30.52), anchor(50.43, 30.95), anchor(50.18, 30.6)];
  const a = fitAffine(pts);

  it('When накласти; Then у 3 точках прив\'язки похибка 0', () => {
    expect(a).not.toBeNull();
    for (const p of pts) {
      const [lat, lon] = applyAffine(a!, p.x, p.y);
      expect(distanceM({ lat, lon }, p)).toBeLessThan(1e-3);
    }
  });

  it('Then четверта контрольна точка ≤ 500 м (ділянка ~30 км)', () => {
    const c = anchor(50.3, 30.8);
    const [lat, lon] = applyAffine(a!, c.x, c.y);
    expect(distanceM({ lat, lon }, c)).toBeLessThanOrEqual(500);
  });

  it('Then зворотне перетворення lat/lon → піксель повертає ті самі пікселі', () => {
    const inv = invertAffine(a!);
    expect(inv).not.toBeNull();
    for (const p of pts) {
      const [x, y] = applyAffine(inv!, p.lat, p.lon);
      expect(x).toBeCloseTo(p.x, 3);
      expect(y).toBeCloseTo(p.y, 3);
    }
  });

  it('Given 3 точки на одній прямій; Then null (прив\'язка неможлива)', () => {
    expect(fitAffine([{ x: 0, y: 0, lat: 50, lon: 30 }, { x: 10, y: 10, lat: 49.9, lon: 30.1 }, { x: 20, y: 20, lat: 49.8, lon: 30.2 }])).toBeNull();
  });

  it('Given не 3 точки або NaN; Then null', () => {
    expect(fitAffine(pts.slice(0, 2))).toBeNull();
    expect(fitAffine([pts[0], pts[1], { ...pts[2], lat: NaN }])).toBeNull();
  });
});

describe('Given прив\'язка і проєкція екрана; When скласти; Then піксель зображення → піксель екрана одним перетворенням', () => {
  it('composeAffine(outer, inner)(p) = outer(inner(p))', () => {
    const inner: Affine = [0.001, -0.0002, 50.4, 0.0003, 0.0015, 30.5], outer: Affine = [-40, 0.5, 2100, 1.2, 26, -700];
    const m = composeAffine(outer, inner);
    const [i1, i2] = applyAffine(inner, 123, 456), want = applyAffine(outer, i1, i2), got = applyAffine(m, 123, 456);
    expect(got[0]).toBeCloseTo(want[0], 9);
    expect(got[1]).toBeCloseTo(want[1], 9);
  });
});

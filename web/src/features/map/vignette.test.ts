// Issue #167 AC2: фокус на Україні — усе поза кордоном (і поза рамкою даних) затемнене, кордон України з ореолом.
import { describe, expect, it } from 'vitest';
import borders from '../../../public/data/static/borders.json';
import { dataBox, dimmed, inRings, ukraineRings } from './vignette';

const rings = ukraineRings(borders);
const grid = { lat0: 52.5, lon0: 22, step: 0.5, nr: 18, nc: 38 };
const box = dataBox(grid);

describe('Given віньєтка по кордону України (evenodd)', () => {
  it('кільця беруться лише з UKR (разом із Кримом)', () => {
    expect(rings.length).toBe(borders.features.find((f) => f.iso === 'UKR')!.rings.length);
    expect(ukraineRings({ features: [{ iso: 'POL', rings: [[[0, 0], [1, 0], [1, 1]]] }] })).toEqual([]);
  });
  it('рамка даних — із сітки meta.grid', () => {
    expect(box).toEqual({ lat0: 52.5, lat1: 44, lon0: 22, lon1: 40.5 });
  });
  it('точки в Україні (Київ, Львів, Харків, Одеса, Сімферополь) — без затемнення', () => {
    for (const [lat, lon] of [[50.45, 30.52], [49.84, 24.03], [49.99, 36.23], [46.48, 30.72], [44.95, 34.1]]) {
      expect(inRings(lat, lon, rings), `${lat},${lon}`).toBe(true);
      expect(dimmed(lat, lon, rings, box), `${lat},${lon}`).toBe(false);
    }
  });
  it('точка в Польщі (Люблін) — затемнена; Молдова, Білорусь, Росія, Румунія — теж', () => {
    for (const [lat, lon] of [[51.25, 22.57], [47.0, 28.86], [52.1, 27.0], [50.6, 39.5], [45.5, 24.0]]) {
      expect(dimmed(lat, lon, rings, box), `${lat},${lon}`).toBe(true);
    }
  });
  it('поза рамкою даних — затемнено навіть усередині кілець', () => {
    const sq = [[[20, 40], [45, 40], [45, 55], [20, 55], [20, 40]]];
    expect(dimmed(48, 30, sq, box)).toBe(false);
    expect(dimmed(53, 30, sq, box)).toBe(true);
    expect(dimmed(48, 41, sq, box)).toBe(true);
  });
  it('evenodd: дірка всередині кільця — затемнена', () => {
    const holed = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]];
    expect(inRings(2, 2, holed)).toBe(true);
    expect(inRings(5, 5, holed)).toBe(false);
  });
});

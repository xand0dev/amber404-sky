// Спільна проєкція карти: lat/lon ↔ екран, рівнопроміжна з масштабом довготи cos(48.5°), рамка України по центру.
// Ті самі числа, що в MapView (F3), — щоб підкладка й поле погоди збігалися піксель у піксель.
import type { Affine } from './affine';

export const MAP_BOX = { lat0: 52.6, lat1: 43.9, lon0: 21.9, lon1: 40.6 };
export const MAP_REF_LAT = 48.5;

export interface Projection {
  project(lat: number, lon: number): [number, number];
  unproject(x: number, y: number): [number, number];
  /** x = a·lat + b·lon + c; y = d·lat + e·lon + f. */
  affine: Affine;
}

export function makeProjection(W: number, H: number, box = MAP_BOX, refLat = MAP_REF_LAT): Projection {
  const k = Math.cos((refLat * Math.PI) / 180);
  const sc = Math.min(W / ((box.lon1 - box.lon0) * k), H / (box.lat0 - box.lat1));
  const ox = (W - (box.lon1 - box.lon0) * k * sc) / 2, oy = (H - (box.lat0 - box.lat1) * sc) / 2;
  return {
    project: (lat, lon) => [ox + (lon - box.lon0) * k * sc, oy + (box.lat0 - lat) * sc],
    unproject: (x, y) => [box.lat0 - (y - oy) / sc, box.lon0 + (x - ox) / (k * sc)],
    affine: [0, k * sc, ox - box.lon0 * k * sc, -sc, 0, oy + box.lat0 * sc],
  };
}

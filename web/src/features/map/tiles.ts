// Онлайн-підкладки (Вулиці OSM, Супутник 10 м EOX): тайли Web Mercator, намальовані в нашій рівнопроміжній проєкції.
// OPSEC (SPEC §7.6a): тайл-запити показують серверу карти, який район дивляться. Тому ці підкладки — лише за явним
// вибором людини, з попередженням у меню, і вибір не зберігається між сесіями (basemapStore).
import type { Projection } from '../../core';

export type OnlineId = 'streets' | 'satlive';

export interface TileSource { url: (z: number, x: number, y: number) => string; minZ: number; maxZ: number }

export const TILE_SOURCES: Record<OnlineId, TileSource> = {
  // OpenStreetMap Standard: https://operations.osmfoundation.org/policies/tiles/ — атрибуція обов'язкова.
  streets: { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, minZ: 5, maxZ: 19 },
  // EOX Sentinel-2 cloudless 2020 (CC BY-NC-SA 4.0), WMTS у Web Mercator; 10 м/піксель ≈ z14, далі — збільшення.
  satlive: { url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`, minZ: 5, maxZ: 15 },
};

/** Довгота → номер тайла (дробовий) на рівні z. */
export const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
/** Широта → номер тайла (дробовий) на рівні z, Web Mercator. */
export function latToY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
export const xToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
export function yToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Рівень тайлів, щоб піксель тайла ≈ фізичному пікселю екрана. pxPerDegLon — css px на 1° довготи. */
export function tileZoom(pxPerDegLon: number, dpr: number, src: TileSource): number {
  const z = Math.round(Math.log2((pxPerDegLon * dpr * 360) / 256));
  return Math.min(src.maxZ, Math.max(src.minZ, z));
}

export interface TileRef { z: number; x: number; y: number; url: string; lat0: number; lat1: number; lon0: number; lon1: number }

/** Тайли, що покривають екран W×H (з запасом в 1 тайл), — не більше `max` (інакше рівень нижче). */
export function visibleTiles(p: Projection, W: number, H: number, dpr: number, src: TileSource, max = 80): TileRef[] {
  const [latT, lonL] = p.unproject(0, 0), [latB, lonR] = p.unproject(W, H);
  const ppd = W / Math.max(1e-9, lonR - lonL);
  for (let z = tileZoom(ppd, dpr, src); z >= src.minZ; z--) {
    const n = 2 ** z;
    const x0 = Math.max(0, Math.floor(lonToX(lonL, z))), x1 = Math.min(n - 1, Math.floor(lonToX(lonR, z)));
    const y0 = Math.max(0, Math.floor(latToY(Math.min(85, latT), z))), y1 = Math.min(n - 1, Math.floor(latToY(Math.max(-85, latB), z)));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) continue;
    const out: TileRef[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      out.push({ z, x, y, url: src.url(z, x, y), lat0: yToLat(y, z), lat1: yToLat(y + 1, z), lon0: xToLon(x, z), lon1: xToLon(x + 1, z) });
    }
    return out;
  }
  return [];
}

const cache = new Map<string, Promise<HTMLImageElement | null>>();
/** Тайл з кешем у пам'яті; crossOrigin — щоб знімок карти (canvas → PNG) не «забруднювався». */
export function loadTile(url: string): Promise<HTMLImageElement | null> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((res) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => { cache.delete(url); res(null); };
      im.src = url;
    });
    cache.set(url, p);
    if (cache.size > 600) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

/** Тайл у прямокутник між його кутами в нашій проєкції. Усередині тайла Mercator ≈ лінійний (z ≥ 5 — похибка < 1 px). */
export function drawTile(ctx: CanvasRenderingContext2D, im: HTMLImageElement, t: Pick<TileRef, 'lat0' | 'lat1' | 'lon0' | 'lon1'>, project: Projection['project']): void {
  const [x0, y0] = project(t.lat0, t.lon0), [x1, y1] = project(t.lat1, t.lon1);
  // +0.5 px перекриття — без тонких швів між тайлами.
  ctx.drawImage(im, x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5);
}

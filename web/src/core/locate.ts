// Issue #161 (F3): «Де я» — позиція з GPS телефона. Лише пам'ять сторінки: координати не йдуть у мережу,
// логи, URL чи localStorage (SPEC §7.11, Конституція 8). Тут — чиста логіка без DOM.
import { fitView, type Projection, type View } from './projection';

/** Параметри getCurrentPosition / watchPosition (AC2): висока точність, таймаут 10 с, без старого кешу пристрою. */
export const GEO_OPTS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 };

/** «Рівень міста»: видно щонайменше ±CITY_KM навколо позиції. assumption — місто й найближчі околиці. */
export const CITY_KM = 10;

const KM_PER_DEG = 111.32;

/** Позиція в пам'яті: широта, довгота, радіус точності (м). Решту полів пристрою не беремо. */
export interface Fix { lat: number; lon: number; accM: number }

export function fixOf(c: { latitude: number; longitude: number; accuracy: number }): Fix {
  return { lat: c.latitude, lon: c.longitude, accM: c.accuracy };
}

/** Позиція в межах сітки прогнозу — та сама рамка, що й клік по карті (MapView). */
export function inMapArea(lat: number, lon: number): boolean {
  return lat >= 44 && lat <= 52.5 && lon >= 22 && lon <= 40.5;
}

/** Вигляд карти: центр на позиції, наближення до рівня міста. */
export function cityView(lat: number, lon: number, W: number, H: number): View {
  const dLat = CITY_KM / KM_PER_DEG, dLon = CITY_KM / (KM_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return fitView([[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]], W, H, 0);
}

/** Радіус кола точності в пікселях екрана для проєкції карти. */
export function accuracyPx(p: Projection, lat: number, lon: number, accM: number): number {
  const [, y0] = p.project(lat, lon), [, y1] = p.project(lat + 1, lon);
  return (Math.abs(y1 - y0) * accM) / (KM_PER_DEG * 1000);
}

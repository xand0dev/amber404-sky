// Зона польоту (SPEC §7.5b). windFn повертає [u, v] м/с на обраній висоті й годині.
export type WindFn = (lat: number, lon: number) => [number, number] | null;
export interface ZonePoint { lat: number; lon: number; distM: number; stop: 'energy' | 'wind-limit' | 'too-strong' | 'no-data' | 'max' }
export interface ZoneInput {
  lat: number; lon: number;
  tasMs: number; // крейсерська швидкість дрона
  windLimitMs: number;
  usableS: number; // час з резервом
  mode: 'roundtrip' | 'oneway';
  rays?: number; stepM?: number; maxM?: number;
}

const M_PER_DEG = 111_320;
export function offset(lat: number, lon: number, bearingDeg: number, distM: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180;
  return [lat + (distM * Math.cos(b)) / M_PER_DEG, lon + (distM * Math.sin(b)) / (M_PER_DEG * Math.cos((lat * Math.PI) / 180))];
}

/** Швидкість відносно землі за курсом bearing: √(tas² − cross²) + along; null, якщо вітер ≥ tas. */
export function groundSpeed(tas: number, u: number, v: number, bearingDeg: number): number | null {
  const b = (bearingDeg * Math.PI) / 180;
  const along = u * Math.sin(b) + v * Math.cos(b);
  const cross = u * Math.cos(b) - v * Math.sin(b);
  if (Math.abs(cross) >= tas) return null;
  const gs = Math.sqrt(tas * tas - cross * cross) + along;
  return gs > 0.1 ? gs : null;
}

export function zoneCalc(z: ZoneInput, wind: WindFn): ZonePoint[] {
  const rays = z.rays ?? 48, step = z.stepM ?? 250, max = z.maxM ?? 300_000;
  const out: ZonePoint[] = [];
  for (let k = 0; k < rays; k++) {
    const brg = (360 / rays) * k;
    let used = 0, d = 0, stop: ZonePoint['stop'] = 'max';
    let lat = z.lat, lon = z.lon;
    while (d < max) {
      const [mlat, mlon] = offset(lat, lon, brg, step / 2);
      const w = wind(mlat, mlon);
      if (!w) { stop = 'no-data'; break; }
      if (Math.hypot(w[0], w[1]) > z.windLimitMs) { stop = 'wind-limit'; break; }
      const there = groundSpeed(z.tasMs, w[0], w[1], brg);
      const back = groundSpeed(z.tasMs, w[0], w[1], (brg + 180) % 360);
      if (there == null || (z.mode === 'roundtrip' && back == null)) { stop = 'too-strong'; break; }
      const cost = step / there + (z.mode === 'roundtrip' ? step / (back as number) : 0);
      if (used + cost > z.usableS) { stop = 'energy'; break; }
      used += cost; d += step;
      [lat, lon] = offset(lat, lon, brg, step);
    }
    out.push({ lat, lon, distM: d, stop });
  }
  return out;
}

// MGRS (WGS84) для показу координат точки. UTM — ряди Крюгера за степенями n
// (Karney 2011, точність < 1 мм у межах зони). Винятки зон Норвегії / Шпіцбергену
// не реалізовані: вони поза Україною (assumption).
const A = 6_378_137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const N_ = F / (2 - F);
const A_ = (A / (1 + N_)) * (1 + N_ ** 2 / 4 + N_ ** 4 / 64);
const ALPHA = [
  N_ / 2 - (2 / 3) * N_ ** 2 + (5 / 16) * N_ ** 3,
  (13 / 48) * N_ ** 2 - (3 / 5) * N_ ** 3,
  (61 / 240) * N_ ** 3,
];
const E2 = F * (2 - F);
const E = Math.sqrt(E2);

export interface UTM { zone: number; band: string; e: number; n: number }

const BANDS = 'CDEFGHJKLMNPQRSTUVWX'; // по 8° від −80°, X — 72…84°
const COLS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
const ROWS = 'ABCDEFGHJKLMNPQRSTUV';

/** WGS84 → UTM; n для південної півкулі — з фальшивим зсувом 10 000 км. */
export function toUTM(lat: number, lon: number): UTM {
  if (!(lat >= -80 && lat <= 84) || !(lon >= -180 && lon <= 180)) throw new RangeError('поза межами MGRS');
  const zone = Math.min(60, Math.floor((lon + 180) / 6) + 1);
  const band = BANDS[Math.min(19, Math.floor((lat + 80) / 8))];
  const phi = (lat * Math.PI) / 180;
  const dl = ((lon - (zone * 6 - 183)) * Math.PI) / 180;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)));
  const xi0 = Math.atan2(t, Math.cos(dl));
  const eta0 = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let xi = xi0, eta = eta0;
  ALPHA.forEach((a, i) => {
    const j = 2 * (i + 1);
    xi += a * Math.sin(j * xi0) * Math.cosh(j * eta0);
    eta += a * Math.cos(j * xi0) * Math.sinh(j * eta0);
  });
  const e = 500_000 + K0 * A_ * eta;
  const n = K0 * A_ * xi + (lat < 0 ? 10_000_000 : 0);
  return { zone, band, e, n };
}

/** Рядок MGRS з точністю 1 м, напр. «36U UA 23940 91604» (цифри відкидаються, як у GEOTRANS). */
export function toMGRS(lat: number, lon: number): string {
  const { zone, band, e, n } = toUTM(lat, lon);
  const E1 = Math.floor(e), N1 = Math.floor(n);
  const col = COLS[(zone - 1) % 3][Math.floor(E1 / 100_000) - 1];
  const row = ROWS[(Math.floor(N1 / 100_000) + (zone % 2 === 0 ? 5 : 0)) % 20];
  const pad = (v: number) => String(v % 100_000).padStart(5, '0');
  return `${zone}${band} ${col}${row} ${pad(E1)} ${pad(N1)}`;
}

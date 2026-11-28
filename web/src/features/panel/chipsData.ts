// Issue #171 AC2: чипи причин вердикту — значення vs ліміт дрона, найгірша перша. Чистий TS без DOM.
// Пороги — ті самі, що в core/verdict.ts (§7.4): НЕ МОЖНА понад ліміт, ОБЕРЕЖНО понад 80% / близько.
import { isIcing, type Weather } from '../../core';
import type { DroneProfile } from '../../contracts';

export type ChipKind = 'wind' | 'gust' | 'cloud' | 'icing' | 'temp' | 'precip' | 'vis' | 'kp' | 'gal';
export type Sev = 'no' | 'cau' | 'ok' | 'nodata';
/** v — значення, lim — ліміт (для хмар — висота польоту, для Galileo — мін. супутників), r — частка ліміту для порядку. */
export interface Chip { kind: ChipKind; sev: Sev; v: number | null; lim: number; r: number; v2?: number | null }

const ORDER: ChipKind[] = ['wind', 'gust', 'cloud', 'icing', 'temp', 'precip', 'vis', 'kp', 'gal'];
const RANK: Record<Sev, number> = { no: 0, cau: 1, ok: 2, nodata: 3 };
// Пороги §7.4 без ліміту в профілі дрона (core/verdict.ts).
export const VIS_MIN_M = 1000, KP_MAX = 5, GAL_MIN = 6, PDOP_MAX = 4;

const nd = (kind: ChipKind, lim: number): Chip => ({ kind, sev: 'nodata', v: null, lim, r: 0 });
const ratioChip = (kind: ChipKind, v: number | null, lim: number): Chip =>
  v == null ? nd(kind, lim) : { kind, v, lim, r: v / lim, sev: v > lim ? 'no' : v > 0.8 * lim ? 'cau' : 'ok' };

export function chips(wx: Weather, pr: DroneProfile, altM: number): Chip[] {
  const { ws, g, t, cb, p, rh, vis, kp, galVisible, galPdop } = wx;
  const pLim = Math.max(pr.precipMmH, 0.05);
  const out: Chip[] = [
    ratioChip('wind', ws, pr.windMs),
    ratioChip('gust', g, pr.gustMs),
    cb == null ? nd('cloud', altM)
      : { kind: 'cloud', v: cb, lim: altM, r: cb > 0 ? altM / cb : 1, sev: altM >= cb ? 'no' : altM >= cb - 60 ? 'cau' : 'ok' },
    t == null ? nd('icing', 0) : { kind: 'icing', v: null, lim: 0, ...(isIcing(t, rh, p) ? { sev: 'no', r: 1 } : { sev: 'ok', r: 0 }) },
    // Температура: частка = 1 на ліміті, 0.8 на «ліміт + 5 °C» — та сама межа ОБЕРЕЖНО, що у verdict.ts.
    t == null ? nd('temp', pr.tMinC)
      : { kind: 'temp', v: t, lim: pr.tMinC, r: Math.max(0, 1 - (t - pr.tMinC) / 25), sev: t < pr.tMinC ? 'no' : t < pr.tMinC + 5 ? 'cau' : 'ok' },
    p == null ? nd('precip', pLim) : { kind: 'precip', v: p, lim: pr.precipMmH, r: p / pLim, sev: p > pLim ? 'no' : 'ok' },
    vis == null ? nd('vis', VIS_MIN_M) : { kind: 'vis', v: vis, lim: VIS_MIN_M, r: VIS_MIN_M / Math.max(vis, 1), sev: vis < VIS_MIN_M ? 'cau' : 'ok' },
    kp == null ? nd('kp', KP_MAX) : { kind: 'kp', v: kp, lim: KP_MAX, r: kp / KP_MAX, sev: kp >= KP_MAX ? 'cau' : 'ok' },
    galVisible == null && galPdop == null ? nd('gal', GAL_MIN) : {
      kind: 'gal', v: galVisible, v2: galPdop, lim: GAL_MIN,
      r: Math.max(galPdop != null ? galPdop / PDOP_MAX : 0, galVisible != null ? GAL_MIN / Math.max(galVisible, 1) : 0),
      sev: (galVisible != null && galVisible < GAL_MIN) || (galPdop != null && galPdop > PDOP_MAX) ? 'cau' : 'ok',
    },
  ];
  return out.sort((a, b) => RANK[a.sev] - RANK[b.sev] || b.r - a.r || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

// Кольори шарів (SPEC §7.6). Шкали F3 уточнює.
import type { LayerId } from '../../app/state';

const ramp = (t: number) => {
  const c = [[46, 74, 52], [120, 150, 60], [226, 167, 46], [224, 83, 47], [150, 40, 60]];
  const x = Math.max(0, Math.min(0.9999, t)) * (c.length - 1), i = Math.floor(x), f = x - i;
  const m = c[i].map((v, k) => Math.round(v + (c[i + 1][k] - v) * f));
  return `rgba(${m[0]},${m[1]},${m[2]},0.78)`;
};
export const LEVEL_COLOR: Record<string, string> = { GO: 'rgba(140,191,79,.6)', CAUTION: 'rgba(226,167,46,.7)', 'NO-GO': 'rgba(224,83,47,.75)', 'NO-DATA': 'rgba(70,80,58,.6)' };

export function layerColor(layer: LayerId, v: number | string | null): string {
  if (v == null) return 'rgba(70,80,58,.5)';
  if (typeof v === 'string') return LEVEL_COLOR[v] ?? 'transparent';
  switch (layer) {
    case 'wind': case 'gust': return ramp(v / 26);
    case 'cloud': return ramp(1 - v / 1500);
    case 'temp': return ramp((30 - v) / 50);
    case 'vis': return ramp(1 - v / 40);
    case 'icing': return v ? 'rgba(120,170,230,.7)' : 'rgba(46,74,52,.4)';
    default: return 'transparent';
  }
}

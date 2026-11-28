// Фікстури #165 (SPEC §6.2): index і файли годин профілю.
import type { ProfileHour, ProfileIndex } from '../contracts';

const N = 684;
export const grid = { lat0: 52.5, lon0: 22.0, step: 0.5, nr: 18, nc: 38 };
const levels = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];
export const GEN = '2026-11-28T09:05:00Z';
export const times = Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2026, 10, 28, 9 + h)).toISOString().replace('.000', ''));
export const index: ProfileIndex = {
  generatedAt: GEN, sources: ['openmeteo'], grid, levels,
  vars: ['spd', 'dir', 'gust', 'temp', 'precip', 'rh', 'vis'].map((id) => ({ id, perLevel: id === 'spd' || id === 'dir', unit: '' })),
  hours: times.map((t, h) => ({ t, file: `h${String(h).padStart(2, '0')}.json` })),
};
export function hourFile(h: number, v = h, gen = GEN): ProfileHour {
  const row = () => Array.from({ length: N }, () => v);
  return { generatedAt: gen, hour: h, t: times[h], spd: levels.map(row), dir: levels.map(() => Array(N).fill(270)),
    gust: row(), temp: row(), precip: row(), rh: Array(N).fill(80), vis: Array(N).fill(300) };
}

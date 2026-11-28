// Профіль за годинами (SPEC §6.2, #165): перший екран вантажить index і одну годину, решта — потім.
import type { Profile, ProfileHour, ProfileIndex } from '../contracts';

const LEVEL_VARS = ['spd', 'dir'] as const;
const SURFACE_VARS = ['gust', 'temp', 'precip', 'rh', 'vis'] as const;

/** Шлях файлу години відносно data/. */
export function hourPath(index: ProfileIndex, h: number): string {
  return `profile/${index.hours[h].file}`;
}

/** Профіль без жодної години: рядки відсутні → weatherAt і шари дають «немає даних», а не нулі. */
export function emptyProfile(index: ProfileIndex): Profile {
  return {
    generatedAt: index.generatedAt, sources: index.sources, levels: index.levels,
    spd: index.levels.map(() => []), dir: index.levels.map(() => []),
    gust: [], temp: [], precip: [], rh: [], vis: [],
  };
}

/** Новий Profile з доданими годинами. Година з іншого запуску (інший generatedAt) пропускається:
 *  прогнози різних запитів не змішуємо (AGENTS.md). */
export function withHours(p: Profile, index: ProfileIndex, hours: ProfileHour[]): Profile {
  const ok = hours.filter((hf) => hf.generatedAt === index.generatedAt && hf.hour >= 0 && hf.hour < index.hours.length);
  const out: Profile = { ...p };
  for (const k of LEVEL_VARS) out[k] = p[k].map((lv) => lv.slice());
  for (const k of SURFACE_VARS) out[k] = p[k].slice();
  for (const hf of ok) {
    for (const k of LEVEL_VARS) hf[k].forEach((row, li) => { if (out[k][li]) out[k][li][hf.hour] = row; });
    for (const k of SURFACE_VARS) out[k][hf.hour] = hf[k];
  }
  return out;
}

/** Порядок фонового довантаження: від наступної за показаною до кінця, потім ранні. */
export function backgroundOrder(first: number, n: number): number[] {
  return Array.from({ length: n - 1 }, (_, k) => (first + 1 + k) % n);
}

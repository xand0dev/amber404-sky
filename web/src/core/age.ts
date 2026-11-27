// Вік прогнозу для плашки (SPEC §7.11 «прогноз X год тому», §7.9 «прогноз застарів» > 6 год).
export const STALE_H = 6;

export interface ForecastAge { hours: number; stale: boolean; text: string }

export function forecastAge(generatedAt: string, nowMs: number): ForecastAge {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return { hours: NaN, stale: true, text: 'час прогнозу невідомий' };
  const min = Math.max(0, Math.floor((nowMs - t) / 60_000));
  const hours = min / 60;
  const stale = hours > STALE_H;
  const ago = min < 60 ? `${min} хв тому` : `${Math.floor(hours)} год тому`;
  return { hours, stale, text: stale ? `прогноз застарів: ${ago}` : `прогноз ${ago}` };
}

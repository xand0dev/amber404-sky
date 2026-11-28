// Звідки деплой бере дані (#138, SPEC §5). Повний `make data` — лише за розкладом (кожні 3 год)
// або якщо дані на Pages старі чи неповні; інакше push / ручний запуск беруть поточні JSON з Pages
// і не роблять нових запитів до Open-Meteo. Файл без імпортів: його запускає й Node у deploy.yml.
export const DATA_FRESH_H = 3;
const FUTURE_SLACK_MIN = 10;

// Файли, які пише `make data` (pipeline/sky/build.py); `data/static/*` лежать у репо.
export const DATA_FILES = ['meta', 'profile', 'galileo', 'kp', 'climate'] as const;

export interface PagesMeta {
  generatedAt: string;
  mock: boolean;
  sources: { id: string; status: string }[];
}

export interface DataPlan { fetch: boolean; reason: string }

export function dataPlan(event: string, meta: PagesMeta | null, nowMs: number): DataPlan {
  if (event === 'schedule') return { fetch: true, reason: 'розклад (кожні 3 год)' };
  if (!meta) return { fetch: true, reason: 'немає meta.json на Pages' };
  const t = Date.parse(meta.generatedAt);
  if (Number.isNaN(t)) return { fetch: true, reason: 'невідомий час meta.generatedAt на Pages' };
  const min = (nowMs - t) / 60_000;
  if (min < -FUTURE_SLACK_MIN) return { fetch: true, reason: 'meta.generatedAt на Pages у майбутньому' };
  if (min > DATA_FRESH_H * 60) {
    return { fetch: true, reason: `дані на Pages старші за ${DATA_FRESH_H} год (${(min / 60).toFixed(1)} год)` };
  }
  if (meta.mock) return { fetch: true, reason: 'на Pages MOCK' };
  if (!meta.sources?.length) return { fetch: true, reason: 'на Pages немає джерел' };
  const bad = meta.sources.filter((s) => s.status !== 'ok');
  if (bad.length) {
    return { fetch: true, reason: `на Pages не всі джерела ok: ${bad.map((s) => `${s.id}=${s.status}`).join(', ')}` };
  }
  return { fetch: false, reason: `дані з Pages: ${Math.floor(Math.max(0, min) / 60)} год тому, усі джерела ok` };
}

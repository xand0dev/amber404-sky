// Вікно для польоту людською мовою (issue #87 AC4): «зараз → +48 год», якщо вікно вже почалось.
import { useEffect, useState } from 'react';
import type { Lang } from '../core';
import { windowLabel } from './lang';

const H = 3_600_000;
const NOW: Record<Lang, string> = { uk: 'зараз → +{n} год', en: 'now → +{n} h' };

/** Вікно, що вже почалось, — «зараз → +N год» (N — годин до кінця вікна від поточної години); інакше — як windowLabel. */
export function humanWindow(w: { start: string; end: string; hours: number } | null, lastIso: string, nowMs: number, lang: Lang): string {
  if (!w || Date.parse(w.start) > nowMs) return windowLabel(w, lastIso, lang);
  // Кінець вікна — хвилина 59 останньої години; рахуємо до кінця цієї години.
  const n = Math.round((Date.parse(w.end) + 60_000 - Math.floor(nowMs / H) * H) / H);
  return NOW[lang].replace('{n}', String(n));
}

/** Поточний час, оновлюється раз на хвилину (для «зараз» і віку прогнозу). */
export function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), stepMs); return () => clearInterval(id); }, [stepMs]);
  return now;
}

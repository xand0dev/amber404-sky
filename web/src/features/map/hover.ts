// F3-AC6: дані для підказки при наведенні — лише з core (weatherAt, evaluate). Чистий TS без DOM.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import { cellOf, evaluate, t, weatherAt, type Lang, type Level } from '../../core';

export interface HoverInfo { ws: number | null; dir: number | null; g: number | null; t: number | null; visKm: number | null; level: Level; reason: string }

/** Погода й вердикт у точці на обраній висоті, годині й дроні; поза сіткою — null. */
export function hoverInfo(data: Bundle, s: AppState, lat: number, lon: number, lang: Lang): HoverInfo | null {
  if (!cellOf(data.meta.grid, lat, lon)) return null;
  const wx = weatherAt({ meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo }, lat, lon, s.altM, s.hour);
  const prof = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];
  const v = evaluate(wx, prof, s.altM, lang);
  return { ws: wx.ws, dir: wx.dir, g: wx.g, t: wx.t, visKm: wx.vis == null ? null : wx.vis / 1000, level: v.level, reason: v.reasons[0] ?? '' };
}

// Підписи полів: у core/i18n (F0) таких ключів немає, тому тут.
const L = {
  uk: { wind: 'Вітер', gust: 'Пориви', temp: 'Темп.', vis: 'Видимість', verdict: 'Вердикт', m: 'м', ms: 'м/с', km: 'км', none: 'немає даних' },
  en: { wind: 'Wind', gust: 'Gusts', temp: 'Temp.', vis: 'Visibility', verdict: 'Verdict', m: 'm', ms: 'm/s', km: 'km', none: 'no data' },
};

const f1 = (x: number) => x.toFixed(1).replace('-', '−');

/** Рядки [підпис, значення]; null → «немає даних». */
export function hoverRows(i: HoverInfo, lang: Lang, altM: number): [string, string][] {
  const l = L[lang], or = (x: number | null, f: (x: number) => string) => (x == null ? l.none : f(x));
  return [
    [`${l.wind} ${altM} ${l.m}`, or(i.ws, (ws) => `${f1(ws)} ${l.ms}${i.dir == null ? '' : ` · ${Math.round(i.dir)}°`}`)],
    [l.gust, or(i.g, (g) => `${f1(g)} ${l.ms}`)],
    [l.temp, or(i.t, (x) => `${f1(x)} °C`)],
    [l.vis, or(i.visKm, (v) => `${f1(v)} ${l.km}`)],
    [l.verdict, [t(`lv.${i.level}`, lang), i.reason].filter(Boolean).join(' · ')],
  ];
}

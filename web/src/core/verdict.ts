// Вердикт і вікно для польоту (SPEC §6.7, §7.4, §7.5).
import type { DroneProfile } from '../contracts';
import type { Weather } from './weather';
import { t as tr, type Lang } from './i18n';

export type Level = 'GO' | 'CAUTION' | 'NO-GO' | 'NO-DATA';
export interface Verdict { level: Level; reasons: string[] }
export type Window = { start: string; end: string; hours: number } | null;

export const GO_TEXT = tr('go', 'uk');
const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

export function isIcing(t: number | null, rh: number | null, p: number | null): boolean {
  if (t == null) return false;
  return t >= -10 && t <= 2 && ((rh != null && rh >= 90) || (p != null && p > 0.05));
}

/** Причини — мовою lang (issue #44); рівень від мови не залежить. */
export function evaluate(wx: Weather, pr: DroneProfile, altM: number, lang: Lang = 'uk'): Verdict {
  if (wx.ws == null) return { level: 'NO-DATA', reasons: [tr('r.nodata', lang)] };
  const no: string[] = [];
  const ca: string[] = [];
  const { ws, g, t, cb, p, rh, vis, kp } = wx;

  if (ws > pr.windMs) no.push(tr('r.wind', lang, { v: f1(ws), lim: f1(pr.windMs) }));
  if (cb != null && altM >= cb) no.push(tr('r.cloud', lang, { alt: altM, cb: Math.round(cb) }));
  if (g != null && g > pr.gustMs) no.push(tr('r.gust', lang, { v: f1(g), lim: f1(pr.gustMs) }));
  if (t != null && t < pr.tMinC) no.push(tr('r.temp', lang, { v: f1(t), lim: f1(pr.tMinC) }));
  if (p != null && p > Math.max(pr.precipMmH, 0.05)) no.push(tr('r.precip', lang, { v: f1(p), lim: f1(pr.precipMmH) }));
  if (isIcing(t, rh, p)) no.push(tr('r.icing', lang, { t: f1(t as number), rh: Math.round(rh ?? 0) }));

  if (ws <= pr.windMs && ws > 0.8 * pr.windMs) ca.push(tr('c.wind', lang, { v: f1(ws) }));
  if (cb != null && altM < cb && altM >= cb - 60) ca.push(tr('c.cloud', lang, { alt: altM, cb: Math.round(cb) }));
  if (g != null && g <= pr.gustMs && g > 0.8 * pr.gustMs) ca.push(tr('c.gust', lang, { v: f1(g) }));
  if (t != null && t >= pr.tMinC && t < pr.tMinC + 5) ca.push(tr('c.temp', lang, { v: f1(t) }));
  if (vis != null && vis < 1000) ca.push(tr('c.vis', lang, { v: Math.round(vis) }));
  if (kp != null && kp >= 5) ca.push(tr('c.kp', lang, { v: f1(kp) }));
  if (wx.galVisible != null && wx.galVisible < 6) ca.push(tr('c.galVisible', lang, { n: wx.galVisible }));
  if (wx.galPdop != null && wx.galPdop > 4) ca.push(tr('c.galPdop', lang, { v: f1(wx.galPdop) }));

  if (no.length) return { level: 'NO-GO', reasons: [...no, ...ca].slice(0, 4) };
  if (ca.length) return { level: 'CAUTION', reasons: ca.slice(0, 4) };
  return { level: 'GO', reasons: [tr('go', lang)] };
}

/** Перший відрізок ≥ minHours послідовних годин GO від fromIdx (§7.5). */
export function nextWindow(series: Verdict[], times: string[], fromIdx: number, minHours = 2): Window {
  let i = fromIdx;
  while (i < series.length) {
    if (series[i].level !== 'GO') { i++; continue; }
    let j = i;
    while (j + 1 < series.length && series[j + 1].level === 'GO') j++;
    const hours = j - i + 1;
    if (hours >= minHours) {
      const end = new Date(Date.parse(times[j]) + 3600_000 - 60_000).toISOString();
      return { start: times[i], end, hours };
    }
    i = j + 1;
  }
  return null;
}

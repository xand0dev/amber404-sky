// Вердикт і вікно для польоту (SPEC §6.7, §7.4, §7.5).
import type { DroneProfile } from '../contracts';
import type { Weather } from './weather';

export type Level = 'GO' | 'CAUTION' | 'NO-GO' | 'NO-DATA';
export interface Verdict { level: Level; reasons: string[] }
export type Window = { start: string; end: string; hours: number } | null;

export const GO_TEXT = 'Умови в межах профілю';
const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

export function isIcing(t: number | null, rh: number | null, p: number | null): boolean {
  if (t == null) return false;
  return t >= -10 && t <= 2 && ((rh != null && rh >= 90) || (p != null && p > 0.05));
}

export function evaluate(wx: Weather, pr: DroneProfile, altM: number): Verdict {
  if (wx.ws == null) return { level: 'NO-DATA', reasons: ['Немає даних про вітер'] };
  const no: string[] = [];
  const ca: string[] = [];
  const { ws, g, t, cb, p, rh, vis, kp } = wx;

  if (ws > pr.windMs) no.push(`Вітер ${f1(ws)} м/с > ліміт ${f1(pr.windMs)} м/с`);
  if (cb != null && altM >= cb) no.push(`Висота ${altM} м у хмарі: межа хмар ≈ ${Math.round(cb)} м`);
  if (g != null && g > pr.gustMs) no.push(`Пориви ${f1(g)} м/с > ліміт ${f1(pr.gustMs)} м/с`);
  if (t != null && t < pr.tMinC) no.push(`Температура ${f1(t)} °C < мінімум ${f1(pr.tMinC)} °C`);
  if (p != null && p > Math.max(pr.precipMmH, 0.05)) no.push(`Опади ${f1(p)} мм/год > ліміт ${f1(pr.precipMmH)} мм/год`);
  if (isIcing(t, rh, p)) no.push(`Обмерзання: ${f1(t as number)} °C, вологість ${Math.round(rh ?? 0)}%`);

  if (ws <= pr.windMs && ws > 0.8 * pr.windMs) ca.push(`Вітер ${f1(ws)} м/с — понад 80% ліміту`);
  if (cb != null && altM < cb && altM >= cb - 60) ca.push(`Висота ${altM} м близько до хмар (≈ ${Math.round(cb)} м)`);
  if (g != null && g <= pr.gustMs && g > 0.8 * pr.gustMs) ca.push(`Пориви ${f1(g)} м/с — понад 80% ліміту`);
  if (t != null && t >= pr.tMinC && t < pr.tMinC + 5) ca.push(`Температура ${f1(t)} °C — близько до мінімуму`);
  if (vis != null && vis < 1000) ca.push(`Видимість ${Math.round(vis)} м`);
  if (kp != null && kp >= 5) ca.push(`Магнітна буря: Kp ${f1(kp)}`);
  if (wx.galVisible != null && wx.galVisible < 6) ca.push(`Galileo: видно ${wx.galVisible} супутників`);
  if (wx.galPdop != null && wx.galPdop > 4) ca.push(`Galileo: PDOP ${f1(wx.galPdop)}`);

  if (no.length) return { level: 'NO-GO', reasons: [...no, ...ca].slice(0, 4) };
  if (ca.length) return { level: 'CAUTION', reasons: ca.slice(0, 4) };
  return { level: 'GO', reasons: [GO_TEXT] };
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

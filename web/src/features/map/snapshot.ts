// F3-AC7 (§7.12): штамп знімка й доставка PNG — share на телефоні, завантаження на ноутбуці. Без DOM.
import type { Bundle } from '../../app/data';
import type { AppState, LayerId } from '../../app/state';
import type { DroneProfile } from '../../contracts';
import { kyivDayHM, profileName, t, type Lang, type Verdict } from '../../core';
import { LAYERS } from '../layers/LayerPicker';

const EN_LAYER: Record<LayerId, string> = { wind: 'Wind', go: 'Can fly', gust: 'Gusts', cloud: 'Cloud base', icing: 'Icing', temp: 'Temp.', vis: 'Visibility' };
const L = {
  uk: { demo: 'демонстраційна модель, не офіційний прогноз', fc: 'Прогноз на', kyiv: '(Київ)', from: 'дані від', alt: 'Висота', m: 'м', layer: 'шар', at: 'Вердикт у', src: 'Джерела', nodata: 'немає даних' },
  en: { demo: 'demo model, not an official forecast', fc: 'Forecast for', kyiv: '(Kyiv)', from: 'data from', alt: 'Altitude', m: 'm', layer: 'layer', at: 'Verdict at', src: 'Sources', nodata: 'no data' },
};

function kyivEn(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** Рядки штампа: «AMBER Sky», час прогнозу, висота, дрон, шар, вердикт у точці, джерела (MOCK — якщо mock). */
export function stampLines(data: Bundle, s: AppState, v: Verdict, prof: DroneProfile, lang: Lang): string[] {
  const l = L[lang], when = (iso: string) => (lang === 'uk' ? kyivDayHM(iso) : kyivEn(iso));
  const layer = lang === 'uk' ? LAYERS.find(([id]) => id === s.layer)?.[1] ?? s.layer : EN_LAYER[s.layer];
  const fc = data.meta.times[s.hour];
  const src = data.meta.sources.map((x) => (x.status === 'ok' ? x.name : `${x.name} (${l.nodata})`)).join(', ');
  return [
    `AMBER Sky · ${l.demo}`,
    `${l.fc} ${fc ? when(fc) : '—'} ${l.kyiv} · ${l.from} ${when(data.meta.generatedAt)}`,
    `${l.alt} ${s.altM} ${l.m} · ${profileName(prof, lang)} · ${l.layer} ${layer}`,
    `${l.at} ${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}: ${t(`lv.${v.level}`, lang)}${v.reasons[0] ? ` — ${v.reasons[0]}` : ''}`,
    `${l.src}: ${src || '—'}${data.meta.mock ? ' · MOCK' : ''}`,
  ];
}

/** amber-sky-YYYY-MM-DD-HHMM.png за київським часом прогнозу. */
export function fileName(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `amber-sky-${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}.png`;
}

export interface ShareNav { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
export interface DeliverEnv { nav: ShareNav; download: (blob: Blob, name: string) => void }
export type Delivered = 'shared' | 'cancelled' | 'downloaded';

/** Телефон: меню «Поділитися» з PNG (Telegram, Signal…). Інакше або при помилці share — завантаження. */
export async function deliver(blob: Blob, name: string, env: DeliverEnv): Promise<Delivered> {
  const file = new File([blob], name, { type: 'image/png' });
  const data: ShareData = { files: [file], title: 'AMBER Sky' };
  if (env.nav.share && env.nav.canShare?.(data)) {
    try { await env.nav.share(data); return 'shared'; } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  env.download(blob, name);
  return 'downloaded';
}

/** Завантаження в браузері через тимчасове посилання (без мережі). */
export function browserDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Issue #171 AC2: причини вердикту — чипи з іконкою і значенням vs ліміт («вітер 9.2 / 10 м/с»), найгірша перша.
import type { ReactNode } from 'react';
import type { Lang, Weather } from '../../core';
import type { DroneProfile } from '../../contracts';
import { chips, type Chip, type ChipKind } from './chipsData';
import { pt, type PKey } from './strings';

const f = (x: number | null, d = 1) => (x == null ? '—' : x.toFixed(d));

/** Іконки 16 × 16, лінією кольору тексту (currentColor) — однаково вдень і вночі. */
const ICON: Record<ChipKind, ReactNode> = {
  wind: <path d="M1 6h9a2 2 0 1 0-2-2M1 10h12a2 2 0 1 1-2 2" />,
  gust: <path d="M1 4h7M1 8h12M1 12h7M11 2l3 2-3 2M11 10l3 2-3 2" />,
  cloud: <path d="M4 13h8a3 3 0 0 0 0-6 4 4 0 0 0-7.6-1A3.5 3.5 0 0 0 4 13z" />,
  icing: <path d="M8 1v14M2 4.5l12 7M2 11.5l12-7M6 2l2 2 2-2M6 14l2-2 2 2" />,
  temp: <path d="M6 9.5V3a2 2 0 0 1 4 0v6.5a3.5 3.5 0 1 1-4 0zM8 6v6" />,
  precip: <path d="M4 3l-1.5 3a1.6 1.6 0 1 0 3 0zM11 2l-2 4a2 2 0 1 0 4 0zM7 9l-1.5 3a1.6 1.6 0 1 0 3 0z" />,
  vis: <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  kp: <path d="M9 1L4 9h4l-1 6 5-8H8z" />,
  gal: <path d="M6 6l4 4M7 5l4 4-2 2-4-4zM1 2l4 4M15 14l-4-4M2 1l4 4M14 15l-4-4M3 13a3 3 0 0 0 3 0" />,
};

/** [мітка, значення, «/ ліміт», одиниця] — мовою інтерфейсу. */
function parts(c: Chip, prof: DroneProfile, lang: Lang): [string, string, string, string] {
  const t = (k: PKey) => pt(k, lang);
  switch (c.kind) {
    case 'wind': case 'gust': return [t(`chip.${c.kind}`), f(c.v), ` / ${c.lim}`, t('unit.ms')];
    case 'cloud': return [t('chip.cloud'), f(c.v, 0), `${t('chip.cloud.sep')}${c.lim}`, t('unit.m')];
    case 'icing': return [t('chip.icing'), t(c.sev === 'no' ? 'chip.yes' : 'chip.no'), '', ''];
    case 'temp': return [t('chip.temp'), f(c.v), `${t('chip.from')}${c.lim}`, '°C'];
    case 'precip': return [t('chip.precip'), f(c.v), ` / ${prof.precipMmH}`, t('unit.mmh')];
    case 'vis': return [t('chip.vis'), f(c.v == null ? null : c.v / 1000), `${t('chip.from')}${c.lim / 1000}`, t('unit.km')];
    case 'kp': return [t('chip.kp'), f(c.v), `${t('chip.upto')}${c.lim}`, ''];
    case 'gal': return [t('chip.gal'), f(c.v, 0), `${t('chip.from')}${c.lim}`, `${t('chip.sat')}${c.v2 != null ? ` · PDOP ${f(c.v2)}` : ''}`];
  }
}

export function ChipsView({ wx, prof, altM, lang }: { wx: Weather; prof: DroneProfile; altM: number; lang: Lang }) {
  return (
    <ul className="chips" data-testid="chips" aria-label={pt('chip.aria', lang)}>
      {chips(wx, prof, altM).map((c) => {
        const [label, v, lim, unit] = parts(c, prof, lang);
        return (
          <li key={c.kind} className={`chip sev-${c.sev}`} data-sev={c.sev}>
            <svg className="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">{ICON[c.kind]}</svg>
            {c.sev === 'nodata'
              ? <span>{label} — {pt('chip.nodata', lang)}</span>
              : <span>{label} <b>{v}</b>{lim}{unit && <> <small>{unit}</small></>}</span>}
          </li>
        );
      })}
    </ul>
  );
}

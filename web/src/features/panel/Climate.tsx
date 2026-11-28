// F4 (Оля): картка «Клімат Copernicus ERA5» (SPEC §6.5, §7.8; демо §3 крок 5) — % льотних годин по місяцях
// для обраного дрона в найближчому з 5 міст, поточний місяць виділено.
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { profileName, type Lang } from '../../core';
import type { DroneProfile } from '../../contracts';
import { cityName } from '../map/translit';
import { climateFor, kyivMonth, type ClimateView } from './climateData';
import { pt, type PKey } from './strings';

const W = 300, H = 110, B = 16, T = 14;

export interface ClimateCardProps { view: ClimateView; month: number; drone: string; coveredNames: string[]; lang: Lang }

export function ClimateCard({ view, month, drone, coveredNames, lang }: ClimateCardProps) {
  const t = (k: PKey, p?: Record<string, string | number>) => pt(k, lang, p);
  if (view.kind === 'nodata') return <section className="psec climate" aria-label={t('cl')}><h3>{t('cl')}</h3><p className="pnote">{t('cl.nodata')}</p></section>;
  if (view.kind === 'noclass') return (
    <section className="psec climate" aria-label={t('cl')}><h3>{t('cl')}</h3><p className="pnote" data-testid="cl-noclass">{t('cl.noclass', { list: coveredNames.join(', ') })}</p></section>
  );
  const names = t('cl.m').split('|'), short = t('cl.mShort').split('|');
  const city = cityName({ name: view.city }, lang);
  const bw = W / 12;
  return (
    <section className="psec climate" aria-label={t('cl')}>
      <h3>{t('cl')}</h3>
      <p className="pnote">{t('cl.where', { city, year: view.year, km: Math.round(view.km) })}</p>
      <p className="clmain" data-testid="cl-month">{t('cl.month', { month: names[month], p: Math.round(view.months[month]) })}</p>
      <svg className="clsvg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={t('cl.aria', { city, year: view.year, list: view.months.map((p, i) => `${short[i]} ${Math.round(p)}%`).join(', ') })}>
        {view.months.map((p, i) => {
          const h = (Math.max(0, Math.min(100, p)) / 100) * (H - B - T);
          return (
            <g key={i}>
              <rect data-testid="cl-bar" className={i === month ? 'clbar on' : 'clbar'} x={i * bw + 2} y={H - B - h} width={bw - 4} height={h} />
              <text className="cllbl" x={i * bw + bw / 2} y={H - B - h - 3} textAnchor="middle">{Math.round(p)}</text>
              <text className={i === month ? 'cllbl on' : 'cllbl'} x={i * bw + bw / 2} y={H - 4} textAnchor="middle">{short[i]}</text>
            </g>
          );
        })}
      </svg>
      <p className="pnote">{t('cl.note', { drone })} · Copernicus ERA5 ({view.source})</p>
    </section>
  );
}

export function Climate({ prof, timeIso }: { prof: DroneProfile; timeIso: string }) {
  const { data, s } = useApp();
  const { lang } = useT();
  const view = climateFor(data.climate, data.cities, s.lat, s.lon, prof.id);
  const covered = data.profiles.filter((p) => view.kind === 'noclass' && view.covered.includes(p.id)).map((p) => profileName(p, lang));
  return <ClimateCard view={view} month={kyivMonth(timeIso)} drone={profileName(prof, lang)} coveredNames={covered} lang={lang} />;
}

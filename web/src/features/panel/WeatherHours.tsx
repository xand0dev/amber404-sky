// F3-AC3 у панелі (F4, Оля): таблиця на 24 год — вітер 10/80/120 м зі стрілками, пориви, темп., опади, видимість,
// обмерзання, Kp, Galileo. Ті самі години, що в «висоти × години» (сторінки 1–24 / 25–48).
import { useMemo, type ReactNode } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { kyivHM, type Lang } from '../../core';
import type { DroneProfile } from '../../contracts';
import { arrowDeg } from './place';
import { pageStart } from './heights';
import { HOUR_ALTS, hoursTable, type Flag, type HourCol } from './hoursData';
import { pt, type PKey } from './strings';

const f = (x: number | null, d = 1) => (x == null ? '—' : x.toFixed(d));

export interface WeatherHoursViewProps { cols: HourCol[]; times: string[]; hour: number; lang: Lang }

export function WeatherHoursView({ cols, times, hour, lang }: WeatherHoursViewProps) {
  const t = (k: PKey, p?: Record<string, string | number>) => pt(k, lang, p);
  const td = (c: HourCol, flag: Flag, body: ReactNode, key: string) => (
    <td key={key} className={`whc${flag ? ` ${flag}` : ''}${c.hour === hour ? ' on' : ''}`} data-flag={flag ?? undefined}>{body}</td>
  );
  const row = (label: string, testId: string, cell: (c: HourCol) => [Flag, ReactNode]) => (
    <tr data-testid={testId}><th scope="row">{label}</th>{cols.map((c) => { const [fl, b] = cell(c); return td(c, fl, b, String(c.hour)); })}</tr>
  );
  return (
    <section className="psec whours" aria-label={t('wh')}>
      <h3>{t('wh')}</h3>
      <div className="hgrid">
        <table className="whtable" aria-label={t('wh.aria')}>
          <thead><tr><th scope="col" />{cols.map((c) => <th key={c.hour} scope="col" className={c.hour === hour ? 'on' : undefined}>{kyivHM(times[c.hour]).slice(0, 2)}</th>)}</tr></thead>
          <tbody>
            {HOUR_ALTS.map((alt, i) => row(t('wh.wind', { alt }), `wh-wind-${alt}`, (c) => {
              const w = c.wind[i];
              return [w.flag, <>{w.ws == null ? '—' : Math.round(w.ws)}{w.dir != null && w.ws != null && <span className="a" aria-hidden="true" style={{ transform: `rotate(${arrowDeg(w.dir)}deg)` }}>↑</span>}</>];
            }))}
            {row(t('wh.gust'), 'wh-gust', (c) => [c.gFlag, f(c.g, 0)])}
            {row(t('wh.temp'), 'wh-temp', (c) => [c.tFlag, f(c.t, 0)])}
            {row(t('wh.precip'), 'wh-precip', (c) => [c.pFlag, f(c.p)])}
            {row(t('wh.vis'), 'wh-vis', (c) => [c.visFlag, c.vis == null ? '—' : (c.vis / 1000).toFixed(c.vis < 10_000 ? 1 : 0)])}
            {row(t('wh.icing'), 'wh-icing', (c) => [c.icing ? 'no' : null, c.icing == null ? '—' : c.icing ? t('wh.yes') : t('wh.no')])}
            {row(t('wh.kp'), 'wh-kp', (c) => [c.kpFlag, f(c.kp)])}
            {row(t('wh.gal'), 'wh-gal', (c) => [c.galFlag, c.galVisible == null ? '—' : <>{c.galVisible}<small> {f(c.galPdop)}</small></>])}
          </tbody>
        </table>
      </div>
      <p className="pnote">{t('wh.legend')}</p>
    </section>
  );
}

export function WeatherHours({ prof }: { prof: DroneProfile }) {
  const { data, s } = useApp();
  const { lang } = useT();
  const start = pageStart(s.hour, data.meta.times.length);
  const cols = useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    return hoursTable(src, s.lat, s.lon, prof, start);
  }, [data, s.lat, s.lon, prof, start]);
  return <WeatherHoursView cols={cols} times={data.meta.times} hour={s.hour} lang={lang} />;
}

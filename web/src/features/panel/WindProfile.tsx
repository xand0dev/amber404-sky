// F4 (Оля): профіль вітру в точці (T3, SPEC §7.5a) — сила й напрям по висотах, робоча висота дрона, ліміт, хмари, зсув.
import { useMemo } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import type { Lang } from '../../core';
import type { DroneProfile } from '../../contracts';
import { arrowDeg } from './place';
import { pt, type PKey } from './strings';
import { windProfile, type WindProfileData } from './windProfile';

const W = 300, H = 240, L = 40, R = 12, T = 10, B = 22;

export interface WindProfileViewProps { data: WindProfileData; prof: DroneProfile; altM: number; hourLabel: string; lang: Lang }

export function WindProfileView({ data, prof, altM, hourLabel, lang }: WindProfileViewProps) {
  const t = (k: PKey, p?: Record<string, string | number>) => pt(k, lang, p);
  const m = t('unit.m');
  const vals = data.levels.map((l) => l.ws).filter((v): v is number => v != null);
  const xMax = Math.max(prof.windMs * 1.25, ...vals, 1);
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const y = (a: number) => H - B - (a / data.topM) * (H - B - T);
  const pts = data.levels.filter((l) => l.ws != null).map((l) => `${x(l.ws as number).toFixed(1)},${y(l.altM).toFixed(1)}`).join(' ');
  const band0 = Math.min(prof.bandM[0], data.topM), band1 = Math.min(prof.bandM[1], data.topM);
  const cloud = data.cb != null && data.cb < data.topM ? data.cb : null;
  const ticks = [0, 100, 200, 300, 400, 500, 750, 1000].filter((a) => a <= data.topM);
  const lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null;
  return (
    <section className="psec wprofile" aria-label={t('pr')}>
      <h3>{t('pr')} · {hourLabel}</h3>
      <svg className="wpsvg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={t('pr.aria', { h: hourLabel, lo: lo == null ? '—' : lo.toFixed(1), hi: hi == null ? '—' : hi.toFixed(1), lim: prof.windMs })}>
        <defs>
          <pattern id="wp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="wphatch" />
          </pattern>
        </defs>
        <rect data-testid="wp-band" className="wpband" x={L} y={y(band1)} width={W - L - R} height={Math.max(0, y(band0) - y(band1))} />
        {cloud != null && <rect data-testid="wp-cloud" x={L} y={T} width={W - L - R} height={Math.max(0, y(cloud) - T)} fill="url(#wp-hatch)" />}
        {ticks.map((a) => (
          <g key={a}><line className="wpgrid" x1={L} x2={W - R} y1={y(a)} y2={y(a)} /><text className="wplbl" x={L - 4} y={y(a) + 3} textAnchor="end">{a}</text></g>
        ))}
        <line data-testid="wp-limit" className="wplimit" x1={x(prof.windMs)} x2={x(prof.windMs)} y1={T} y2={H - B} />
        <text className="wplbl wplimtxt" x={x(prof.windMs) + 3} y={H - B - 4}>{t('pr.limit', { lim: prof.windMs })}</text>
        {pts && <polyline data-testid="wp-line" className="wpline" points={pts} />}
        {data.levels.map((l) => l.ws != null && l.dir != null && (
          <text key={l.altM} data-testid="wp-arrow" className="wparrow" x={x(l.ws)} y={y(l.altM) + 4} textAnchor="middle"
            transform={`rotate(${arrowDeg(l.dir)} ${x(l.ws)} ${y(l.altM)})`}>↑</text>
        ))}
        <line data-testid="wp-alt" className="wpalt" x1={L - 6} x2={L + 10} y1={y(Math.min(altM, data.topM))} y2={y(Math.min(altM, data.topM))} />
        {data.shear.map((s) => (
          <text key={s.altM} data-testid="wp-shear" className="wpshear" x={W - R - 2} y={y(s.altM) - 3} textAnchor="end">{t('pr.shear', { deg: s.deg })}</text>
        ))}
        <text className="wplbl" x={L} y={H - 6}>0</text>
        <text className="wplbl" x={W - R} y={H - 6} textAnchor="end">{xMax.toFixed(0)} {t('unit.ms')}</text>
        <text className="wplbl" x={L - 4} y={T + 26} textAnchor="end">{m}</text>
      </svg>
      <p className="pnote" data-testid="wp-summary">
        {data.shear.length ? t('pr.shears', { list: data.shear.map((s) => `${s.altM} ${m} — ${s.deg}°`).join(', ') }) : t('pr.noShear')}
        {data.cb != null && ` · ${t('pr.cloud', { cb: Math.round(data.cb) })}`}
      </p>
      <p className="pnote">{t('pr.legend')}</p>
    </section>
  );
}

export function WindProfile({ prof, hourLabel }: { prof: DroneProfile; hourLabel: string }) {
  const { data, s } = useApp();
  const { lang } = useT();
  const d = useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    return windProfile(src, s.lat, s.lon, s.hour, prof);
  }, [data, s.lat, s.lon, s.hour, prof]);
  return <WindProfileView data={d} prof={prof} altM={s.altM} hourLabel={hourLabel} lang={lang} />;
}

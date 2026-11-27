// F4 (Оля): картка зони польоту (SPEC §7.5b, issue #15) — контур, кільця відстаней, стрілка вітру, червоні точки обриву.
// Розрахунок — core/zone.ts і core/energy.ts (F0); контур на самій карті — #22 (F0).
import { useMemo, useState } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { fromUV, weatherAt, windAt, type Lang } from '../../core';
import { arrowDeg } from './place';
import { pt } from './strings';
import { project, ringsKm, zoneFor, type AnyProfile, type ZoneResult } from './zoneLogic';

export type ZoneMode = 'roundtrip' | 'oneway';
const km = (m: number) => (m / 1000).toFixed(m < 10_000 ? 1 : 0);

export interface ZoneViewProps {
  zone: ZoneResult; lat: number; lon: number; mode: ZoneMode; onMode: (m: ZoneMode) => void;
  wind: { ws: number; dir: number } | null; altM: number; hourLabel: string; lang: Lang;
}

const S = 240, C = S / 2, R = 100;

export function ZoneView({ zone, lat, lon, mode, onMode, wind, altM, hourLabel, lang }: ZoneViewProps) {
  const L = (k: Parameters<typeof pt>[0], p?: Record<string, string | number>) => pt(k, lang, p);
  const rings = ringsKm(zone.maxM);
  const outer = Math.max(zone.maxM, (rings[rings.length - 1] ?? 0) * 1000, 1);
  const sc = R / outer;
  const xy = zone.pts.map((q) => project(lat, lon, q.lat, q.lon, sc));
  const poly = xy.map(([x, y]) => `${(C + x).toFixed(1)},${(C + y).toFixed(1)}`).join(' ');
  const all = zone.pts.length;
  const a = wind ? (arrowDeg(wind.dir) * Math.PI) / 180 : 0;
  const ax = Math.sin(a) * 28, ay = -Math.cos(a) * 28;
  return (
    <section className="psec pzone" aria-label={L('zone')}>
      <h3>{L('zone')} · {altM} м</h3>
      <div className="pbtns" role="group" aria-label={L('zone')}>
        <button type="button" aria-pressed={mode === 'roundtrip'} onClick={() => onMode('roundtrip')}>{L('zone.rt')}</button>
        <button type="button" aria-pressed={mode === 'oneway'} onClick={() => onMode('oneway')}>{L('zone.ow')}</button>
      </div>
      <svg className="zonesvg" viewBox={`0 0 ${S} ${S}`} role="img"
        aria-label={L('zone.aria', { km: km(zone.maxM), ws: wind ? wind.ws.toFixed(1) : '—', dir: wind ? wind.dir.toFixed(0) : '—' })}>
        {rings.map((r) => (
          <g key={r} data-testid="zone-ring">
            <circle className="ring" cx={C} cy={C} r={r * 1000 * sc} />
            <text className="ringlbl" x={C + 2} y={C - r * 1000 * sc - 2}>{r} км</text>
          </g>
        ))}
        <text className="north" x={C - 3} y={10}>N</text>
        {zone.maxM > 0 && <polygon className="contour" data-testid="zone-contour" points={poly} />}
        {zone.pts.map((q, i) => (q.stop === 'wind-limit' || q.stop === 'no-data') && (
          <circle key={i} className={q.stop === 'wind-limit' ? 'cut' : 'nod'} data-testid={`zone-${q.stop}`} cx={C + xy[i][0]} cy={C + xy[i][1]} r={3} />
        ))}
        <circle className="home" cx={C} cy={C} r={3} />
        {wind && wind.ws > 0.1 && (
          <g data-testid="zone-wind">
            <line className="wind" x1={C - ax} y1={C - ay} x2={C + ax} y2={C + ay} />
            <circle className="windhead" cx={C + ax} cy={C + ay} r={3.5} />
          </g>
        )}
      </svg>
      <p>{L('zone.max', { km: km(zone.maxM) })}, {L('zone.min', { km: km(zone.minM) })}</p>
      {zone.counts['wind-limit'] > 0 && <p className="perr">{L('zone.cut', { n: zone.counts['wind-limit'], all })}</p>}
      {zone.counts['too-strong'] > 0 && <p className="perr">{L('zone.strong', { n: zone.counts['too-strong'], all })}</p>}
      {zone.counts['no-data'] > 0 && <p className="pnote">{L('zone.nodata', { n: zone.counts['no-data'], all })}</p>}
      <p className="pnote" data-testid="zone-time">{L('zone.time', { why: zone.why, t: zone.min.toFixed(1), u: (zone.usableS / 60).toFixed(1) })}</p>
      <p className="pnote">{L('zone.note', { alt: altM, h: hourLabel })}</p>
    </section>
  );
}

export function Zone({ prof, hourLabel }: { prof: AnyProfile; hourLabel: string }) {
  const { data, s } = useApp();
  const { lang } = useT();
  const [mode, setMode] = useState<ZoneMode>('roundtrip');
  const calc = useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    const t = weatherAt(src, s.lat, s.lon, 10, s.hour).t;
    const w0 = windAt(data.meta.grid, data.profile, s.altM, s.hour, s.lat, s.lon);
    const zone = zoneFor(prof, s.lat, s.lon, t, (la, lo) => windAt(data.meta.grid, data.profile, s.altM, s.hour, la, lo), mode);
    const [ws, dir] = w0 ? fromUV(w0[0], w0[1]) : [0, 0];
    return { zone, wind: w0 ? { ws, dir } : null };
  }, [data, prof, s.lat, s.lon, s.altM, s.hour, mode]);
  return <ZoneView {...calc} lat={s.lat} lon={s.lon} mode={mode} onMode={setMode} altM={s.altM} hourLabel={hourLabel} lang={lang} />;
}

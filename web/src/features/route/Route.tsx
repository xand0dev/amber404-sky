// F4 (Оля): маршрут A → B (SPEC §7.5a, F4-AC3). Точки лише в стані браузера — на сервер не йдуть.
import { useMemo, useState } from 'react';
import { useApp } from '../../app/state';
import { effectiveEndurance, evaluate, usableSeconds, weatherAt, windAt, type Level, type Pt, type Wind3Fn } from '../../core';
import { LEVEL_COLOR } from '../layers/colors';
import { batteryCheck, routeSummary, type RouteSummary } from './routeLogic';
import { energyInput, type AnyProfile } from '../panel/zoneLogic';
import './route.css';

const n1 = (x: number) => x.toFixed(1);
const min = (s: number | null) => (s == null ? 'не долетить' : `${(s / 60).toFixed(1)} хв`);
const pt = (p: Pt | null) => (p ? `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}` : '—');

export interface RouteViewProps {
  a: Pt | null; b: Pt | null; altM: number;
  summary: RouteSummary | null; battery: { level: Level; reasons: string[] } | null;
  usableS: number; why: string;
  onSetA: () => void; onSetB: () => void; onClear: () => void;
}

/** Розріз: стовпці вгору — попутний, вниз — зустрічний; сірий — немає даних. */
function Cut({ cut }: { cut: RouteSummary['cut'] }) {
  const W = 320, H = 80, mid = H / 2, bw = W / cut.length;
  const top = Math.max(1, ...cut.map((c) => Math.abs(c.along ?? 0)));
  return (
    <svg className="cut" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Розріз попутного й зустрічного вітру, макс ${n1(top)} м/с`}>
      <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--rule)" />
      {cut.map((c, i) => {
        const v = c.along, h = v == null ? mid : (Math.abs(v) / top) * (mid - 2);
        const y = v == null ? 0 : v >= 0 ? mid - h : mid;
        const fill = v == null ? 'var(--rule)' : v >= 0 ? 'var(--go)' : 'var(--no)';
        return (
          <rect key={i} data-testid="cut-bar" x={i * bw + 0.5} y={y} width={bw - 1} height={Math.max(h, 0.5)} fill={fill}>
            <title>{v == null ? 'немає даних' : `${v >= 0 ? 'попутний' : 'зустрічний'} ${n1(Math.abs(v))} м/с · ${Math.round(c.altM)} м`}</title>
          </rect>
        );
      })}
      <text x={2} y={10} className="cutlbl">попутний ↑</text>
      <text x={2} y={H - 2} className="cutlbl">зустрічний ↓</text>
    </svg>
  );
}

export function RouteView({ a, b, altM, summary, battery, usableS, why, onSetA, onSetB, onClear }: RouteViewProps) {
  return (
    <section className="route" aria-label="Маршрут A → B">
      <h3>Маршрут A → B · {altM} м</h3>
      <div className="routebtns">
        <button type="button" onClick={onSetA}>A = точка</button>
        <button type="button" onClick={onSetB}>B = точка</button>
        <button type="button" onClick={onClear}>Скинути</button>
      </div>
      <p className="coord">A: {pt(a)} · B: {pt(b)}</p>
      {!summary || !battery ? (
        <p className="hint">Поставте A і B: оберіть точку на карті й натисніть «A = точка», потім другу — «B = точка».</p>
      ) : (
        <>
          <Cut cut={summary.cut} />
          <dl className="vals">
            <div><dt>Відстань</dt><dd>{(summary.route.distM / 1000).toFixed(1)} км · {Math.round(summary.route.bearing)}°</dd></div>
            <div><dt>Туди</dt><dd>{min(summary.route.there.timeS)}</dd></div>
            <div><dt>Назад</dt><dd>{min(summary.route.back.timeS)}</dd></div>
            <div><dt>Зустрічний макс</dt><dd>{n1(summary.maxHead)} м/с</dd></div>
            <div><dt>Боковий макс</dt><dd>{n1(summary.maxCross)} м/с</dd></div>
            <div><dt>Найкраща висота</dt><dd>{summary.best ? `${summary.best.altM} м · ${min(summary.best.totalS)}` : 'немає без NO-GO'}</dd></div>
          </dl>
          <p className="battery" data-testid="route-battery" style={{ borderColor: LEVEL_COLOR[battery.level] }}>
            <b>{battery.level}</b> · {battery.reasons.join('; ')}
          </p>
          <p className="coord">T×0.8 = {(usableS / 60).toFixed(1)} хв ({why}) · коефіцієнти — assumption</p>
        </>
      )}
    </section>
  );
}

export function Route() {
  const { data, s } = useApp();
  const [a, setA] = useState<Pt | null>(null);
  const [b, setB] = useState<Pt | null>(null);
  const prof: AnyProfile = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];

  const calc = useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    const tA = a ? weatherAt(src, a.lat, a.lon, 10, s.hour).t : null;
    // Свій дрон (F4-AC6): вантаж і паливо з профілю, якщо є.
    const e = effectiveEndurance(energyInput(prof, tA));
    const usableS = usableSeconds(e.min);
    if (!a || !b) return { usableS, why: e.why, summary: null, battery: null };
    const wind: Wind3Fn = (lat, lon, alt) => windAt(data.meta.grid, data.profile, alt, s.hour, lat, lon);
    const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
    // assumption: NO-GO висоти перевіряємо в A, середині й B маршруту.
    const isNoGo = (alt: number) => [a, mid, b].some((p) => evaluate(weatherAt(src, p.lat, p.lon, alt, s.hour), prof, alt).level === 'NO-GO');
    const summary = routeSummary(a, b, prof.cruiseMs, s.altM, wind, isNoGo);
    return { usableS, why: e.why, summary, battery: batteryCheck(summary.route, usableS, summary.noData) };
  }, [data, prof, a, b, s.altM, s.hour]);

  return (
    <RouteView a={a} b={b} altM={s.altM} {...calc}
      onSetA={() => setA({ lat: s.lat, lon: s.lon })} onSetB={() => setB({ lat: s.lat, lon: s.lon })}
      onClear={() => { setA(null); setB(null); }} />
  );
}

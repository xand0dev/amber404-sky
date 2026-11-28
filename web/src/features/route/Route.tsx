// F4 (Оля): маршрут A → B (SPEC §7.5a, F4-AC3). A — обрана точка (старт), B — тап по карті (RouteLayer).
// Точки лише в пам'яті сторінки — на сервер не йдуть.
import { useMemo } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { distanceM, effectiveEndurance, evaluate, usableSeconds, weatherAt, windAt, type Lang, type Level, type Pt, type Wind3Fn } from '../../core';
import { LEVEL_COLOR } from '../layers/colors';
import { batteryCheck, routeSummary, type RouteSummary } from './routeLogic';
import { energyInput, energyWhy, type AnyProfile } from '../panel/zoneLogic';
import { pt as tr, type PKey } from '../panel/strings';
import { resetRoute, setRoute, useRoute } from './routeStore';
import './route.css';

/** Ближче — маршрут не має сенсу (A і B майже збігаються). */
export const MIN_ROUTE_M = 300;

const n1 = (x: number) => x.toFixed(1);
const min = (s: number | null, lang: Lang) => (s == null ? tr('rt.cant', lang) : `${(s / 60).toFixed(1)} ${tr('unit.min', lang)}`);
const pt = (p: Pt | null) => (p ? `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}` : '—');

export interface RouteViewProps {
  a: Pt | null; b: Pt | null; altM: number;
  summary: RouteSummary | null; battery: { level: Level; reasons: string[] } | null;
  usableS: number; why: string;
  picking?: boolean;
  onPick: () => void; onCancel?: () => void; onClear: () => void;
  lang?: Lang; // без провайдера мови — українська
}

/** Розріз: стовпці вгору — попутний, вниз — зустрічний; сірий — немає даних. */
function Cut({ cut, lang }: { cut: RouteSummary['cut']; lang: Lang }) {
  const L = (k: PKey, p?: Record<string, string | number>) => tr(k, lang, p);
  const W = 320, H = 80, mid = H / 2, bw = W / cut.length;
  const top = Math.max(1, ...cut.map((c) => Math.abs(c.along ?? 0)));
  return (
    <svg className="cut" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('rt.cut', { v: n1(top) })}>
      <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--rule)" />
      {cut.map((c, i) => {
        const v = c.along, h = v == null ? mid : (Math.abs(v) / top) * (mid - 2);
        const y = v == null ? 0 : v >= 0 ? mid - h : mid;
        const fill = v == null ? 'var(--rule)' : v >= 0 ? 'var(--go)' : 'var(--no)';
        return (
          <rect key={i} data-testid="cut-bar" x={i * bw + 0.5} y={y} width={bw - 1} height={Math.max(h, 0.5)} fill={fill}>
            <title>{v == null ? L('rt.nodata') : `${L(v >= 0 ? 'rt.tail' : 'rt.head')} ${n1(Math.abs(v))} ${L('unit.ms')} · ${Math.round(c.altM)} ${L('unit.m')}`}</title>
          </rect>
        );
      })}
      <text x={2} y={10} className="cutlbl">{L('rt.tail')} ↑</text>
      <text x={2} y={H - 2} className="cutlbl">{L('rt.head')} ↓</text>
    </svg>
  );
}

export function RouteView({ a, b, altM, summary, battery, usableS, why, picking = false, onPick, onCancel = () => {}, onClear, lang = 'uk' }: RouteViewProps) {
  const L = (k: PKey, p?: Record<string, string | number>) => tr(k, lang, p);
  const m = L('unit.m'), ms = L('unit.ms');
  const near = !!(a && b && distanceM(a, b) < MIN_ROUTE_M);
  return (
    <section className="route" aria-label={L('rt')}>
      <h3>{L('rt')} · {altM} {m}</h3>
      <p className="hint">{L('rt.why')}</p>
      <div className="routebtns">
        {picking ? (
          <button type="button" className="primary" aria-pressed="true" onClick={onCancel}>{L('rt.cancel')}</button>
        ) : (
          <button type="button" className="primary" onClick={onPick}>{L(b ? 'rt.change' : 'rt.pick')}</button>
        )}
        {b && !picking && <button type="button" onClick={onClear}>{L('rt.clear')}</button>}
      </div>
      {picking && <p className="hint" role="status">{L('rt.tapMap')}</p>}
      {b && <p className="coord">A: {pt(a)} · B: {pt(b)}</p>}
      {!b || picking ? null : near || !summary || !battery ? (
        <p className="hint">{L('rt.near', { m: MIN_ROUTE_M })}</p>
      ) : (
        <>
          <Cut cut={summary.cut} lang={lang} />
          <dl className="vals">
            <div><dt>{L('rt.dist')}</dt><dd>{(summary.route.distM / 1000).toFixed(1)} {L('unit.km')} · {Math.round(summary.route.bearing)}°</dd></div>
            <div><dt>{L('rt.there')}</dt><dd>{min(summary.route.there.timeS, lang)}</dd></div>
            <div><dt>{L('rt.back')}</dt><dd>{min(summary.route.back.timeS, lang)}</dd></div>
            <div><dt>{L('rt.maxHead')}</dt><dd>{n1(summary.maxHead)} {ms}</dd></div>
            <div><dt>{L('rt.maxCross')}</dt><dd>{n1(summary.maxCross)} {ms}</dd></div>
            <div><dt>{L('rt.best')}</dt><dd>{summary.best ? `${summary.best.altM} ${m} · ${min(summary.best.totalS, lang)}` : L('rt.noBest')}</dd></div>
          </dl>
          <p className="battery" data-testid="route-battery" style={{ borderColor: LEVEL_COLOR[battery.level] }}>
            <b>{battery.level}</b> · {battery.reasons.join('; ')}
          </p>
          <p className="coord">{L('rt.usable', { u: (usableS / 60).toFixed(1), why })}</p>
        </>
      )}
    </section>
  );
}

export function Route() {
  const { data, s } = useApp();
  const { lang } = useT();
  const { b, picking } = useRoute();
  const a: Pt = useMemo(() => ({ lat: s.lat, lon: s.lon }), [s.lat, s.lon]);
  const prof: AnyProfile = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];

  const calc = useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    const tA = weatherAt(src, a.lat, a.lon, 10, s.hour).t;
    // Свій дрон (F4-AC6): вантаж і паливо з профілю, якщо є.
    const ei = energyInput(prof, tA);
    const e = effectiveEndurance(ei);
    const why = energyWhy(ei, lang);
    const usableS = usableSeconds(e.min);
    if (!b || distanceM(a, b) < MIN_ROUTE_M) return { usableS, why, summary: null, battery: null };
    const wind: Wind3Fn = (lat, lon, alt) => windAt(data.meta.grid, data.profile, alt, s.hour, lat, lon);
    const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
    // assumption: NO-GO висоти перевіряємо в A, середині й B маршруту.
    const isNoGo = (alt: number) => [a, mid, b].some((p) => evaluate(weatherAt(src, p.lat, p.lon, alt, s.hour), prof, alt).level === 'NO-GO');
    const summary = routeSummary(a, b, prof.cruiseMs, s.altM, wind, isNoGo);
    return { usableS, why, summary, battery: batteryCheck(summary.route, usableS, summary.noData, lang) };
  }, [data, prof, a, b, s.altM, s.hour, lang]);

  const pick = () => {
    setRoute({ picking: true });
    // На телефоні панель під картою — показуємо карту, щоб було куди тапнути.
    document.querySelector('.map')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };
  return (
    <RouteView a={a} b={b} altM={s.altM} lang={lang} picking={picking} {...calc}
      onPick={pick} onCancel={() => setRoute({ picking: false })} onClear={resetRoute} />
  );
}

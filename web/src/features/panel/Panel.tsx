// F4 (Оля): панель точки (F4-AC1) — місто або координати, вітер на висоті, пориви, хмари, вердикт з причинами, вікно;
// далі зона польоту (§7.5b), таблиця «висоти × години» (F4-AC2), збережене й звіт (F4-AC4), маршрут (F4-AC3), свій дрон (F4-AC6).
import { useApp } from '../../app/state';
import { useVerdicts } from '../../app/useVerdict';
import { useT, windowLabel } from '../../app/lang';
import { kyivDayHM, t as coreT, type Lang, type Verdict, type Weather } from '../../core';
import type { DroneProfile } from '../../contracts';
import { Route } from '../route/Route';
import { arrowDeg, coordText, nearestCity, placeText } from './place';
import { Zone } from './Zone';
import { HeightTable } from './HeightTable';
import { Saved } from './Saved';
import type { SavedWx } from './saved';
import { pt } from './strings';
import './panel.css';

const n = (x: number | null, d = 1) => (x == null ? '—' : x.toFixed(d));
const URL_RE = /(https?:\/\/[^\s;,]+)/g;

/** Джерело лімітів: посилання стають клікабельними, «assumption» — з поясненням (§7.9). */
export function SourceText({ src, lang }: { src: string; lang: Lang }) {
  if (src.trim() === 'assumption') return <>{pt('src.assumption', lang)}</>;
  const parts = src.split(URL_RE);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noreferrer noopener">{p.replace(/^https?:\/\/(www\.)?/, '')}</a> : p))}</>;
}

export interface PointViewProps {
  city: { name: string; km: number } | null; lat: number; lon: number; altM: number;
  wx: Weather; verdict: Verdict; windowText: string; prof: DroneProfile; lang: Lang;
}

export function PointView({ city, lat, lon, altM, wx, verdict, windowText, prof, lang }: PointViewProps) {
  const L = (k: Parameters<typeof pt>[0], p?: Record<string, string | number>) => pt(k, lang, p);
  const ms = L('unit.ms');
  return (
    <div className="point">
      <div className="pointhead">
        <h2>{city ? city.name : coordText(lat, lon)}</h2>
        <span className={`lvl lv-${verdict.level}`} data-testid="point-level">{coreT(`lv.${verdict.level}`, lang)}</span>
      </div>
      <p className="coord">{coordText(lat, lon)} · {city ? L('place.near', { km: city.km.toFixed(0) }) : L('place.coord')} · {altM} м</p>
      <dl className="vals">
        <div><dt>{L('wind')}</dt><dd>
          {wx.ws != null && wx.dir != null && (
            <span className="arrow" data-testid="wind-arrow" aria-hidden="true" style={{ transform: `rotate(${arrowDeg(wx.dir)}deg)` }}>↑</span>
          )}
          {n(wx.ws)} {ms}{wx.dir != null ? ` · ${L('wind.from', { dir: wx.dir.toFixed(0) })}` : ''}
        </dd></div>
        <div><dt>{L('gust')}</dt><dd>{n(wx.g)} {ms}</dd></div>
        <div><dt>{L('cloud')}</dt><dd>{n(wx.cb, 0)} м</dd></div>
        <div><dt>{L('temp')}</dt><dd>{n(wx.t)} °C</dd></div>
        <div><dt>{L('kp')}</dt><dd>{n(wx.kp)}</dd></div>
        <div><dt>{L('galileo')}</dt><dd>{wx.galVisible ?? '—'} · PDOP {n(wx.galPdop)}</dd></div>
      </dl>
      <ul className="reasons">{verdict.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="win"><span>{L('window')}</span> {windowText}</p>
      <p className="limits">
        {L('limits', { w: prof.windMs, g: prof.gustMs, t: prof.tMinC, p: prof.precipMmH, b0: prof.bandM[0], b1: prof.bandM[1] })}
        {' · '}{L('src')}: <SourceText src={prof.source} lang={lang} />
      </p>
    </div>
  );
}

export function Panel() {
  const { data, s, set } = useApp();
  const { wx, now, window, prof } = useVerdicts();
  const { lang } = useT();
  const city = nearestCity(data.cities, s.lat, s.lon);
  const last = data.meta.times[data.meta.times.length - 1];
  const win = windowLabel(window, last, lang);
  const time = data.meta.times[s.hour] ?? '';
  // Знімок для «Зберегти погоду» / «Копіювати звіт» (F4-AC4): лише в браузері.
  const snapshot = (): SavedWx => ({
    id: `${s.lat.toFixed(3)},${s.lon.toFixed(3)},${s.altM},${time},${prof.id}`, savedAt: new Date().toISOString(),
    place: placeText(data.cities, s.lat, s.lon), lat: s.lat, lon: s.lon, altM: s.altM, time, drone: prof.name,
    ws: wx.ws, dir: wx.dir, g: wx.g, cb: wx.cb, t: wx.t, level: now.level, reasons: now.reasons, window: win,
    source: data.meta.sources.map((x) => x.name).join(', ') || data.profile.sources.join(', '),
    generatedAt: data.meta.generatedAt, mock: data.meta.mock,
  });
  return (
    <section className="panel" aria-label="Точка">
      <div className="row">
        <label>{pt('drone', lang)}
          <select value={s.droneId} onChange={(e) => { const p = data.profiles.find((x) => x.id === e.target.value); set({ droneId: e.target.value, altM: p?.defaultAltM ?? s.altM }); }}>
            {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>{pt('alt', lang)}: <b>{s.altM} м</b>
          <input type="range" min={10} max={1000} step={10} value={s.altM} onChange={(e) => set({ altM: Number(e.target.value) })} />
        </label>
      </div>
      <PointView city={city} lat={s.lat} lon={s.lon} altM={s.altM} wx={wx} verdict={now} windowText={win} prof={prof} lang={lang} />
      <Saved current={snapshot} />
      <Zone prof={prof} hourLabel={time ? kyivDayHM(time) : '—'} />
      <HeightTable prof={prof} />
      <Route />
    </section>
  );
}

// Issue #161 (F3): кнопка «Де я» — позиція з GPS телефона на карті. Перше натискання — одна позиція: карта
// центрується й наближається до міста, позиція стає обраною точкою (панель — як після кліку). Друге — стеження:
// рухається лише синя точка, обрана точка й панель лишаються. Третє — стеження вимкнено.
// OPSEC (§7.11, AC6): координати лише в стані React — без мережі, логів, URL і localStorage.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { useTheme } from '../../app/theme';
import { useView } from '../../app/view/view';
import { makeProjection } from '../../core';
import { GEO_OPTS, accuracyPx, cityView, fixOf, inMapArea, type Fix } from '../../core/locate';
import { InBar, useMapWrap } from '../../ui/MapFrame';
import './locate.css';

const TXT = {
  uk: { label: 'Де я', denied: 'Немає доступу до геолокації', outside: 'Ви поза зоною карти', on: 'Стеження увімкнено', off: 'Стеження вимкнено', me: 'Моя позиція', m: 'м' },
  en: { label: 'My location', denied: 'No access to geolocation', outside: 'You are outside the map area', on: 'Tracking on', off: 'Tracking off', me: 'My location', m: 'm' },
};
/** Синя точка, як у звичних картах; уночі — червона, як уся карта (#89). */
const BLUE = '#1a73e8';
const MSG_MS = 4000;

export function Locate() {
  const { set } = useApp();
  const { setView, view } = useView();
  const { lang } = useT();
  const { night, colors } = useTheme();
  const frame = useMapWrap();
  const ref = useRef<SVGSVGElement>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [watching, setWatching] = useState(false);
  const [msg, setMsg] = useState<'denied' | 'outside' | 'on' | 'off' | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const watchId = useRef<number | null>(null);
  const tx = TXT[lang];

  const wrapEl = () => frame ?? (ref.current?.parentElement as HTMLElement | null | undefined) ?? null;
  // Розмір шару = розмір mapwrap (як ZoneLayer).
  useEffect(() => {
    const w = wrapEl();
    if (!w) return;
    const upd = () => setSize([w.clientWidth, w.clientHeight]);
    upd();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', upd); return () => window.removeEventListener('resize', upd); }
    const ro = new ResizeObserver(upd);
    ro.observe(w);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), MSG_MS);
    return () => clearTimeout(id);
  }, [msg]);

  const stop = () => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
  };
  useEffect(() => stop, []);

  const click = () => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (watching) { stop(); setWatching(false); setMsg('off'); return; }
    if (!geo) { setMsg('denied'); return; }
    if (fix) {
      watchId.current = geo.watchPosition((p) => {
        const f = fixOf(p.coords);
        if (!inMapArea(f.lat, f.lon)) { setMsg('outside'); return; }
        setFix(f);
      }, () => { stop(); setWatching(false); setMsg('denied'); }, GEO_OPTS);
      setWatching(true); setMsg('on');
      return;
    }
    geo.getCurrentPosition((p) => {
      const f = fixOf(p.coords);
      if (!inMapArea(f.lat, f.lon)) { setMsg('outside'); return; }
      const w = wrapEl();
      setFix(f); setMsg(null);
      set({ lat: f.lat, lon: f.lon });
      if (w) setView(cityView(f.lat, f.lon, w.clientWidth, w.clientHeight));
    }, () => setMsg('denied'), GEO_OPTS);
  };

  const [W, H] = size;
  const proj = makeProjection(W, H, view);
  const [x, y] = fix ? proj.project(fix.lat, fix.lon) : [0, 0];
  const fill = night ? colors.ink : BLUE;
  return (
    <>
      <InBar>
        <button type="button" className="locbtn" aria-label={tx.label} title={tx.label} aria-pressed={watching} onClick={click}>
          <span aria-hidden="true">⌖</span>
        </button>
      </InBar>
      {/* svg завжди на карті — щоб знати її розмір; точку й коло малюємо, коли є позиція. */}
      <svg ref={ref} className="locate" role={fix ? 'img' : undefined} aria-hidden={fix ? undefined : true} aria-label={fix ? `${tx.me} ±${Math.round(fix.accM)} ${tx.m}` : undefined}>
        {fix && <>
          <circle className="locacc" cx={x} cy={y} r={accuracyPx(proj, fix.lat, fix.lon, fix.accM)} fill={fill} fillOpacity={0.15} stroke={fill} strokeOpacity={0.5} />
          <circle className="locme" cx={x} cy={y} r={7} fill={fill} stroke={colors.base} strokeWidth={2} />
        </>}
      </svg>
      <p role="status" className="locmsg" hidden={!msg}>{msg ? tx[msg] : ''}</p>
    </>
  );
}

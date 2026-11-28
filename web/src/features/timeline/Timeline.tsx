// F3: смуга 48 год, колір години = вердикт у точці, ▶ і позначки днів (F3-AC4).
// Issue #172: день/ніч у точці (core/sun), лінія «зараз», скраб пальцем/мишею, ←/→, рамка найближчого вікна.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useApp } from '../../app/state';
import { useVerdicts } from '../../app/useVerdict';
import { useT } from '../../app/lang';
import { useNow } from '../../app/when';
import { kyivHM, type Lang, type Level } from '../../core';
import { daySegments, nextPlayHour, nowOffset, scrubHour, sunMarks, windowSpan } from './days';
import './timeline.css';

// Доступні імена смуги uk/en (issue #116, #172).
const S: Record<Lang, { play: string; pause: string; hours: string; now: string; win: string; rise: string; set: string; night: string }> = {
  uk: { play: 'Програти 48 год', pause: 'Пауза', hours: 'Година прогнозу', now: 'зараз', win: 'вікно', rise: 'Схід сонця', set: 'Захід сонця', night: 'ніч' },
  en: { play: 'Play 48 h', pause: 'Pause', hours: 'Forecast hour', now: 'now', win: 'window', rise: 'Sunrise', set: 'Sunset', night: 'night' },
};

const HOUR_PX = 32;
const PLAY_MS = 700;

export interface TimelineProps {
  times: string[]; levels: Level[]; hour: number; onPick: (h: number) => void;
  /** Обрана точка — для дня й ночі (issue #172). */
  lat: number; lon: number;
  /** Поточний час, ms. */
  now: number;
}

export function TimelineView({ times, levels, hour, onPick, lat, lon, now }: TimelineProps) {
  const [playing, setPlaying] = useState(false);
  const { lang } = useT();
  const L = S[lang];
  const days = useMemo(() => daySegments(times, 2, lang), [times, lang]);
  const dayStarts = useMemo(() => new Set(days.slice(1).map((d) => d.start)), [days]);
  const sun = useMemo(() => sunMarks(times, lat, lon), [times, lat, lon]);
  const nowX = nowOffset(times, now);
  // Вікно шукаємо від години «зараз»; смуга ще не почалась — від початку; вже минула — вікна немає.
  const from = nowX != null ? Math.floor(nowX) : times.length && now < Date.parse(times[0]) ? 0 : times.length;
  const win = useMemo(() => windowSpan(levels, times, from), [levels, times, from]);
  const drag = useRef<{ id: number; x: number; h: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      const n = nextPlayHour(hour, times.length);
      if (n != null) onPick(n);
      if (n == null || nextPlayHour(n, times.length) == null) setPlaying(false);
    }, PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, hour, times.length, onPick]);

  // Обрана година лишається видимою, коли скраб чи ←/→ виводять її за край прокрутки (jsdom без scrollIntoView).
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>(`[data-hour="${hour}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [hour]);

  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (nextPlayHour(hour, times.length) == null) onPick(0);
    setPlaying(true);
  };

  // Скраб (AC3): година під пальцем при натисканні, далі — за зсувом вказівника, без інерції.
  const down = (e: PointerEvent<HTMLElement>) => {
    const h = Number((e.target as HTMLElement).closest<HTMLElement>('[data-hour]')?.dataset.hour);
    if (Number.isNaN(h)) return;
    setPlaying(false);
    drag.current = { id: e.pointerId, x: e.clientX, h };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (h !== hour) onPick(h);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const h = scrubHour(d.h, e.clientX - d.x, times.length, HOUR_PX);
    if (h !== hour) onPick(h);
  };
  const up = (e: PointerEvent<HTMLElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const key = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    setPlaying(false);
    const h = Math.min(times.length - 1, Math.max(0, hour + step));
    onPick(h);
    navRef.current?.querySelector<HTMLElement>(`[data-hour="${h}"]`)?.focus();
  };

  return (
    <div className="tl">
      <button className="tl-play" aria-label={playing ? L.pause : L.play} onClick={toggle}>
        {playing ? '⏸' : '▶'}
      </button>
      <div className="tl-scroll">
        <div className="tl-track">
          <div className="tl-days" aria-hidden="true">
            {days.map((d) => (
              <span key={d.start} data-testid="day-mark" className="tl-day" title={d.title}
                style={{ flexGrow: d.len, width: d.len * HOUR_PX }}>{d.label}</span>
            ))}
          </div>
          <nav className="hours" aria-label={L.hours} ref={navRef}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
            {times.map((t, h) => (
              <button key={t} data-hour={h}
                className={`lv-${levels[h]}${sun.night[h] ? ' nt' : ''}${dayStarts.has(h) ? ' d0' : ''}${h === hour ? ' on' : ''}`}
                aria-pressed={h === hour}
                aria-label={`${kyivHM(t)} ${levels[h]}${sun.night[h] ? ` ${L.night}` : ''}`} onClick={() => { setPlaying(false); onPick(h); }}>
                {kyivHM(t).slice(0, 2)}
              </button>
            ))}
          </nav>
          {sun.edges.map((e) => (
            <span key={e.h} data-testid="sun-edge" className="tl-sun" style={{ left: e.h * HOUR_PX }}
              title={`${e.kind === 'rise' ? L.rise : L.set}${e.at != null ? ` ${kyivHM(new Date(e.at).toISOString())}` : ''}`}>
              {e.kind === 'rise' ? '☀' : '☾'}
            </span>
          ))}
          {win && (
            <span data-testid="win" className="tl-win" style={{ left: win.start * HOUR_PX, width: win.len * HOUR_PX }}><span>{L.win}</span></span>
          )}
          {nowX != null && <span data-testid="now-line" className="tl-now" title={L.now} style={{ left: nowX * HOUR_PX }} />}
        </div>
      </div>
    </div>
  );
}

export function Timeline() {
  const { data, s, set } = useApp();
  const { series } = useVerdicts();
  const now = useNow();
  const levels = useMemo(() => series.map((v) => v.level), [series]);
  const onPick = useMemo(() => (h: number) => set({ hour: h }), [set]);
  return <TimelineView times={data.meta.times} levels={levels} hour={s.hour} onPick={onPick} lat={s.lat} lon={s.lon} now={now} />;
}

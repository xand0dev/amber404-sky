// F3: смуга 48 год, колір години = вердикт у точці, ▶ і позначки днів (F3-AC4).
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../app/state';
import { useVerdicts } from '../../app/useVerdict';
import { useT } from '../../app/lang';
import { kyivHM, type Lang, type Level } from '../../core';
import { Icon } from '../../ui/Icon';
import { daySegments, nextPlayHour } from './days';
import './timeline.css';

// Доступні імена смуги uk/en (issue #116).
const S: Record<Lang, { play: string; pause: string; hours: string }> = {
  uk: { play: 'Програти 48 год', pause: 'Пауза', hours: 'Година прогнозу' },
  en: { play: 'Play 48 h', pause: 'Pause', hours: 'Forecast hour' },
};

const HOUR_PX = 32;
const PLAY_MS = 700;

export interface TimelineProps { times: string[]; levels: Level[]; hour: number; onPick: (h: number) => void }

export function TimelineView({ times, levels, hour, onPick }: TimelineProps) {
  const [playing, setPlaying] = useState(false);
  const { lang } = useT();
  const L = S[lang];
  const days = useMemo(() => daySegments(times, 2, lang), [times, lang]);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      const n = nextPlayHour(hour, times.length);
      if (n != null) onPick(n);
      if (n == null || nextPlayHour(n, times.length) == null) setPlaying(false);
    }, PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, hour, times.length, onPick]);

  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (nextPlayHour(hour, times.length) == null) onPick(0);
    setPlaying(true);
  };

  return (
    <div className="tl">
      <button className="tl-play" aria-label={playing ? L.pause : L.play} onClick={toggle}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <div className="tl-scroll">
        <div className="tl-days" aria-hidden="true">
          {days.map((d) => (
            <span key={d.start} data-testid="day-mark" className="tl-day" title={d.title}
              style={{ flexGrow: d.len, width: d.len * HOUR_PX }}>{d.label}</span>
          ))}
        </div>
        <nav className="hours" aria-label={L.hours}>
          {times.map((t, h) => (
            <button key={t} data-hour={h} className={`lv-${levels[h]}${h === hour ? ' on' : ''}`} aria-pressed={h === hour}
              aria-label={`${kyivHM(t)} ${levels[h]}`} onClick={() => { setPlaying(false); onPick(h); }}>
              {kyivHM(t).slice(0, 2)}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Timeline() {
  const { data, s, set } = useApp();
  const { series } = useVerdicts();
  const levels = useMemo(() => series.map((v) => v.level), [series]);
  const onPick = useMemo(() => (h: number) => set({ hour: h }), [set]);
  return <TimelineView times={data.meta.times} levels={levels} hour={s.hour} onPick={onPick} />;
}

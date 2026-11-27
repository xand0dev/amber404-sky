// F3: смуга 48 год, колір години = вердикт у точці (F3-AC4).
import { useApp } from '../../app/state';
import { useVerdicts } from '../../app/useVerdict';
import { kyivHM } from '../../core';
import { LEVEL_COLOR } from '../layers/colors';

export function Timeline() {
  const { data, s, set } = useApp();
  const { series } = useVerdicts();
  return (
    <nav className="hours" aria-label="Година прогнозу">
      {data.meta.times.map((t, h) => (
        <button key={t} className={h === s.hour ? 'on' : ''} style={{ background: LEVEL_COLOR[series[h].level] }}
          aria-label={`${kyivHM(t)} ${series[h].level}`} onClick={() => set({ hour: h })}>
          {kyivHM(t).slice(0, 2)}
        </button>
      ))}
    </nav>
  );
}

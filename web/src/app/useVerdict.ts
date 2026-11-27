import { useMemo } from 'react';
import { evaluate, nextWindow, weatherAt, type Verdict } from '../core';
import { useApp } from './state';
import { useT } from './lang';

/** Причини — мовою інтерфейсу (issue #44). Вердикт у обраній точці для всіх 48 годин (для смуги й вікна) і для поточної. */
export function useVerdicts() {
  const { data, s } = useApp();
  const { lang } = useT();
  const prof = data.profiles.find((p) => p.id === s.droneId) ?? data.profiles[0];
  return useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    const series: Verdict[] = data.meta.times.map((_, h) => evaluate(weatherAt(src, s.lat, s.lon, s.altM, h), prof, s.altM, lang));
    const wx = weatherAt(src, s.lat, s.lon, s.altM, s.hour);
    return { prof, wx, series, now: series[s.hour], window: nextWindow(series, data.meta.times, s.hour) };
  }, [data, s.lat, s.lon, s.altM, s.hour, prof, lang]);
}

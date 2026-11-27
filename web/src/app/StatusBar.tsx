import { useApp } from './state';
import { useVerdicts } from './useVerdict';
import { windowText } from '../core';
import { AgeBadge } from './pwa';

const LABEL = { GO: 'МОЖНА', CAUTION: 'ОБЕРЕЖНО', 'NO-GO': 'НЕ МОЖНА', 'NO-DATA': 'НЕМАЄ ДАНИХ' } as const;

// Плашка статусу на всю ширину (SPEC §7.11), вік прогнозу й офлайн (§7.11), бейдж MOCK і плашки чесності даних (§7.9).
export function StatusBar() {
  const { data, s } = useApp();
  const { now, window, prof } = useVerdicts();
  const bad = data.meta.sources.filter((x) => x.status !== 'ok');
  return (
    <header className={`status lv-${now.level}`} aria-live="polite">
      <div className="word">{LABEL[now.level]}</div>
      <div className="why">{now.reasons[0]}</div>
      <div className="sub">{prof.name} · {s.altM} м · {windowText(window, data.meta.times[data.meta.times.length - 1])}</div>
      <div className="badges">
        {data.meta.mock && <span className="badge mock">MOCK</span>}
        <AgeBadge generatedAt={data.meta.generatedAt} />
        {bad.map((b) => <span key={b.id} className="badge warn">{b.name}: {b.status}</span>)}
      </div>
    </header>
  );
}

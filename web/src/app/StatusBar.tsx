import { useApp } from './state';
import { useVerdicts } from './useVerdict';
import { AgeBadge } from './pwa';
import { NightToggle } from './theme';
import { LangToggle, useT, windowLabel } from './lang';
import { profileName } from '../core';

// Плашка статусу на всю ширину (SPEC §7.11), вік прогнозу й офлайн (§7.11), бейдж MOCK і плашки чесності даних (§7.9), кнопка «Ніч», перемикач UK/EN (issue #44).
export function StatusBar() {
  const { data, s } = useApp();
  const { now, window, prof } = useVerdicts();
  const { lang, t } = useT();
  const bad = data.meta.sources.filter((x) => x.status !== 'ok');
  return (
    <header className={`status lv-${now.level}`} aria-live="polite">
      <NightToggle />
      <LangToggle />
      <div className="word">{t(`lv.${now.level}`)}</div>
      <div className="why">{now.reasons[0]}</div>
      <div className="sub">{profileName(prof, lang)} · {s.altM} {t('unit.m')} · {windowLabel(window, data.meta.times[data.meta.times.length - 1], lang)}</div>
      <div className="badges">
        {data.meta.mock && <span className="badge mock">MOCK</span>}
        <AgeBadge generatedAt={data.meta.generatedAt} />
        {bad.map((b) => <span key={b.id} className="badge warn">{b.name}: {b.status}</span>)}
      </div>
    </header>
  );
}

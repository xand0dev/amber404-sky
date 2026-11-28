import { useEffect, useState } from 'react';
import { useApp } from './state';
import { useVerdicts } from './useVerdict';
import { AgeBadge } from './pwa';
import { NightToggle } from './theme';
import { LangToggle, useT } from './lang';
import { humanWindow, useNow } from './when';
import { forecastAge, profileName, type Lang } from '../core';
import './statusbar.css';

// Рядки шапки (issue #87): лише подача — цифри й статуси ті самі, що в meta.json.
const S = {
  uk: { details: 'Деталі', sources: 'Джерела', mock: 'MOCK — синтетичні дані для демонстрації, не прогноз', ok: 'ок', partial: 'частково', nodata: 'немає даних', min: '{n} хв', h: '{n} год' },
  en: { details: 'Details', sources: 'Sources', mock: 'MOCK — synthetic demo data, not a forecast', ok: 'ok', partial: 'partial', nodata: 'no data', min: '{n} min', h: '{n} h' },
} as const satisfies Record<Lang, Record<string, string>>;

function useOnline(): boolean {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const upd = () => setOn(navigator.onLine);
    window.addEventListener('online', upd); window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);
  return on;
}

/** Вік прогнозу коротко для кнопки «Джерела»: «5 хв», «3 год»; невідомий — «?». */
function shortAge(generatedAt: string, nowMs: number, lang: Lang): { stale: boolean; text: string } {
  const a = forecastAge(generatedAt, nowMs);
  if (Number.isNaN(a.hours)) return { stale: true, text: '?' };
  const min = Math.round(a.hours * 60);
  const text = min < 60 ? S[lang].min.replace('{n}', String(min)) : S[lang].h.replace('{n}', String(Math.floor(a.hours)));
  return { stale: a.stale, text };
}

// Плашка статусу (SPEC §7.11, issue #87): велике слово й один рядок «чому»; дрон, висота, вікно й решта причин — у «Деталі»;
// MOCK лишається на виду (§7.9), вік прогнозу — на кнопці «Джерела», статуси джерел — по тапу на неї. «Ніч» (#36), UK/EN (#44).
export function StatusBar() {
  const { data, s } = useApp();
  const { now, window, prof } = useVerdicts();
  const { lang, t } = useT();
  const L = S[lang];
  const nowMs = useNow();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [det, setDet] = useState(false);
  const age = shortAge(data.meta.generatedAt, nowMs, lang);
  const bad = data.meta.sources.some((x) => x.status !== 'ok');
  const warn = age.stale || bad || !online;
  const last = data.meta.times[data.meta.times.length - 1];
  useEffect(() => {
    if (!open && !det) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setDet(false); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, det]);
  return (
    <header className={`status lv-${now.level}`} aria-live="polite">
      <NightToggle />
      <LangToggle />
      <div className="st-top">
        <div className="word">{t(`lv.${now.level}`)}</div>
        {data.meta.mock && <span className="badge mock">MOCK</span>}
        <button type="button" className={warn ? 'srcbtn warn' : 'srcbtn'} aria-expanded={open} aria-controls="st-src"
          aria-label={`${L.sources} · ${age.text}`} onClick={() => { setOpen(!open); setDet(false); }}>
          <span aria-hidden="true">{warn ? '⚠' : 'ⓘ'}</span> {age.text}
        </button>
      </div>
      <details className="st-more" open={det} onToggle={(e) => { const o = e.currentTarget.open; setDet(o); if (o) setOpen(false); }}>
        <summary><span className="why">{now.reasons[0]}</span><span className="st-det"><span className="st-det-t">{L.details}</span></span></summary>
        <div className="st-body">
          <div className="sub">{profileName(prof, lang)} · {s.altM} {t('unit.m')} · {humanWindow(window, last, nowMs, lang)}</div>
          {now.reasons.length > 1 && <ul className="st-reasons">{now.reasons.slice(1).map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
      </details>
      {open && (
        <div id="st-src" className="srcpop" role="region" aria-label={L.sources}>
          {data.meta.mock && <p>{L.mock}</p>}
          <p className="badges"><AgeBadge generatedAt={data.meta.generatedAt} /></p>
          <ul>
            {data.meta.sources.map((x) => (
              <li key={x.id} className={x.status === 'ok' ? '' : 'warn'}>{x.name}: {L[x.status]}{x.note ? ` · ${x.note}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

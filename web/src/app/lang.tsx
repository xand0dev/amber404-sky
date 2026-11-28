// Мова інтерфейсу uk/en (issue #44): вибір у localStorage, за замовчуванням — мова браузера (uk → UK, інакше EN).
// Фічі F3/F4 підхоплюють рядки через useT() — без змін у features/ з боку F0.
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { detectLang, forecastAge, kyivHM, LANGS, parseLang, t, type Key, type Lang, type Params } from '../core';

export const LANG_KEY = 'amber404.lang';

function loadLang(): Lang {
  let saved: Lang | null = null;
  try { saved = parseLang(localStorage.getItem(LANG_KEY)); } catch { /* приватне вікно */ }
  return saved ?? detectLang(typeof navigator === 'undefined' ? '' : navigator.language);
}
function saveLang(v: Lang): void {
  try { localStorage.setItem(LANG_KEY, v); } catch { /* приватне вікно — без збереження */ }
}

export interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (key: Key, params?: Params) => string }
const mk = (lang: Lang, setLang: (l: Lang) => void): LangCtx => ({ lang, setLang, t: (k, p) => t(k, lang, p) });
// Без провайдера (тести окремих компонентів) — українська, як і до issue #44.
const Ctx = createContext<LangCtx>(mk('uk', () => {}));
export const useT = (): LangCtx => useContext(Ctx);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState(loadLang);
  useLayoutEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo(() => mk(lang, (l: Lang) => { saveLang(l); set(l); }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const LANG_CSS = [
  '.langsw{position:absolute;top:56px;right:8px;display:flex}',
  '.langsw button{min-width:var(--btn-h);padding:0 var(--sp-1);font-weight:700}',
  '.langsw button[aria-pressed=true]{background:var(--ink);color:var(--on-primary)}',
  '.langsw button:focus-visible{outline:3px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 2px var(--base)}',
  '.status{min-height:112px}',
].join('\n');

/** Перемикач UK/EN для плашки статусу. */
export function LangToggle() {
  const { lang, setLang, t: tt } = useT();
  return (
    <div className="langsw" role="group" aria-label={tt('lang.label')}>
      <style>{LANG_CSS}</style>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function kyivDay(iso: string, lang: Lang): string {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short' }).format(new Date(iso));
  return `${t(`day.${WD.indexOf(wd)}` as Key, lang)} ${kyivHM(iso)}`;
}

/** Вікно для польоту (§7.5) у київському часі мовою lang. */
export function windowLabel(w: { start: string; end: string; hours: number } | null, lastIso: string, lang: Lang): string {
  if (!w) return t('win.none', lang, { until: kyivDay(lastIso, lang) });
  return t('win.span', lang, { start: kyivDay(w.start, lang), end: kyivHM(w.end), n: w.hours });
}

/** Вік прогнозу (§7.11, §7.9) мовою lang; поріг і розрахунок — з core/age.ts. */
export function ageLabel(generatedAt: string, nowMs: number, lang: Lang): { stale: boolean; text: string } {
  const a = forecastAge(generatedAt, nowMs);
  if (Number.isNaN(a.hours)) return { stale: true, text: t('age.unknown', lang) };
  const min = Math.round(a.hours * 60);
  const key: Key = min < 60 ? (a.stale ? 'age.staleMin' : 'age.min') : (a.stale ? 'age.staleH' : 'age.h');
  return { stale: a.stale, text: t(key, lang, { n: min < 60 ? min : Math.floor(a.hours) }) };
}

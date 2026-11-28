// PWA (SPEC §7.11): реєстрація service worker, плашка віку прогнозу / офлайн,
// встановлення застосунку й тихе оновлення даних після повернення мережі (issue #170).
import { useEffect, useState } from 'react';
import { bannerDue, installWay, isIosSafari, kyivHM, nextVisits, type InstallWay, type ShortcutAction } from '../core';
import { InBar } from '../ui/MapFrame';
import { DAY_VARS, NIGHT_VARS } from '../ui/tokens';
import { ageLabel, useT } from './lang';
import './pwa.css';

/** Реєструє web/public/sw.js. Помилка чи відсутність SW не ламають застосунок — він просто працює без офлайну. */
export async function registerSW(nav: Navigator = navigator): Promise<void> {
  if (!('serviceWorker' in nav)) return;
  try { await nav.serviceWorker.register('./sw.js'); } catch { /* без офлайну */ }
}

export function useOnline(): boolean {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const upd = () => setOn(navigator.onLine);
    window.addEventListener('online', upd); window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);
  return on;
}

/** Повернення мережі (#170 AC3): викликає fn — тихе оновлення даних без перезавантаження сторінки. */
export function useReconnect(fn: () => void): void {
  useEffect(() => {
    window.addEventListener('online', fn);
    return () => window.removeEventListener('online', fn);
  }, [fn]);
}

function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), stepMs); return () => clearInterval(id); }, [stepMs]);
  return now;
}

export function AgeBadge({ generatedAt }: { generatedAt: string }) {
  const { lang, t } = useT();
  const age = ageLabel(generatedAt, useNow(), lang);
  const online = useOnline();
  return (
    <>
      <span className={`badge${age.stale ? ' warn' : ''}`}>{age.text}</span>
      {!online && <span className="badge warn">{t('offline')}</span>}
    </>
  );
}

/** Явний індикатор у шапці (#170 AC3): іконка + «офлайн · дані від HH:MM» (київський час прогнозу). З мережею — нічого. */
export function OfflineBadge({ generatedAt }: { generatedAt: string }) {
  const { t } = useT();
  if (useOnline()) return null;
  const hm = Number.isNaN(Date.parse(generatedAt)) ? '?' : kyivHM(generatedAt);
  return (
    <span className="badge warn offbadge" role="status">
      <svg className="officon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M1 6a10 10 0 0 1 14 0M3.5 8.5a6.5 6.5 0 0 1 9 0M6 11a3 3 0 0 1 4 0M2 2l12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {t('offline.since', { t: hm })}
    </span>
  );
}

/** Колір рядка стану браузера під тему (#170 AC4): тло --base денної чи нічної палітри. */
export function setThemeColor(night: boolean, doc: Document = document): void {
  let m = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!m) { m = doc.createElement('meta'); m.name = 'theme-color'; doc.head.append(m); }
  m.content = (night ? NIGHT_VARS : DAY_VARS)['--base'];
}

// ---- Встановлення (#170 AC1–AC2) ----

export const VISITS_KEY = 'amber404.visits';
export const BANNER_KEY = 'amber404.installBanner';

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// beforeinstallprompt може прийти ще до першого рендеру (поки вантажаться дані), тож ловимо його на рівні модуля.
let deferred: PromptEvent | null = null;
let installed = false;
let visits: number | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit(); });
}

/** Лише для тестів: стан модуля як після нового завантаження сторінки. */
export function resetInstallForTest(): void { deferred = null; installed = false; visits = null; }

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* приватне вікно */ } };

/** Візит = завантаження сторінки; рахуємо раз, хоч би скільки разів монтувався компонент. Лише localStorage (OPSEC). */
function countVisit(): number {
  if (visits === null) { visits = nextVisits(read(VISITS_KEY)); write(VISITS_KEY, String(visits)); }
  return visits;
}

function standalone(): boolean {
  const mm = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return mm || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function useInstallWay(): InstallWay {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    mq?.addEventListener?.('change', f);
    return () => { subs.delete(f); mq?.removeEventListener?.('change', f); };
  }, []);
  return installWay({ standalone: standalone(), installed, canPrompt: deferred !== null, ios: isIosSafari(navigator.userAgent, navigator.maxTouchPoints ?? 0) });
}

function ShareIcon() {
  // Значок «Поділитися» з Safari: квадрат зі стрілкою вгору.
  return (
    <svg className="shareicon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1v9M5 4l3-3 3 3M5 7H3v8h10V7h-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Кнопка «Встановити застосунок» у «⋯», одноразовий банер з 2-го візиту і підказка для iOS Safari. */
export function Install() {
  const { t } = useT();
  const way = useInstallWay();
  const [visit] = useState(countVisit);
  const [shownBefore] = useState(() => read(BANNER_KEY) === '1');
  const [closed, setClosed] = useState(false);
  const [hint, setHint] = useState(false);
  const banner = bannerDue(way, visit, shownBefore) && !closed;
  // Одноразовий: щойно показали — більше не показуємо (навіть якщо не закрили).
  useEffect(() => { if (banner) write(BANNER_KEY, '1'); }, [banner]);

  const go = async () => {
    setClosed(true);
    if (way === 'ios') { setHint(true); return; }
    const e = deferred;
    if (!e) return;
    deferred = null; // prompt() можна викликати лише раз
    emit();
    try { await e.prompt(); await e.userChoice; } catch { /* браузер відмовив — нічого */ }
  };

  return (
    <>
      {way && (
        <InBar slot="more">
          <button type="button" className="installbtn" onClick={() => void go()}>{t('pwa.install')}</button>
        </InBar>
      )}
      {banner && (
        <aside className="installbar" aria-label={t('pwa.region')}>
          <span>{t('pwa.banner')}</span>
          <button type="button" className="btn-primary" onClick={() => void go()}>{t('pwa.go')}</button>
          <button type="button" className="installx" aria-label={t('pwa.close')} title={t('pwa.close')} onClick={() => setClosed(true)}>
            <span aria-hidden="true">✕</span>
          </button>
        </aside>
      )}
      {hint && way === 'ios' && (
        <div className="ioshint" role="dialog" aria-label={t('pwa.iosTitle')}>
          <p className="ioshint-t">{t('pwa.iosTitle')}</p>
          <p><ShareIcon /> {t('pwa.iosStep')}</p>
          <button type="button" onClick={() => setHint(false)}>{t('pwa.ok')}</button>
        </div>
      )}
    </>
  );
}

// ---- Ярлики manifest (#170 AC4) ----

/** «Де я» — натиснути кнопку позиції (F3). true — виконано; false — кнопки ще немає. Шар «Можна летіти» ставить App. */
export function runShortcut(a: ShortcutAction, doc: Document = document): boolean {
  if (a !== 'locate') return true;
  const b = doc.querySelector<HTMLButtonElement>('button.locbtn');
  if (!b) return false;
  b.click();
  return true;
}

/** Виконує дію ярлика, коли з'явиться кнопка (до ~1 с), і прибирає ?do= з адреси. */
export function useShortcut(a: ShortcutAction | null): void {
  useEffect(() => {
    if (!a) return;
    let n = 0;
    let id = 0;
    const step = () => {
      if (runShortcut(a) || ++n > 60) {
        const u = new URL(window.location.href); u.searchParams.delete('do');
        window.history.replaceState(window.history.state, '', u);
        return;
      }
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [a]);
}

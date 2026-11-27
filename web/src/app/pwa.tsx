// PWA (SPEC §7.11): реєстрація service worker і плашка віку прогнозу / офлайн.
import { useEffect, useState } from 'react';
import { ageLabel, useT } from './lang';

/** Реєструє web/public/sw.js. Помилка чи відсутність SW не ламають застосунок — він просто працює без офлайну. */
export async function registerSW(nav: Navigator = navigator): Promise<void> {
  if (!('serviceWorker' in nav)) return;
  try { await nav.serviceWorker.register('./sw.js'); } catch { /* без офлайну */ }
}

function useOnline(): boolean {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const upd = () => setOn(navigator.onLine);
    window.addEventListener('online', upd); window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);
  return on;
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

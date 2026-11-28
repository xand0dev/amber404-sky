// Встановлення PWA (issue #170, SPEC §7.11): чиста логіка без DOM — коли показувати кнопку «Встановити» і банер.

/** prompt — системний запит (`beforeinstallprompt`), ios — підказка «Поділитися → На екран „Додому“». */
export type InstallWay = 'prompt' | 'ios' | null;

export interface InstallEnv {
  standalone: boolean; // display-mode: standalone або navigator.standalone (iOS)
  installed: boolean; // подія appinstalled у цій сесії
  canPrompt: boolean; // отримали beforeinstallprompt
  ios: boolean;
}

/** Safari на iPhone / iPad: там немає beforeinstallprompt, лише «Поділитися». iPad у режимі «десктоп» — Macintosh з дотиком. */
export function isIosSafari(ua: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function installWay(e: InstallEnv): InstallWay {
  if (e.standalone || e.installed) return null;
  if (e.canPrompt) return 'prompt';
  return e.ios ? 'ios' : null;
}

/** Лічильник візитів з localStorage: збережене + 1; сміття — як 0. */
export function nextVisits(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n + 1 : 1;
}

/** Банер — один раз, починаючи з 2-го візиту, і лише якщо є як встановити. */
export function bannerDue(way: InstallWay, visits: number, shown: boolean): boolean {
  return way !== null && visits >= 2 && !shown;
}

/** Ярлики manifest (`shortcuts`): «Де я» — ./?do=locate, «Можна летіти» (шар go) — ./?do=go. */
export type ShortcutAction = 'locate' | 'go';
export function shortcutAction(search: string): ShortcutAction | null {
  const v = new URLSearchParams(search).get('do');
  return v === 'locate' || v === 'go' ? v : null;
}

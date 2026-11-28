// Нічний режим (issue #36): червоно-чорна палітра через CSS-змінні (`data-theme` на <html>), вибір у localStorage.
// Карта (F3) бере кольори з `useTheme().colors` або `readMapColors()` — без змін у features/ з боку F0.
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { DAY_PALETTE, paletteFrom, parseNight, type MapPalette } from '../core';
import { NIGHT_CSS, NIGHT_VARS } from './night';
import { useT } from './lang';
import { setThemeColor } from './pwa';

export const NIGHT_KEY = 'amber404.night';

function loadNight(): boolean {
  try { return parseNight(localStorage.getItem(NIGHT_KEY)); } catch { return false; }
}
function saveNight(v: boolean): void {
  try { localStorage.setItem(NIGHT_KEY, v ? '1' : '0'); } catch { /* приватне вікно — без збереження */ }
}

/** Поточні кольори палітри з CSS-змінних `:root`. */
export function readMapColors(el: HTMLElement = document.documentElement): MapPalette {
  const cs = getComputedStyle(el);
  return paletteFrom((n) => cs.getPropertyValue(n));
}

export interface Theme { night: boolean; toggle: () => void; colors: MapPalette }
const ThemeCtx = createContext<Theme>({ night: false, toggle: () => {}, colors: DAY_PALETTE });
export const useTheme = (): Theme => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [night, setNight] = useState(loadNight);
  // Ті самі значення, що й у CSS-змінних: нічні з NIGHT_VARS, денні — з :root app.css.
  const colors = useMemo(() => (night ? paletteFrom((n) => NIGHT_VARS[n] ?? '') : DAY_PALETTE), [night]);
  // Атрибут ставимо до малювання, щоб карта в тому ж кадрі прочитала нові змінні через readMapColors().
  // Рядок стану браузера й застосунку — під тему (#170 AC4).
  useLayoutEffect(() => { document.documentElement.dataset.theme = night ? 'night' : 'day'; setThemeColor(night); }, [night]);
  const toggle = () => { saveNight(!night); setNight(!night); };
  return (
    <ThemeCtx.Provider value={{ night, toggle, colors }}>
      <style>{NIGHT_CSS}</style>
      {children}
    </ThemeCtx.Provider>
  );
}

export function NightToggle() {
  const { night, toggle } = useTheme();
  const { t } = useT();
  return <button type="button" className="nightbtn" aria-pressed={night} onClick={toggle}>{t('night')}</button>;
}

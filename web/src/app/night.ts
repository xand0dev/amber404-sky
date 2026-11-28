// Нічний режим (issue #36): червоно-чорна палітра. Окремим рядком, а не в app.css, щоб тести бачили правила
// (vitest не віддає вміст .css). ThemeProvider вставляє його в <style>.
// Значення змінних — ui/tokens.ts (issue #88, AC1); тут лише правила, що відрізняються вночі.
import { NIGHT_SEL, NIGHT_VARS } from '../ui/tokens';

/** Нічні значення тих самих CSS-змінних (джерело — ui/tokens.ts). Лише червоний канал, щоб не збивати нічний зір. */
export { NIGHT_VARS };

const N = NIGHT_SEL;
export const NIGHT_CSS = [
  `${N}{${Object.entries(NIGHT_VARS).map(([k, v]) => `${k}:${v}`).join(';')}}`,
  // Плашка вердикту й інші заливки рівнів (#88 AC2): чорне тло, червоний текст ≥ 4.5:1 замість приглушеної яскравості.
  // Рівень видно формою — висотою смужки внизу плашки: можна < обережно < не можна (слово вердикту лишається головним).
  `${N} .lv-GO,${N} .lv-CAUTION,${N} .lv-NO-GO,${N} .lv-NO-DATA{background:var(--base);color:var(--ink)}`,
  `${N} .status{border-bottom:1px solid var(--rule)}`,
  `${N} .status.lv-GO{box-shadow:inset 0 -3px 0 var(--ink)}`,
  `${N} .status.lv-CAUTION{box-shadow:inset 0 -6px 0 var(--ink)}`,
  `${N} .status.lv-NO-GO{box-shadow:inset 0 -10px 0 var(--ink)}`,
  // Кнопка «Ніч» у плашці статусу: ≥ 44 px (--btn-h), видимий двоколірний фокус на будь-якому тлі плашки.
  '.nightbtn{position:absolute;top:8px;right:8px;min-height:var(--btn-h);min-width:var(--btn-h);padding:0 var(--sp-2);font-weight:700}',
  '.nightbtn[aria-pressed=true]{background:var(--ink);color:var(--on-primary)}',
  '.nightbtn:focus-visible{outline:3px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 2px var(--base)}',
].join('\n');

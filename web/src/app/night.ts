// Нічний режим (issue #36): червоно-чорна палітра. Окремим рядком, а не в app.css, щоб тести бачили правила
// (vitest не віддає вміст .css). ThemeProvider вставляє його в <style>.

/** Нічні значення тих самих CSS-змінних, що в `:root` app.css. Лише червоний канал, щоб не збивати нічний зір. */
export const NIGHT_VARS: Record<string, string> = {
  '--base': '#000000', '--panel': '#140202', '--rule': '#4a0d08', '--ink': '#c8372a', '--dim': '#7a1f16',
  '--go': '#5c140c', '--cau': '#8e2114', '--no': '#c42a18',
};

const N = ':root[data-theme="night"]';
export const NIGHT_CSS = [
  `${N}{${Object.entries(NIGHT_VARS).map(([k, v]) => `${k}:${v}`).join(';')}}`,
  // Плашка вердикту приглушена, текст на ній — чорний.
  `${N} .status{filter:brightness(.6);color:#000000}`,
  `${N} .lv-NO-DATA{color:var(--ink)}`,
  `${N} .badge{background:#000000;color:var(--ink)}`,
  `${N} .badge.mock{background:var(--ink);color:#000000}`,
  `${N} .layers button{background:rgba(0,0,0,.88)}`,
  `${N} .layers button.on,${N} .hours button{color:#000000}`,
  // Кнопка «Ніч» у плашці статусу: ≥ 44 px, видимий двоколірний фокус на будь-якому тлі плашки.
  '.status{position:relative;padding-right:76px}',
  '.nightbtn{position:absolute;top:8px;right:8px;min-height:44px;min-width:44px;padding:0 12px;background:#11150e;color:var(--ink);border:1px solid var(--rule);font-weight:700}',
  '.nightbtn[aria-pressed=true]{background:var(--ink);color:#000000}',
  '.nightbtn:focus-visible{outline:3px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 2px var(--base)}',
].join('\n');

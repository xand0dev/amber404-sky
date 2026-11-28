// Дизайн-токени (issue #88, AC1): усі CSS-змінні в одному місці — тут. З них генерується :root і нічний блок;
// стилі фіч беруть лише var(--…). Кольори карти (theme.tsx) і тести контрасту читають ці ж об'єкти.
// TS, а не .css: vitest не віддає вміст .css (css вимкнено в vite.config), а нічна палітра потрібна і в тестах, і в коді карти.

/** Денна тема — значення за замовчуванням. */
export const DAY_VARS: Record<string, string> = {
  // Поверхні й текст
  '--base': '#1c2117', '--panel': '#262c1f', '--rule': '#46503a', '--ink': '#e6e2cc', '--dim': '#a3a58a',
  // Вердикти: заливки (плашка, клітинки годин) і текст на них
  '--go': '#8cbf4f', '--cau': '#e2a72e', '--no': '#e0532f', '--no-data': '#46503a', '--on-lv': '#11150e',
  // Кольоровий текст на панелях (повідомлення «готово», попередження, помилки)
  '--go-ink': '#8cbf4f', '--cau-ink': '#e2a72e', '--no-ink': '#f07a5a',
  // Кнопки: другорядна — тло --btn-bg і рамка --rule; основна (.btn-primary, aria-pressed) — тло --ink, текст --on-primary
  '--btn-bg': '#1c2117', '--on-primary': '#11150e', '--btn-h': '44px',
  // Напівпрозоре тло підписів поверх карти (легенда, підпис зони, підказка)
  '--scrim': 'rgba(17,21,14,.9)',
  // Нічні години на смузі 48 год (issue #172): кольори вердиктів, затемнені вдвічі; текст на них — --ink
  '--go-nt': '#466028', '--cau-nt': '#715417', '--no-nt': '#702a18', '--no-data-nt': '#23281d',
  // Шрифти: 4 розміри + окремий для слова вердикту
  '--font': '"DIN Alternate","Barlow",system-ui,sans-serif',
  '--font-display': '"DIN Condensed","Barlow Condensed",sans-serif',
  '--fs-s': '12px', '--fs-m': '14px', '--fs-l': '16px', '--fs-xl': '20px', '--fs-display': '34px',
  // Відступи й радіуси
  '--sp-1': '4px', '--sp-2': '8px', '--sp-3': '16px', '--sp-4': '24px',
  '--r': '2px', '--r-round': '50%',
};

/** Нічна тема (issue #36): лише червоний канал і чорний. Текст ≥ 4.5:1 (#88 AC2); рівні вердикту вночі — формою (base.css). */
export const NIGHT_VARS: Record<string, string> = {
  '--base': '#000000', '--panel': '#140202', '--rule': '#4a0d08', '--ink': '#ff6b5a', '--dim': '#f0402e',
  '--go': '#5c140c', '--cau': '#8e2114', '--no': '#c42a18', '--no-data': '#4a0d08', '--on-lv': '#000000',
  '--go-ink': '#ff6b5a', '--cau-ink': '#ff6b5a', '--no-ink': '#ff6b5a',
  '--btn-bg': '#000000', '--on-primary': '#000000',
  '--scrim': 'rgba(0,0,0,.88)',
};

export const NIGHT_SEL = ':root[data-theme="night"]';
const block = (sel: string, v: Record<string, string>) => `${sel}{${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')}}`;

/** CSS змінних: денні в :root, нічні — перевизначення тих самих. */
export const TOKENS_CSS = `${block(':root', DAY_VARS)}\n${block(NIGHT_SEL, NIGHT_VARS)}`;

/** Вставляє змінні в <head> до першого рендеру (і до екрана «Завантаження»). Повторний виклик нічого не робить. */
export function injectTokens(doc: Document = document): void {
  if (doc.getElementById('tokens')) return;
  const s = doc.createElement('style');
  s.id = 'tokens';
  s.textContent = TOKENS_CSS;
  doc.head.prepend(s);
}

// Побічний ефект модуля: імпорт (ui/MapFrame) ставить змінні до першого рендеру.
if (typeof document !== 'undefined') injectTokens();

function rgb(hex: string): number[] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
}
function lum(c: number[]): number {
  const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Контраст WCAG 2.x між двома кольорами #rrggbb. */
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

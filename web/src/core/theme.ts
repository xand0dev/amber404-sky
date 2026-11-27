// Нічний режим (issue #36): чиста логіка без DOM — розбір збереженого вибору й палітра карти з CSS-змінних.

/** Кольори, які карта (F3) бере з CSS-змінних `:root`, щоб підхопити денну й нічну палітру. */
export interface MapPalette { base: string; ink: string; rule: string; go: string; cau: string; no: string }

/** Денна палітра — ті самі значення, що в `:root` у app.css; запасні, якщо змінна порожня. */
export const DAY_PALETTE: MapPalette = { base: '#1c2117', ink: '#e6e2cc', rule: '#46503a', go: '#8cbf4f', cau: '#e2a72e', no: '#e0532f' };

export const parseNight = (raw: string | null): boolean => raw === '1';

/** `get` повертає значення CSS-змінної за назвою (`--base` тощо). */
export function paletteFrom(get: (name: string) => string): MapPalette {
  const out = { ...DAY_PALETTE };
  for (const k of Object.keys(out) as (keyof MapPalette)[]) out[k] = get(`--${k}`).trim() || DAY_PALETTE[k];
  return out;
}

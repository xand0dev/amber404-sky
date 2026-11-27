import { describe, expect, it } from 'vitest';
import { DAY_PALETTE, paletteFrom, parseNight } from './theme';

describe('нічний режим: збережений вибір', () => {
  it('«1» — ніч, решта — день', () => {
    expect(parseNight('1')).toBe(true);
    expect(parseNight('0')).toBe(false);
    expect(parseNight(null)).toBe(false);
    expect(parseNight('сміття')).toBe(false);
  });
});

describe('нічний режим: палітра карти з CSS-змінних', () => {
  it('бере значення змінних, обрізаючи пробіли', () => {
    const vars: Record<string, string> = { '--base': ' #000 ', '--ink': '#c33', '--rule': '#400', '--go': '#611', '--cau': '#922', '--no': '#d33' };
    expect(paletteFrom((n) => vars[n] ?? '')).toEqual({ base: '#000', ink: '#c33', rule: '#400', go: '#611', cau: '#922', no: '#d33' });
  });
  it('порожня змінна — денний колір за замовчуванням', () => {
    expect(paletteFrom(() => '')).toEqual(DAY_PALETTE);
  });
});

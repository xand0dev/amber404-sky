// Дизайн-токени (issue #88): AC1 — одне місце, AC2 — контраст тексту ≥ 4.5:1 у денній і нічній темі.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DAY_VARS as DAY, NIGHT_VARS, TOKENS_CSS, contrast, injectTokens } from './tokens';

const NIGHT = { ...DAY, ...NIGHT_VARS };
// vitest не віддає вміст .css через import — читаємо base.css з диска.
const BASE = readFileSync(join(process.cwd(), 'src/ui/base.css'), 'utf8');

describe('AC1: токени в одному місці', () => {
  it('3–4 розміри шрифту й окремий розмір слова вердикту', () => {
    const fs = Object.keys(DAY).filter((k) => /^--fs-(s|m|l|xl)$/.test(k));
    expect(fs.length).toBeGreaterThanOrEqual(3);
    expect(fs.length).toBeLessThanOrEqual(4);
    expect(DAY['--fs-display']).toMatch(/px$/);
  });
  it('відступи 4/8/16/24', () => {
    expect(['--sp-1', '--sp-2', '--sp-3', '--sp-4'].map((k) => DAY[k])).toEqual(['4px', '8px', '16px', '24px']);
  });
  it('кнопки, радіуси, кольори вердиктів', () => {
    for (const k of ['--btn-h', '--r', '--r-round', '--go', '--cau', '--no', '--no-data', '--on-lv']) expect(DAY[k], k).toBeTruthy();
    expect(BASE).toMatch(/\.btn-primary/);
  });
  it('нічна тема перевизначає ті самі змінні, а не нові', () => {
    for (const k of Object.keys(NIGHT_VARS)) expect(DAY[k], k).toBeDefined();
  });
  it('змінні вставляються в <head> один раз', () => {
    injectTokens(); injectTokens();
    expect(document.querySelectorAll('style#tokens')).toHaveLength(1);
    expect(document.getElementById('tokens')!.textContent).toBe(TOKENS_CSS);
    expect(getComputedStyle(document.documentElement).getPropertyValue('--sp-2').trim()).toBe('8px');
  });
});

// Пари «текст / тло», що трапляються в інтерфейсі.
const TEXT: [string, string][] = [
  ['--ink', '--base'], ['--ink', '--panel'], ['--dim', '--base'], ['--dim', '--panel'],
  ['--go-ink', '--panel'], ['--cau-ink', '--panel'], ['--cau-ink', '--btn-bg'], ['--no-ink', '--panel'], ['--no-ink', '--base'],
  ['--ink', '--btn-bg'], ['--on-primary', '--ink'], ['--ink', '--no-data'],
];
// Удень текст стоїть і на кольорах вердикту (плашка, клітинки годин); уночі ці місця чорні з червоним текстом (T5).
const DAY_LV: [string, string][] = [['--on-lv', '--go'], ['--on-lv', '--cau'], ['--on-lv', '--no']];

describe('AC2: контраст тексту ≥ 4.5:1', () => {
  for (const [name, t, pairs] of [['день', DAY, [...TEXT, ...DAY_LV]], ['ніч', NIGHT, TEXT]] as const) {
    for (const [fg, bg] of pairs) {
      it(`${name}: ${fg} на ${bg}`, () => {
        expect(t[fg], fg).toMatch(/^#/);
        expect(t[bg], bg).toMatch(/^#/);
        expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

// Issue #172: нічні години смуги — затемнений колір рівня, текст --ink (≥ 4.5:1); темніший за денний.
describe('Given нічна година на смузі (issue #172)', () => {
  for (const lv of ['--go', '--cau', '--no', '--no-data']) {
    it(`Then --ink на ${lv}-nt ≥ 4.5:1, ${lv}-nt темніший за ${lv}`, () => {
      expect(DAY[`${lv}-nt`]).toMatch(/^#/);
      expect(contrast(DAY['--ink'], DAY[`${lv}-nt`])).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#000000', DAY[`${lv}-nt`])).toBeLessThan(contrast('#000000', DAY[lv]));
    });
  }
});

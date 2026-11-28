// Issue #88 AC3: фічі беруть кольори, розміри шрифту й відступи з токенів (ui/tokens.css), а не пишуть свої.
// Перевіряємо всі *.css у src і CSS, вбудований рядками в TS (night.ts, lang.tsx).
// vitest не віддає вміст .css через import (css вимкнено), тож читаємо файли з диска.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// cwd — папка web (npm test / make check); import.meta.url у jsdom не file://.
const SRC = join(process.cwd(), 'src');
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const read = (f: string) => readFileSync(f, 'utf8');
const CSS_FILES = Object.fromEntries(walk(SRC).filter((f) => f.endsWith('.css')).map((f) => [relative(SRC, f), read(f)]));
const TS_CSS = Object.fromEntries(['app/night.ts', 'app/lang.tsx'].map((f) => [f, read(join(SRC, f))]));


const COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
const SPACING_PROP = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block))?$/;

/** Оголошення «властивість: значення» з усіх блоків { … } (вкладені @media теж). */
function decls(css: string): [string, string][] {
  const out: [string, string][] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/\{([^{}]*)\}/g)) {
    for (const d of m[1].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) out.push([d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]);
    }
  }
  return out;
}

/** Порушення в одному CSS-тексті. */
export function violations(css: string): string[] {
  const bad: string[] = [];
  for (const [p, v] of decls(css)) {
    if (p.startsWith('--')) continue;
    const noVar = v.replace(/var\([^)]*\)/g, '');
    if (COLOR.test(noVar)) bad.push(`${p}:${v} — колір не з токена`);
    if ((p === 'font-size' || p === 'font') && /\d(px|rem|em)\b/.test(noVar)) bad.push(`${p}:${v} — розмір шрифту не з токена`);
    // Відступи: токени --sp-*, або 0 / 1–2 px (тонкі зазори між сусідніми кнопками).
    if (SPACING_PROP.test(p) && noVar.split(/\s+/).some((x) => /^-?\d*\.?\d+(px|rem|em)$/.test(x) && !/^-?[12]px$/.test(x))) bad.push(`${p}:${v} — відступ не з токенів`);
  }
  return bad;
}

/** CSS-рядки з TS: усе між лапками, де є `{`. */
function cssInTs(src: string): string {
  return [...src.matchAll(/(['`])((?:(?!\1)[\s\S])*?\{[\s\S]*?)\1/g)].map((m) => m[2]).join('\n');
}

describe('AC3: без захардкоджених кольорів, шрифтів і відступів', () => {
  it('перевірка ловить порушення й пропускає токени', () => {
    expect(violations('.a{color:#fff;font-size:13px;padding:0 6px}')).toHaveLength(3);
    expect(violations('.a{color:var(--ink);font-size:var(--fs-s);padding:0 var(--sp-2);gap:2px;margin:0}')).toEqual([]);
  });
  // Усі фічі F0–F4 (F4 перейшла на токени в #134).
  const files = Object.entries(CSS_FILES);
  it('є що перевіряти', () => expect(files.length).toBeGreaterThan(10));
  for (const [f, css] of files) it(f, () => expect(violations(css)).toEqual([]));
  for (const [f, src] of Object.entries(TS_CSS)) it(f, () => expect(violations(cssInTs(src))).toEqual([]));
});

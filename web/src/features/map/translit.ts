// Назви міст англійською (issue #116): транслітерація українського алфавіту за постановою КМУ № 55 від 27.01.2010
// (docs/SOURCES.md, ## F3). Доки в cities.json немає поля nameEn (запит contract) — так.
import type { Lang } from '../../core';

// Звичайна позиція / початок слова (є, ї, й, ю, я).
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', '’': '', 'ʼ': '',
};
const START: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };
const isLetter = (c: string | undefined) => !!c && /[а-яіїєґ'’ʼ]/i.test(c);

/** Українська → латиниця (КМУ № 55): «зг» → zgh; ь і апостроф опускаються; велика літера лишається великою. */
export function translit(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], lo = ch.toLowerCase();
    if (!(lo in MAP)) { out += ch; continue; }
    let r = !isLetter(s[i - 1]) && lo in START ? START[lo] : MAP[lo];
    if (lo === 'г' && s[i - 1]?.toLowerCase() === 'з') r = 'gh';
    out += ch !== lo && r ? r[0].toUpperCase() + r.slice(1) : r;
  }
  return out;
}

/** Назва міста мовою інтерфейсу: en — nameEn, якщо колись з'явиться в контракті, інакше транслітерація. */
export function cityName(c: { name: string; nameEn?: string }, lang: Lang): string {
  return lang === 'en' ? (c.nameEn ?? translit(c.name)) : c.name;
}

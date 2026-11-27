// Issue #116: назви міст англійською — транслітерація за постановою КМУ № 55 від 27.01.2010.
import { describe, expect, it } from 'vitest';
import cities from '../../../public/data/static/cities.json';
import { cityName, translit } from './translit';

describe('Given назва українською; When translit (КМУ № 55)', () => {
  it('Then усі 16 міст з cities.json — офіційні латинські назви', () => {
    const want: Record<string, string> = {
      'Київ': 'Kyiv', 'Львів': 'Lviv', 'Харків': 'Kharkiv', 'Одеса': 'Odesa', 'Дніпро': 'Dnipro', 'Запоріжжя': 'Zaporizhzhia',
      'Вінниця': 'Vinnytsia', 'Полтава': 'Poltava', 'Чернігів': 'Chernihiv', 'Суми': 'Sumy', 'Житомир': 'Zhytomyr', 'Рівне': 'Rivne',
      'Ужгород': 'Uzhhorod', 'Миколаїв': 'Mykolaiv', 'Херсон': 'Kherson', 'Сімферополь': 'Simferopol',
    };
    const list = (Array.isArray(cities) ? cities : (cities as { cities: { name: string }[] }).cities) as { name: string }[];
    expect(list).toHaveLength(16);
    for (const c of list) expect(translit(c.name), c.name).toBe(want[c.name]);
  });
  it('Then є, ї, й, ю, я на початку слова — ye, yi, y, yu, ya; всередині — ie, i, i, iu, ia', () => {
    expect(translit('Єнакієве')).toBe('Yenakiieve');
    expect(translit('Їжакевич')).toBe('Yizhakevych');
    expect(translit('Йосипівка')).toBe('Yosypivka');
    expect(translit('Юрій')).toBe('Yurii');
    expect(translit('Яготин')).toBe('Yahotyn');
    expect(translit('Стрий')).toBe('Stryi');
  });
  it('Then «зг» — zgh, ь і апостроф опускаються, ґ — g', () => {
    expect(translit('Згурівка')).toBe('Zghurivka');
    expect(translit('Знам’янка')).toBe('Znamianka');
    expect(translit("Знам'янка")).toBe('Znamianka');
    expect(translit('Гаврилівка-Ґалаґан')).toBe('Havrylivka-Galagan');
  });
});

describe('Given місто; When cityName', () => {
  it('Then uk — як є; en — транслітерація', () => {
    expect(cityName({ name: 'Київ' }, 'uk')).toBe('Київ');
    expect(cityName({ name: 'Київ' }, 'en')).toBe('Kyiv');
  });
  it('Then en і є nameEn (майбутнє поле контракту) — nameEn', () => {
    expect(cityName({ name: 'Київ', nameEn: 'Kyiv City' }, 'en')).toBe('Kyiv City');
  });
});

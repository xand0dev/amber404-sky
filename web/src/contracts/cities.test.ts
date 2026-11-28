// Контракт static/cities.json (issue #125): необов'язкове поле nameEn — назва міста англійською.
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../contracts/cities.schema.json';
import file from '../../public/data/static/cities.json';
import type { City } from '.';

const cities: City[] = file;
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const kyiv = { name: 'Київ', lat: 50.45, lon: 30.52 };
const with16 = (c: object) => [c, ...cities.slice(1)];

describe('static/cities.json', () => {
  it('Given файл; When перевірити за schema; Then валідний, 16 міст', () => {
    expect(validate(cities)).toBe(true);
    expect(cities).toHaveLength(16);
  });

  it('Given 16 обласних центрів; When взяти nameEn; Then офіційні англійські назви', () => {
    expect(Object.fromEntries(cities.map((c) => [c.name, c.nameEn]))).toEqual({
      Київ: 'Kyiv', Львів: 'Lviv', Харків: 'Kharkiv', Одеса: 'Odesa', Дніпро: 'Dnipro', Запоріжжя: 'Zaporizhzhia',
      Вінниця: 'Vinnytsia', Полтава: 'Poltava', Чернігів: 'Chernihiv', Суми: 'Sumy', Житомир: 'Zhytomyr', Рівне: 'Rivne',
      Ужгород: 'Uzhhorod', Миколаїв: 'Mykolaiv', Херсон: 'Kherson', Сімферополь: 'Simferopol',
    });
  });

  it('Given місто без nameEn; When перевірити за schema; Then валідне (поле необов\'язкове)', () => {
    expect(validate(with16(kyiv))).toBe(true);
  });

  it('Given nameEn порожнє або не рядок; When перевірити за schema; Then невалідне', () => {
    expect(validate(with16({ ...kyiv, nameEn: '' }))).toBe(false);
    expect(validate(with16({ ...kyiv, nameEn: 42 }))).toBe(false);
  });
});

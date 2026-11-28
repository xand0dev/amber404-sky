// Контракт static/relief.json (issue #102): схема, тип Relief і орієнтація сітки.
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../contracts/relief.schema.json';
import file from '../../public/data/static/relief.json';
import type { Relief } from '.';

const relief: Relief = file;
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const at = (lat: number, lon: number) =>
  relief.elev[Math.round((lat - relief.lat0) / relief.step) * relief.nc + Math.round((lon - relief.lon0) / relief.step)];

describe('static/relief.json', () => {
  it('Given файл з #98; When перевірити за schema; Then валідний і elev має nr × nc значень', () => {
    expect(validate(relief)).toBe(true);
    expect(relief.elev).toHaveLength(relief.nr * relief.nc);
  });

  it('Given рядок 0 = lat0 — південь; When взяти точки; Then море null, суша — метри', () => {
    expect(at(45.5, 31.5)).toBeNull(); // Чорне море
    expect(at(50.45, 30.52)).toBeGreaterThan(50); // Київ
    expect(at(48.16, 24.5)).toBeGreaterThan(1000); // Чорногора
  });

  it('Given зіпсований файл; When перевірити за schema; Then невалідний', () => {
    expect(validate({ ...relief, source: 'srtm' })).toBe(false);
    expect(validate({ ...relief, elev: [1.5, -3, 'x'] })).toBe(false);
    expect(validate({ ...relief, step: undefined })).toBe(false);
  });
});

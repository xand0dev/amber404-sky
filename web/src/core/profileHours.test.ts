import { describe, expect, it } from 'vitest';
import { backgroundOrder, emptyProfile, hourPath, withHours } from './profileHours';
import { weatherAt } from './weather';
import { GEN, grid, hourFile, index, times } from './profileHours.test-util';

// #165, SPEC §6.2: профіль на диску — profile/index.json + profile/hNN.json; у пам'яті — звичний Profile.
const levels = index.levels;

const meta = { generatedAt: GEN, mock: true, grid, times, sources: [] };

describe('#165: профіль за годинами', () => {
  it('шлях файлу години — з index', () => {
    expect(hourPath(index, 0)).toBe('profile/h00.json');
    expect(hourPath(index, 47)).toBe('profile/h47.json');
  });

  it('порожній профіль: усі 48 годин — немає даних, не нулі', () => {
    const p = emptyProfile(index);
    expect(p.levels).toEqual(levels);
    expect(p.spd).toHaveLength(16);
    const wx = weatherAt({ meta, profile: p }, 50.45, 30.52, 50, 0);
    expect(wx.ws).toBeNull();
    expect(wx.t).toBeNull();
  });

  it('withHours кладе години на свої місця [рівень][година][точка], решта лишається без даних', () => {
    const p = withHours(emptyProfile(index), index, [hourFile(3, 70)]);
    expect(p.spd[0][3][0]).toBe(70);
    expect(p.temp[3][5]).toBe(70);
    expect(p.spd[0][2]).toBeUndefined();
    expect(weatherAt({ meta, profile: p }, 50.45, 30.52, 50, 3).t).toBeCloseTo(7);
    expect(weatherAt({ meta, profile: p }, 50.45, 30.52, 50, 4).t).toBeNull();
  });

  it('withHours не змінює вхідний профіль (новий об\'єкт для React)', () => {
    const p0 = emptyProfile(index);
    const p1 = withHours(p0, index, [hourFile(0)]);
    expect(p1).not.toBe(p0);
    expect(p0.spd[0][0]).toBeUndefined();
  });

  it('година з іншого запуску (інший generatedAt) не змішується — лишається «немає даних»', () => {
    const p = withHours(emptyProfile(index), index, [hourFile(1, 5, '2026-11-28T06:05:00Z')]);
    expect(p.spd[0][1]).toBeUndefined();
  });

  it('фонове довантаження: від наступної після поточної до кінця, потім ранні', () => {
    expect(backgroundOrder(45, 48)).toEqual([46, 47, ...Array.from({ length: 45 }, (_, i) => i)]);
    expect(backgroundOrder(0, 3)).toEqual([1, 2]);
  });
});

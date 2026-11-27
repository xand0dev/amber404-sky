import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shape } from '../../core';
import { KEY, draw, initDraw, loadShapes, saveShapes } from './store';

const P: Shape = { id: 'p', kind: 'point', color: '#e2a72e', coords: [[50.45, 30.52]], label: 'A' };
const L: Shape = { id: 'l', kind: 'line', color: '#e0532f', coords: [[50, 30], [50.1, 30.2]] };

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('Given малюнки (SPEC §7.13); When зберегти й перезавантажити', () => {
  it('Then з localStorage повертаються ті самі фігури, без мережі', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(saveShapes([P, L])).toBe(true);
    expect(loadShapes()).toEqual([P, L]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('Then зіпсований запис не ламає застосунок: погані фігури відкинуто', () => {
    localStorage.setItem(KEY, JSON.stringify([P, { id: 'x', kind: 'target', color: '#fff', coords: [] }]));
    expect(loadShapes()).toEqual([P]);
    localStorage.setItem(KEY, '{не json');
    expect(loadShapes()).toEqual([]);
  });
  it('Then localStorage недоступне (приватне вікно) — false / [], без винятку', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(saveShapes([P])).toBe(false);
    expect(loadShapes()).toEqual([]);
  });
});

describe('Given історія дій; When додати, видалити, скасувати', () => {
  it('Then «скасувати» повертає попередній стан по кроку', () => {
    let s = initDraw([]);
    s = draw(s, { type: 'add', shape: P });
    s = draw(s, { type: 'add', shape: L });
    s = draw(s, { type: 'remove', id: 'p' });
    expect(s.shapes).toEqual([L]);
    s = draw(s, { type: 'undo' });
    expect(s.shapes).toEqual([P, L]);
    s = draw(s, { type: 'undo' });
    expect(s.shapes).toEqual([P]);
    s = draw(s, { type: 'undo' });
    s = draw(s, { type: 'undo' });
    expect(s.shapes).toEqual([]);
  });
  it('Then імпорт додає фігури одним кроком', () => {
    let s = draw(initDraw([P]), { type: 'import', shapes: [L, L] });
    expect(s.shapes).toHaveLength(3);
    s = draw(s, { type: 'undo' });
    expect(s.shapes).toEqual([P]);
  });
});

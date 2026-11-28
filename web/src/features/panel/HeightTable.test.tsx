import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DroneProfile } from '../../contracts';
import { cloudBase, dewPoint } from '../../core';
import { HeightTableView, cellColor } from './HeightTable';
import { heightsTable, pageStart, TABLE_ALTS } from './heights';
import { fixture } from './fixture.test-util';

afterEach(cleanup);

const P: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
// Вітер на рівні l = 2 + l м/с: 10 м → 2, 400 м → 10, 450 м → 11 (понад ліміт 10).
const SRC = fixture();
const CB = cloudBase(10, dewPoint(10, 90)); // ≈ 190 м

describe('F4-AC2: дані таблиці', () => {
  it('Given точка When таблиця Then 11 висот × 24 год, зверху 500 м', () => {
    const t = heightsTable(SRC, 50.45, 30.5, P, 0);
    expect(TABLE_ALTS).toHaveLength(11);
    expect(t).toHaveLength(11);
    expect(t.every((row) => row.length === 24)).toBe(true);
    expect(t[0][0].altM).toBe(500);
    expect(t[10][0].altM).toBe(10);
    expect(t[0].map((c) => c.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });
  it('число м/с і напрям; понад ліміт — over (на межі — ні)', () => {
    const t = heightsTable(SRC, 50.45, 30.5, P, 0);
    const by = (alt: number) => t[TABLE_ALTS.indexOf(alt)][0];
    expect(by(10).ws).toBeCloseTo(2, 5);
    expect(by(10).dir).toBeCloseTo(330, 5);
    expect(by(400).ws).toBeCloseTo(10, 5);
    expect(by(400).over).toBe(false);
    expect(by(450).over).toBe(true);
  });
  it('у хмарі (висота ≥ cb) — cloud', () => {
    expect(CB).toBeGreaterThan(150);
    expect(CB).toBeLessThan(200);
    const t = heightsTable(SRC, 50.45, 30.5, P, 0);
    expect(t[TABLE_ALTS.indexOf(200)][0].cloud).toBe(true);
    expect(t[TABLE_ALTS.indexOf(150)][0].cloud).toBe(false);
  });
  it('немає даних — null, не over', () => {
    const t = heightsTable(fixture({ spd: () => null }), 50.45, 30.5, P, 0);
    expect(t[0][0].ws).toBeNull();
    expect(t[0][0].over).toBe(false);
    expect(cellColor(null, 10)).toBe('var(--rule)');
    expect(cellColor(11, 10)).toBe('var(--base)');
    expect(cellColor(9, 10)).toBe('var(--cau)');
    expect(cellColor(7, 10)).toBe('var(--go)');
  });
  it('сторінки: година 30 → години 24–47; на 30-годинних даних — останні 24', () => {
    expect(pageStart(5, 48)).toBe(0);
    expect(pageStart(30, 48)).toBe(24);
    expect(pageStart(29, 30)).toBe(6);
    expect(heightsTable(SRC, 50.45, 30.5, P, 24)[0][0].hour).toBe(24);
  });
});

function view(extra: Partial<Parameters<typeof HeightTableView>[0]> = {}) {
  const cells = heightsTable(SRC, 50.45, 30.5, P, 0);
  return render(<HeightTableView cells={cells} times={SRC.meta.times} limit={10} hour={0} altM={50} total={48} lang="uk"
    onPick={() => {}} onPage={() => {}} {...extra} />);
}

describe('F4-AC2: таблиця на екрані', () => {
  it('Then 264 клітинки з числом і стрілкою', () => {
    view();
    const cells = screen.getAllByTestId('hcell');
    expect(cells).toHaveLength(11 * 24);
    expect(cells[0].textContent).toMatch(/^12↑$/);
  });
  it('Then червона рамка понад ліміт і штрихування в хмарі', () => {
    view();
    const top = screen.getAllByTestId('hcell')[0]; // 500 м
    expect(top.className).toContain('over');
    expect(top.className).toContain('cloud');
    expect(top.getAttribute('aria-label')).toMatch(/понад ліміт, у хмарі/);
    const low = screen.getAllByTestId('hcell')[10 * 24]; // 10 м
    expect(low.className).not.toContain('over');
    expect(low.className).not.toContain('cloud');
  });
  it('When клік по клітинці Then година й висота цієї клітинки', () => {
    const picks: [number, number][] = [];
    view({ onPick: (h, a) => picks.push([h, a]) });
    fireEvent.click(screen.getAllByTestId('hcell')[2 * 24 + 5]); // 400 м, година 5
    expect(picks).toEqual([[5, 400]]);
  });
  it('обрана клітинка підсвічена й одна в Tab; стрілки переходять до сусідньої', () => {
    view({ hour: 3, altM: 50 });
    const on = screen.getAllByTestId('hcell').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0].getAttribute('tabindex')).toBe('0');
    expect(screen.getAllByTestId('hcell').filter((b) => b.getAttribute('tabindex') === '0')).toHaveLength(1);
    on[0].focus();
    fireEvent.keyDown(on[0], { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('data-rc')).toBe('9-4');
  });
  it('перемикач 1–24 / 25–48', () => {
    const pages: number[] = [];
    view({ onPage: (h) => pages.push(h) });
    fireEvent.click(screen.getByRole('button', { name: /25–48/ }));
    expect(pages).toEqual([24]);
  });
});

describe('#146 WCAG 2.5.3: доступне ім\'я клітинки містить видиме число', () => {
  it('ім\'я кожної клітинки починається з числа, яке видно', () => {
    view();
    for (const b of screen.getAllByTestId('hcell')) {
      const shown = (b.textContent ?? '').replace('↑', '').trim();
      expect(b.getAttribute('aria-label')?.startsWith(`${shown} — `)).toBe(true);
    }
  });
  it('немає даних — «—» і в тексті, і на початку імені', () => {
    const cells = heightsTable(fixture({ spd: () => null }), 50.45, 30.5, P, 0);
    render(<HeightTableView cells={cells} times={SRC.meta.times} limit={10} hour={0} altM={50} total={48} lang="en" onPick={() => {}} onPage={() => {}} />);
    expect(screen.getAllByTestId('hcell')[0].getAttribute('aria-label')).toMatch(/^— — 500 m, /);
  });
});

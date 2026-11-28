// Issue #171: вердикт-герой (AC1), чипи причин (AC2), міні-графік вітру 12 год (AC3), картки погоди (AC4), рух і 400 px (AC5).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DroneProfile } from '../../contracts';
import type { Level, Weather } from '../../core';
import { PointView } from './Panel';
import { ChipsView } from './Chips';
import { WindSparkView } from './WindSpark';
import { sparkModel } from './spark';

afterEach(cleanup);

const PROF: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
const WX: Weather = { ws: 9.2, dir: 330, g: 9.1, t: 2.5, td: 0, cb: 1312.5, p: 0, rh: 60, vis: 20000, kp: 2, galVisible: 9, galPdop: 1.8 };
const CSS = readFileSync(join(process.cwd(), 'src/features/panel/panel.css'), 'utf8');

function view(extra: Partial<Parameters<typeof PointView>[0]> = {}) {
  return render(
    <PointView city={{ name: 'Київ', km: 1.2 }} lat={50.45} lon={30.52} altM={50} wx={WX}
      verdict={{ level: 'CAUTION', reasons: ['Вітер 9.2 м/с — понад 80% ліміту', 'x'] }}
      windowText="—" prof={PROF} lang="uk" {...extra} />,
  );
}

describe('AC1: вердикт-герой', () => {
  it('Given CAUTION Then картка вгорі панелі: колір рівня, велике слово, місце, один рядок «чому»', () => {
    const { container } = view();
    const hero = container.querySelector('.point > .hero') as HTMLElement;
    expect(hero).toBe(container.querySelector('.point')?.firstElementChild);
    expect(hero.classList.contains('lv-CAUTION')).toBe(true);
    expect(hero.querySelector('.word')?.textContent).toBe('ОБЕРЕЖНО');
    expect(hero.querySelector('h2')?.textContent).toBe('Київ');
    expect(screen.getByTestId('hero-why').textContent).toBe('Вітер 9.2 м/с — понад 80% ліміту');
  });
  it('NO-GO і GO — свої слова й кольори; EN', () => {
    const { container } = view({ verdict: { level: 'NO-GO', reasons: ['a'] } });
    expect(container.querySelector('.hero')?.className).toContain('lv-NO-GO');
    expect(container.querySelector('.hero .word')?.textContent).toBe('НЕ МОЖНА');
    cleanup();
    const r = view({ verdict: { level: 'GO', reasons: ['Within profile limits'] }, lang: 'en' });
    expect(r.container.querySelector('.hero .word')?.textContent).toBe('GO');
    expect(screen.getByTestId('hero-why').textContent).toBe('Within profile limits');
  });
  it('Given точка поза містами Then у герої координати', () => {
    const { container } = view({ city: null, lat: 49, lon: 33 });
    expect(container.querySelector('.hero h2')?.textContent).toBe('49.000, 33.000');
  });
  it('плавна зміна кольору; reduced motion — без переходу', () => {
    expect(CSS).toMatch(/\.hero\{[^}]*transition:[^}]*background-color/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\.hero[^{]*\{[^}]*transition:none/);
  });
  it('нічний режим: рівень видно формою, бо заливка вночі чорна', () => {
    for (const lv of ['GO', 'CAUTION', 'NO-GO']) expect(CSS).toMatch(new RegExp(`\\[data-theme="night"\\] \\.hero\\.lv-${lv}\\{`));
  });
});

describe('AC2: чипи причин', () => {
  it('Given вітер 9.2 при ліміті 10 Then перший чип «вітер 9.2 / 10 м/с» з іконкою', () => {
    view();
    const items = screen.getByTestId('chips').querySelectorAll('li');
    expect(items).toHaveLength(9);
    expect(items[0].textContent).toBe('вітер 9.2 / 10 м/с');
    expect(items[0].getAttribute('data-sev')).toBe('cau');
    expect(items[0].querySelector('svg.ico')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('найгірша перша: пориви понад ліміт раніше за вітер ОБЕРЕЖНО', () => {
    render(<ChipsView wx={{ ...WX, g: 14 }} prof={PROF} altM={50} lang="uk" />);
    const t = [...screen.getByTestId('chips').querySelectorAll('li')].map((x) => [x.getAttribute('data-sev'), x.textContent]);
    expect(t.slice(0, 2)).toEqual([['no', 'пориви 14.0 / 13 м/с'], ['cau', 'вітер 9.2 / 10 м/с']]);
  });
  it('усі значення з одиницями, одиниці — дрібніше (<small>)', () => {
    render(<ChipsView wx={{ ...WX, t: -12, vis: 800, kp: 5.3 }} prof={PROF} altM={50} lang="uk" />);
    const txt = [...screen.getByTestId('chips').querySelectorAll('li')].map((x) => x.textContent);
    expect(txt).toContain('темп. -12.0 / від -15 °C');
    expect(txt).toContain('видимість 0.8 / від 1 км');
    expect(txt).toContain('Kp 5.3 / до 5');
    expect(txt).toContain('хмари від 1313 м · висота 50 м');
    expect(txt).toContain('Galileo 9 / від 6 суп. · PDOP 1.8');
    expect(txt).toContain('обмерзання ні');
    expect(screen.getByTestId('chips').querySelector('li small')?.textContent).toBeTruthy();
  });
  it('немає даних — «немає даних», не «в межах»; EN без кирилиці', () => {
    render(<ChipsView wx={{ ...WX, kp: null }} prof={PROF} altM={50} lang="en" />);
    const li = [...screen.getByTestId('chips').querySelectorAll('li')];
    expect(li.at(-1)?.textContent).toBe('Kp — no data');
    expect(li[0].textContent).toBe('wind 9.2 / 10 m/s');
    expect(screen.getByTestId('chips').textContent).not.toMatch(/[А-Яа-яІіЇїЄєҐґ]/);
  });
});

const TIMES = Array.from({ length: 48 }, (_, h) => new Date(Date.UTC(2026, 10, 28, 7 + h)).toISOString().replace('.000', ''));
const WS = Array.from({ length: 48 }, (_, h) => 2 + (h % 12));
const LV: Level[] = WS.map((w) => (w > 10 ? 'NO-GO' : w > 8 ? 'CAUTION' : 'GO'));

describe('AC3: міні-графік вітру 12 год', () => {
  const spark = (hour = 0, lang: 'uk' | 'en' = 'uk') =>
    render(<WindSparkView model={sparkModel(WS, LV, 10, hour)} times={TIMES} hour={hour} limit={10} altM={50} lang={lang} />);
  it('Then 12 точок лінії, лінія ліміту дрона, 12 зафарбованих годин за вердиктом', () => {
    const { container } = spark(2);
    const m = sparkModel(WS, LV, 10, 2);
    const pts = [...container.querySelectorAll('polyline.sp-line')].flatMap((p) => p.getAttribute('points')!.trim().split(/\s+/));
    expect(pts).toHaveLength(12);
    const lim = container.querySelector('line.sp-lim')!;
    expect(Number(lim.getAttribute('y1'))).toBeCloseTo(m.limitY);
    expect(lim.getAttribute('y1')).toBe(lim.getAttribute('y2'));
    const bands = [...container.querySelectorAll('rect.sp-b')];
    expect(bands).toHaveLength(12);
    expect(bands.map((b) => b.getAttribute('data-level'))).toEqual(LV.slice(2, 14));
    expect(bands[0].getAttribute('class')).toContain('sp-GO');
  });
  it('доступне ім\'я з висотою й лімітом; підпис ліміту й годин', () => {
    spark(0);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Вітер на 50 м, 12 год: макс. 13.0 м/с, ліміт дрона 10 м/с');
    expect(screen.getByTestId('spark-axis').textContent).toContain('09:00');
    expect(screen.getByTestId('spark-axis').textContent).toContain('20:00');
    expect(screen.getByTestId('spark-axis').textContent).toContain('ліміт 10 м/с');
  });
  it('обрана година позначена', () => {
    const { container } = spark(5);
    expect(container.querySelectorAll('rect.sp-b.on')).toHaveLength(1);
    expect(container.querySelector('rect.sp-b.on')?.getAttribute('data-hour')).toBe('5');
  });
  it('EN', () => {
    spark(0, 'en');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Wind at 50 m, 12 h: max 13.0 m/s, drone limit 10 m/s');
  });
});

describe('AC4–5: картки погоди й 400 px', () => {
  it('картки — однакова сітка, tabular-nums, одиниці в <small>', () => {
    const { container } = view();
    expect(CSS).toMatch(/\.point \.vals\{[^}]*grid-auto-rows:1fr/);
    expect(CSS).toMatch(/\.point \.vals dd\{[^}]*font-variant-numeric:tabular-nums/);
    expect(CSS).toMatch(/\.chip\{[^}]*font-variant-numeric:tabular-nums/);
    const gust = screen.getByText('Пориви').parentElement!;
    expect(gust.querySelector('dd small')?.textContent).toBe('м/с');
    expect(container.querySelector('.vals')).toBeTruthy();
  });
  it('графік і чипи не ширші за панель', () => {
    expect(CSS).toMatch(/\.spark\{[^}]*max-width:100%/);
    expect(CSS).toMatch(/\.chips\{[^}]*flex-wrap:wrap/);
  });
});

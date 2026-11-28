import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DroneProfile } from '../../contracts';
import type { Weather } from '../../core';
import { PointView } from './Panel';
import { arrowDeg, nearestCity, placeText } from './place';

afterEach(cleanup);

const CITIES = [{ name: 'Київ', lat: 50.45, lon: 30.52 }, { name: 'Житомир', lat: 50.25, lon: 28.66 }];
const PROF: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};
const WX: Weather = { ws: 6.24, dir: 330, g: 9.1, t: 2.5, td: 0, cb: 312.5, p: 0, rh: 80, vis: 20000, kp: 2, galVisible: 9, galPdop: 1.8 };

describe('F4-AC1: найближче місто', () => {
  it('Given точка за 5 км від Києва When пошук Then Київ', () => {
    const c = nearestCity(CITIES, 50.49, 30.52);
    expect(c?.name).toBe('Київ');
    expect(c?.km).toBeGreaterThan(4);
    expect(c?.km).toBeLessThan(5);
  });
  it('Given точка далі ніж 35 км від усіх міст When пошук Then null (показуємо координати)', () => {
    expect(nearestCity(CITIES, 49.0, 33.0)).toBeNull();
    expect(placeText(CITIES, 49.0, 33.0)).toBe('49.000, 33.000');
  });
  it('межа: 34.9 км — місто, 35.1 км — ні', () => {
    // 1° широти ≈ 111.19 км
    expect(nearestCity(CITIES, 50.45 + 34.9 / 111.19, 30.52)?.name).toBe('Київ');
    expect(nearestCity(CITIES, 50.45 + 35.1 / 111.19, 30.52)).toBeNull();
  });
  it('обирає найближче з кількох', () => {
    expect(nearestCity(CITIES, 50.3, 28.8)?.name).toBe('Житомир');
  });
  it('стрілка показує, куди дме: з 330° → 150°', () => {
    expect(arrowDeg(330)).toBe(150);
    expect(arrowDeg(0)).toBe(180);
  });
});

function view(extra: Partial<Parameters<typeof PointView>[0]> = {}) {
  return render(
    <PointView city={{ name: 'Київ', km: 1.2 }} lat={50.45} lon={30.52} altM={50} wx={WX}
      verdict={{ level: 'CAUTION', reasons: ['Висота 50 м близько до хмар (≈ 312 м)', 'Пориви 11.0 м/с — понад 80% ліміту'] }}
      windowText="сб 10:00 – 14:59 · 5 год" prof={PROF} lang="uk" {...extra} />,
  );
}

describe('F4-AC1: панель точки на екрані', () => {
  it('Then назва міста, координати, вітер і напрямок на висоті, пориви, хмари', () => {
    view();
    expect(screen.getByRole('heading', { name: /Київ/ })).toBeTruthy();
    expect(screen.getByText('50.450, 30.520', { exact: false })).toBeTruthy();
    const wind = screen.getByText('Вітер').parentElement?.textContent ?? '';
    expect(wind).toContain('6.2 м/с');
    expect(wind).toContain('з 330°');
    expect(screen.getByTestId('wind-arrow').getAttribute('style')).toContain('rotate(150deg)');
    expect(screen.getByText('Пориви').parentElement?.textContent).toContain('9.1 м/с');
    expect(screen.getByText('Хмари від').parentElement?.textContent).toContain('313 м');
  });
  it('Then вердикт з причинами і вікно', () => {
    view();
    expect(screen.getByTestId('point-level').textContent).toBe('ОБЕРЕЖНО');
    expect(screen.getAllByRole('listitem').map((x) => x.textContent)).toEqual([
      'Висота 50 м близько до хмар (≈ 312 м)', 'Пориви 11.0 м/с — понад 80% ліміту',
    ]);
    expect(screen.getByText('Вікно').parentElement?.textContent).toContain('сб 10:00 – 14:59 · 5 год');
  });
  it('Given точка поза містами Then заголовок — координати', () => {
    view({ city: null, lat: 49, lon: 33 });
    expect(screen.getByRole('heading', { name: '49.000, 33.000' })).toBeTruthy();
  });
  it('Given немає даних Then «—» і NO-DATA, а не GO', () => {
    view({ wx: { ...WX, ws: null, dir: null, g: null, cb: null }, verdict: { level: 'NO-DATA', reasons: ['Немає даних про вітер'] } });
    expect(screen.getByTestId('point-level').textContent).toBe('НЕМАЄ ДАНИХ');
    expect(screen.getByText('Вітер').parentElement?.textContent).toContain('—');
    expect(screen.queryByTestId('wind-arrow')).toBeNull();
  });
  it('Then ліміти профілю і позначка assumption на екрані (§7.9, F4-AC5)', () => {
    view();
    expect(screen.getByText(/Ліміти: вітер 10 м\/с, пориви 13 м\/с/)).toBeTruthy();
    expect(screen.getByText(/assumption/)).toBeTruthy();
  });
  it('Given джерело-посилання Then показуємо посилання', () => {
    view({ prof: { ...PROF, source: 'https://www.dji.com/mavic-3/specs' } });
    const a = screen.getByRole('link', { name: /dji\.com/ });
    expect(a.getAttribute('href')).toBe('https://www.dji.com/mavic-3/specs');
  });
  it('англійською', () => {
    view({ lang: 'en' });
    expect(screen.getByText('Wind').parentElement?.textContent).toContain('6.2 m/s');
    expect(screen.getByTestId('point-level').textContent).toBe('CAUTION');
  });
});

// Issue #87 AC2: ліміти й «assumption» — у згорнутому розкривачі «Деталі», вердикт і вікно — на виду.
describe('Given панель точки (issue #87)', () => {
  it('Then ліміти й джерело лімітів — у згорнутих «Деталі»; причини й вікно поза ними', () => {
    const { container } = view();
    const det = container.querySelector('.point details:not(.vwhat)') as HTMLDetailsElement;
    expect(det.open).toBe(false);
    expect(det.querySelector('summary')?.textContent).toBe('Деталі');
    expect(det.contains(screen.getByText(/Ліміти: вітер 10 м\/с/))).toBe(true);
    expect(det.contains(container.querySelector('.reasons'))).toBe(false);
    expect(det.contains(container.querySelector('.win'))).toBe(false);
  });
  it('англійською — Details', () => {
    const { container } = view({ lang: 'en' });
    expect(container.querySelector('.point details:not(.vwhat) summary')?.textContent).toBe('Details');
  });
});

describe('#151: вердикт людською мовою й «Що це?»', () => {
  it('Given CAUTION Then фраза з дроном і висотою одразу під заголовком', () => {
    view();
    const e = screen.getByTestId('verdict-explain');
    expect(e.textContent).toBe('Обережно: «FPV 7″» на 50 м. Погода близько до лімітів дрона. Причини нижче.');
    // Одразу після заголовка точки — видно без прокрутки панелі.
    expect(e.previousElementSibling?.className).toBe('pointhead');
  });
  it('GO — «в межах лімітів», не «безпечно»; NO-DATA — «не дозвіл»', () => {
    view({ verdict: { level: 'GO', reasons: ['Умови в межах профілю'] } });
    expect(screen.getByTestId('verdict-explain').textContent).toMatch(/^Можна летіти: погода в межах лімітів .* Це не гарантія безпеки\.$/);
    cleanup();
    view({ verdict: { level: 'NO-DATA', reasons: ['Немає даних про вітер'] } });
    expect(screen.getByTestId('verdict-explain').textContent).toBe('Немає даних для вердикту. Це не дозвіл летіти.');
  });
  it('«Що це?» згорнуто й пояснює, з чого вердикт; англійською', () => {
    const { container } = view({ lang: 'en', verdict: { level: 'NO-GO', reasons: ['x'] } });
    const what = container.querySelector('details.vwhat') as HTMLDetailsElement;
    expect(what.open).toBe(false);
    expect(what.querySelector('summary')?.textContent).toBe('What is this?');
    expect(screen.getByTestId('verdict-how').textContent).toMatch(/compares the forecast .* limits of the selected drone/);
    expect(screen.getByTestId('verdict-explain').textContent).toMatch(/^Do not fly: “FPV 7″” at 50 m/);
  });
});

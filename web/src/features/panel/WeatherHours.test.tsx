import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { DroneProfile, Galileo, Kp } from '../../contracts';
import { WeatherHoursView } from './WeatherHours';
import { hourCol, hoursTable } from './hoursData';
import { fixture } from './fixture.test-util';

afterEach(cleanup);

const FPV: DroneProfile = {
  id: 'fpv7', name: 'FPV 7″', use: '', massKg: 1, energy: 'battery', enduranceMin: 10, cruiseMs: 22, windMs: 10, gustMs: 13,
  tMinC: -15, precipMmH: 0.5, bandM: [10, 90], defaultAltM: 50, kind: 'multirotor', source: 'assumption',
};

function src(over: Parameters<typeof fixture>[0] = {}, kp?: number, gal?: [number, number]) {
  const base = fixture(over);
  const t0 = base.meta.times[0];
  const kpData: Kp | null = kp == null ? null : { generatedAt: t0, sources: ['noaa-kp'], series: base.meta.times.filter((_, i) => i % 3 === 0).map((t) => ({ t, kp, observed: false })) };
  const galData: Galileo | null = gal == null ? null : {
    generatedAt: t0, sources: ['celestrak-galileo'], elevationMaskDeg: 10, points: [{ name: 'Київ', lat: 50.45, lon: 30.52 }],
    visible: [base.meta.times.map(() => gal[0])], pdop: [base.meta.times.map(() => gal[1])],
  };
  return { ...base, kp: kpData, galileo: galData };
}

describe('F3-AC3: дані таблиці на 24 год', () => {
  it('24 години від початку сторінки; вітер на 10 / 80 / 120 м', () => {
    const cols = hoursTable(src(), 50.45, 30.5, FPV, 0);
    expect(cols).toHaveLength(24);
    expect(cols[0].wind.map((w) => w.altM)).toEqual([10, 80, 120]);
    expect(cols[0].wind[0].ws).toBeCloseTo(2, 5);
    expect(hoursTable(src(), 50.45, 30.5, FPV, 24)[0].hour).toBe(24);
  });
  it('пориви, темп., опади, видимість, обмерзання з core', () => {
    const c = hourCol(src({ tempC: 1, rh: 95 }), 50.45, 30.5, FPV, 0);
    expect(c.g).toBeCloseTo(6, 5);
    expect(c.t).toBeCloseTo(1, 5);
    expect(c.p).toBe(0);
    expect(c.vis).toBe(20000);
    expect(c.icing).toBe(true); // −10…2 °C і вологість ≥ 90%
  });
  it('пороги як у §7.4: вітер > ліміту — NO-GO, > 80% — CAUTION; мороз біля мінімуму — CAUTION', () => {
    const hi = hourCol(src({ spd: () => 11 }), 50.45, 30.5, FPV, 0);
    expect(hi.wind[0].flag).toBe('no');
    expect(hourCol(src({ spd: () => 9 }), 50.45, 30.5, FPV, 0).wind[0].flag).toBe('cau');
    expect(hourCol(src({ spd: () => 7 }), 50.45, 30.5, FPV, 0).wind[0].flag).toBeNull();
    expect(hourCol(src({ tempC: -12 }), 50.45, 30.5, FPV, 0).tFlag).toBe('cau');
    expect(hourCol(src({ tempC: -16 }), 50.45, 30.5, FPV, 0).tFlag).toBe('no');
  });
  it('Kp ≥ 5 і Galileo < 6 супутників або PDOP > 4 — CAUTION', () => {
    const c = hourCol(src({}, 5.3, [5, 2.1]), 50.45, 30.5, FPV, 0);
    expect(c.kp).toBeCloseTo(5.3, 5);
    expect(c.kpFlag).toBe('cau');
    expect(c.galFlag).toBe('cau');
    const ok = hourCol(src({}, 2, [9, 1.8]), 50.45, 30.5, FPV, 0);
    expect(ok.kpFlag).toBeNull();
    expect(ok.galFlag).toBeNull();
  });
  it('немає Kp і Galileo → null («—»), а не нуль', () => {
    const c = hourCol(src(), 50.45, 30.5, FPV, 0);
    expect(c.kp).toBeNull();
    expect(c.galVisible).toBeNull();
  });
});

describe('F3-AC3: таблиця на екрані', () => {
  const s = src({ tempC: 1, rh: 95, spd: () => 11 }, 5.3, [5, 2.1]);
  const view = (lang: 'uk' | 'en' = 'uk') => render(<WeatherHoursView cols={hoursTable(s, 50.45, 30.5, FPV, 0)} times={s.meta.times} hour={2} lang={lang} />);
  it('рядки: вітер 10/80/120 зі стрілками, пориви, темп., опади, видимість, обмерзання, Kp, Galileo — по 24 клітинки', () => {
    view();
    for (const id of ['wh-wind-10', 'wh-wind-80', 'wh-wind-120', 'wh-gust', 'wh-temp', 'wh-precip', 'wh-vis', 'wh-icing', 'wh-kp', 'wh-gal']) {
      expect(within(screen.getByTestId(id)).getAllByRole('cell')).toHaveLength(24);
    }
    expect(within(screen.getByTestId('wh-wind-10')).getAllByRole('cell')[0].textContent).toBe('11↑');
    expect(within(screen.getByTestId('wh-icing')).getAllByRole('cell')[0].textContent).toBe('так');
    expect(within(screen.getByTestId('wh-gal')).getAllByRole('cell')[0].textContent).toBe('5 2.1');
  });
  it('підсвічування за §7.4 і обрана година', () => {
    view();
    expect(within(screen.getByTestId('wh-wind-10')).getAllByRole('cell')[0].getAttribute('data-flag')).toBe('no');
    expect(within(screen.getByTestId('wh-kp')).getAllByRole('cell')[0].getAttribute('data-flag')).toBe('cau');
    expect(within(screen.getByTestId('wh-icing')).getAllByRole('cell')[0].getAttribute('data-flag')).toBe('no');
    expect(within(screen.getByTestId('wh-temp')).getAllByRole('cell')[2].className).toContain('on');
  });
  it('англійською — без кирилиці', () => {
    view('en');
    expect(screen.getByRole('region', { name: 'Weather by hour' }).textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
});

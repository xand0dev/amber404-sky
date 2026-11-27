// F3-AC6: підказка при наведенні — вітер, пориви, температура, видимість, вердикт (усе з core).
import { describe, expect, it } from 'vitest';
import { evaluate, weatherAt } from '../../core';
import { hoverInfo, hoverRows } from './hover';
import { bundle, state } from './fixture.test-util';

const data = bundle();

describe('Given точка в сітці; When наводимо мишу', () => {
  it('Then значення з core.weatherAt і core.evaluate на обраній висоті й годині', () => {
    const s = state({ altM: 70, hour: 1 });
    const wx = weatherAt({ meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo }, 48.3, 31.7, 70, 1);
    const v = evaluate(wx, data.profiles[0], 70);
    const info = hoverInfo(data, s, 48.3, 31.7, 'uk')!;
    expect(info).toMatchObject({ ws: wx.ws, dir: wx.dir, g: wx.g, t: wx.t, level: v.level, reason: v.reasons[0] });
    expect(info.visKm).toBeCloseTo((wx.vis as number) / 1000, 6);
  });
  it('Then поза сіткою — null (підказки немає)', () => {
    expect(hoverInfo(data, state(), 53.4, 30, 'uk')).toBeNull();
  });
});

describe('Given значення; When формуємо рядки підказки', () => {
  const info = { ws: 7.24, dir: 254, g: 10.2, t: -5.6, visKm: 12, level: 'CAUTION' as const, reason: 'Вітер 7.2 м/с — понад 80% ліміту' };
  it('Then 5 рядків: вітер на висоті, пориви, температура, видимість, вердикт — з одиницями', () => {
    expect(hoverRows(info, 'uk', 50)).toEqual([
      ['Вітер 50 м', '7.2 м/с · 254°'], ['Пориви', '10.2 м/с'], ['Темп.', '−5.6 °C'], ['Видимість', '12.0 км'],
      ['Вердикт', 'ОБЕРЕЖНО · Вітер 7.2 м/с — понад 80% ліміту'],
    ]);
  });
  it('Then немає даних — так і пишемо, не вигадуємо', () => {
    const rows = hoverRows({ ws: null, dir: null, g: null, t: null, visKm: null, level: 'NO-DATA', reason: 'Немає даних про вітер' }, 'uk', 50);
    expect(rows.slice(0, 4).map((r) => r[1])).toEqual(['немає даних', 'немає даних', 'немає даних', 'немає даних']);
    expect(rows[4][1]).toBe('НЕМАЄ ДАНИХ · Немає даних про вітер');
  });
  it('Then англійською — Wind / Gusts / Temp. / Visibility / Verdict', () => {
    expect(hoverRows({ ...info, level: 'GO', reason: 'ok' }, 'en', 80).map((r) => r[0])).toEqual(['Wind 80 m', 'Gusts', 'Temp.', 'Visibility', 'Verdict']);
    expect(hoverRows({ ...info, level: 'GO', reason: 'ok' }, 'en', 80)[0][1]).toBe('7.2 m/s · 254°');
  });
});

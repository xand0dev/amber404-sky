// Issue #169: кнопка «▶ Демо» — 30-секундний тур SPEC §3 (чиста логіка без DOM).
import { describe, expect, it } from 'vitest';
import { DEMO_STEPS, DEMO_TOTAL_MS, demoCaption, demoFrame, demoPatch, demoPoint, demoView, demoViewAt, isDemoUrl, lerpView, playHour } from './demo';
import { FULL_VIEW } from './projection';

describe('AC2: послідовність кроків SPEC §3 і тривалість ~30 с', () => {
  it('5 кроків у порядку демо', () => {
    expect(DEMO_STEPS.map((s) => s.id)).toEqual(['wind', 'go', 'point', 'play', 'space']);
  });
  it('тривалість 25–35 с', () => {
    expect(DEMO_TOTAL_MS).toBeGreaterThanOrEqual(25_000);
    expect(DEMO_TOTAL_MS).toBeLessThanOrEqual(35_000);
    expect(DEMO_TOTAL_MS).toBe(DEMO_STEPS.reduce((a, s) => a + s.ms, 0));
  });
  it('Given минув час When demoFrame Then крок і поступ у ньому; після кінця — null', () => {
    expect(demoFrame(0)).toEqual({ step: 0, id: 'wind', t: 0 });
    const s1 = DEMO_STEPS[0].ms;
    expect(demoFrame(s1)?.id).toBe('go');
    expect(demoFrame(s1 + DEMO_STEPS[1].ms / 2)).toEqual({ step: 1, id: 'go', t: 0.5 });
    expect(demoFrame(DEMO_TOTAL_MS - 1)?.id).toBe('space');
    expect(demoFrame(DEMO_TOTAL_MS)).toBeNull();
    expect(demoFrame(-5)?.id).toBe('wind');
  });
});

describe('AC2: що змінює кожен крок', () => {
  const pt = { lat: 49.59, lon: 34.55 };
  it('вся Україна, вітер 120 м', () => expect(demoPatch('wind', 0, pt, 48)).toEqual({ layer: 'wind', altM: 120, hour: 0 }));
  it('FPV 7″, 50 м, шар «Можна летіти»', () => expect(demoPatch('go', 0, pt, 48)).toEqual({ droneId: 'fpv7', altM: 50, layer: 'go' }));
  it('точка біля Полтави', () => expect(demoPatch('point', 0, pt, 48)).toEqual({ lat: 49.59, lon: 34.55 }));
  it('Given немає демо-точки Then крок точки нічого не змінює', () => expect(demoPatch('point', 0, null, 48)).toEqual({}));
  it('програвання 48 год: година росте від 0 до останньої', () => {
    expect(demoPatch('play', 0, pt, 48)).toEqual({ hour: 0 });
    expect(demoPatch('play', 1, pt, 48)).toEqual({ hour: 47 });
    const hs = [0, 0.25, 0.5, 0.75, 1].map((t) => playHour(t, 48));
    expect([...hs].sort((a, b) => a - b)).toEqual(hs);
    expect(playHour(0.5, 1)).toBe(0);
  });
  it('панель Galileo й ERA5 — програвання закінчене на останній годині', () => expect(demoPatch('space', 0.5, pt, 48)).toEqual({ hour: 47 }));
});

describe('AC2: демо-точка — з міст у static/cities.json, без вигаданих координат', () => {
  const cities = [{ name: 'Київ', nameEn: 'Kyiv', lat: 50.45, lon: 30.52 }, { name: 'Полтава', nameEn: 'Poltava', lat: 49.59, lon: 34.55 }];
  it('Полтава', () => expect(demoPoint(cities)).toEqual({ lat: 49.59, lon: 34.55 }));
  it('Given у списку немає Полтави Then null', () => expect(demoPoint([cities[0]])).toBeNull());
});

describe('AC2: плавний перехід вигляду', () => {
  it('lerpView: від початку до кінця, плавно', () => {
    const b = demoView({ lat: 49.59, lon: 34.55 });
    expect(b.zoom).toBeGreaterThan(1);
    expect(lerpView(FULL_VIEW, b, 0)).toEqual(FULL_VIEW);
    expect(lerpView(FULL_VIEW, b, 1)).toEqual(b);
    const m = lerpView(FULL_VIEW, b, 0.5);
    expect(m.zoom).toBeGreaterThan(1);
    expect(m.zoom).toBeLessThan(b.zoom);
  });
  const pt = { lat: 49.59, lon: 34.55 };
  it('вся Україна на кроках вітру й шару; наближення до точки; назад до всієї країни на програванні', () => {
    expect(demoViewAt('wind', 0.5, pt, false)).toEqual(FULL_VIEW);
    expect(demoViewAt('go', 0.5, pt, false)).toEqual(FULL_VIEW);
    expect(demoViewAt('point', 0, pt, false)).toEqual(FULL_VIEW);
    expect(demoViewAt('point', 1, pt, false)).toEqual(demoView(pt));
    expect(demoViewAt('play', 0, pt, false)).toEqual(demoView(pt));
    expect(demoViewAt('play', 1, pt, false)).toEqual(FULL_VIEW);
    expect(demoViewAt('space', 0.5, pt, false)).toBeNull();
  });
  it('prefers-reduced-motion: без анімації — одразу кінцевий вигляд', () => {
    expect(demoViewAt('point', 0, pt, true)).toEqual(demoView(pt));
    expect(demoViewAt('play', 0, pt, true)).toEqual(FULL_VIEW);
  });
  it('Given немає точки Then вигляд — уся Україна', () => expect(demoViewAt('point', 1, null, false)).toEqual(FULL_VIEW));
});

describe('AC1: ?demo=1', () => {
  it('запуск лише за demo=1', () => {
    expect(isDemoUrl('?demo=1')).toBe(true);
    expect(isDemoUrl('?lang=en&demo=1')).toBe(true);
    expect(isDemoUrl('')).toBe(false);
    expect(isDemoUrl('?demo=0')).toBe(false);
  });
});

describe('AC4: підписи лише зі справжніх значень; nodata — так і пишемо', () => {
  const ok = { forecast: 'ok' as const, galileo: 'ok' as const, climate: 'ok' as const };
  it('підписи uk і en для кожного кроку', () => {
    for (const s of DEMO_STEPS) {
      expect(demoCaption(s.id, 'uk', { ...ok })).not.toBe('');
      expect(demoCaption(s.id, 'en', { ...ok })).not.toBe(demoCaption(s.id, 'uk', { ...ok }));
    }
  });
  it('точка: рівень, перша причина й вікно — з вердикту', () => {
    const c = demoCaption('point', 'uk', { ...ok, level: 'CAUTION', reason: 'пориви 9 м/с', window: 'сб 10:00–14:59' });
    expect(c).toContain('ОБЕРЕЖНО');
    expect(c).toContain('пориви 9 м/с');
    expect(c).toContain('сб 10:00–14:59');
  });
  it('Galileo: кількість супутників і PDOP — зі значень', () => {
    const c = demoCaption('space', 'uk', { ...ok, galVisible: 9, galPdop: 1.64 });
    expect(c).toContain('9');
    expect(c).toContain('1.6');
    expect(c).toContain('ERA5');
  });
  it('Given Galileo nodata чи порожнє значення Then «немає даних», без чисел', () => {
    const a = demoCaption('space', 'uk', { ...ok, galileo: 'nodata', galVisible: 9, galPdop: 1.6 });
    const b = demoCaption('space', 'en', { ...ok, galVisible: null, galPdop: null });
    expect(a).toContain('Galileo: немає даних');
    expect(a).not.toContain('9');
    expect(a).not.toContain('1.6');
    expect(b).toContain('Galileo: no data');
  });
  it('Given клімат nodata Then «ERA5: немає даних»', () => {
    expect(demoCaption('space', 'uk', { ...ok, galVisible: 9, galPdop: 1.6, climate: 'nodata' })).toContain('ERA5: немає даних');
  });
  it('Given прогноз nodata Then кожен крок карти каже про це', () => {
    for (const id of ['wind', 'go', 'point', 'play'] as const) {
      expect(demoCaption(id, 'uk', { ...ok, forecast: 'nodata' })).toContain('прогноз: немає даних');
    }
  });
});

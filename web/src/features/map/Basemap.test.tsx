// Issue #100 (§7.6a): меню «Підкладка», збереження вибору, повзунок прозорості, атрибуція, лише статичні файли.
// Issue #130: одна кнопка «Підкладка» відкриває вибір; форма «Своя карта» (F0) — лише після вибору; OK / Esc / клік поза вікном закривають.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Basemap } from './Basemap';
import { BASE_KEY } from './basemaps';
import { resetBasemap } from './basemapStore';

const imgs: string[] = [];
beforeEach(() => {
  localStorage.clear(); resetBasemap(); imgs.length = 0;
  vi.stubGlobal('Image', class { onload: (() => void) | null = null; onerror: (() => void) | null = null; set src(v: string) { imgs.push(v); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const show = () => render(<div className="mapwrap"><Basemap /></div>);
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Підкладка' }));

describe('Given меню «Підкладка» (AC1)', () => {
  it('Без / Рельєф / Супутник / Своя карта; типово — Без', () => {
    show(); openMenu();
    const g = screen.getByRole('radiogroup', { name: 'Підкладка' });
    expect([...g.querySelectorAll('label')].map((l) => l.textContent)).toEqual(['Без', 'Рельєф', 'Супутник', 'Своя карта']);
    expect(screen.getByRole('radio', { name: 'Без' })).toHaveProperty('checked', true);
  });
  it('вибір зберігається в браузері й підхоплюється після перезавантаження', () => {
    const { unmount } = show(); openMenu();
    fireEvent.click(screen.getByRole('radio', { name: 'Рельєф' }));
    expect(JSON.parse(localStorage.getItem(BASE_KEY) ?? '{}').base).toBe('relief');
    unmount(); resetBasemap();
    show(); openMenu();
    expect(screen.getByRole('radio', { name: 'Рельєф' })).toHaveProperty('checked', true);
  });
  it('mapwrap знає обрану підкладку (чужу «Свою карту» ховаємо, коли обрано іншу)', () => {
    const { container } = show(); openMenu();
    fireEvent.click(screen.getByRole('radio', { name: 'Супутник' }));
    expect(container.querySelector<HTMLElement>('.mapwrap')?.dataset.base).toBe('satellite');
  });
});

// Замість Overlay (F0): та сама кнопка .ovbtn, що відкриває/закриває форму прив'язки.
function withOverlay() {
  const clicks: boolean[] = [];
  const Ov = () => {
    const [open, setOpen] = useState(false);
    return <button type="button" className="ovbtn" aria-expanded={open} onClick={() => { clicks.push(!open); setOpen(!open); }}>▦</button>;
  };
  const r = render(<div className="mapwrap"><Ov /><Basemap /></div>);
  return { ...r, clicks };
}

describe('Given одна кнопка «Підкладка» (issue #130)', () => {
  it('кнопка «Підкладка» відкриває саме вибір, а пункту «Підкладка карти» більше немає', () => {
    show();
    expect(screen.queryByRole('button', { name: 'Підкладка карти' })).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    openMenu();
    expect(screen.getByRole('radiogroup', { name: 'Підкладка' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Підкладка' }).getAttribute('aria-expanded')).toBe('true');
  });
  it('OK закриває вікно', () => {
    show(); openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
  it('Esc закриває вікно', () => {
    show(); openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
  it('клік поза вікном закриває, клік усередині — ні', () => {
    const { container } = show(); openMenu();
    fireEvent.pointerDown(screen.getByRole('radio', { name: 'Рельєф' }));
    expect(screen.queryByRole('radiogroup')).not.toBeNull();
    fireEvent.pointerDown(container.querySelector('.mapwrap')!);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
  it('форма прив\'язки не відкривається з кнопкою, а лише після вибору «Своя карта»', () => {
    const { clicks } = withOverlay(); openMenu();
    expect(clicks).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: 'Рельєф' }));
    expect(clicks).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: 'Своя карта' }));
    expect(clicks).toEqual([true]);
    // Вибір закривається, щоб не лежати поверх форми.
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
  it('відкриття вибору закриває форму; «Файл і прив’язка» повертає її лише для «Своєї карти»', () => {
    const { clicks } = withOverlay(); openMenu();
    fireEvent.click(screen.getByRole('radio', { name: 'Своя карта' }));
    openMenu();
    expect(clicks).toEqual([true, false]);
    fireEvent.click(screen.getByRole('button', { name: 'Файл і прив’язка' }));
    expect(clicks).toEqual([true, false, true]);
    openMenu();
    expect(clicks).toEqual([true, false, true, false]);
    fireEvent.click(screen.getByRole('radio', { name: 'Без' }));
    expect(clicks).toEqual([true, false, true, false]);
    expect(screen.queryByRole('button', { name: 'Файл і прив’язка' })).toBeNull();
  });
});

describe('Given рельєф чи супутник (AC2)', () => {
  it('повзунок прозорості погоди є лише для них і зберігається', () => {
    show(); openMenu();
    expect(screen.queryByRole('slider')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Рельєф' }));
    const sl = screen.getByRole('slider', { name: 'Прозорість погоди' });
    fireEvent.change(sl, { target: { value: '70' } });
    expect(JSON.parse(localStorage.getItem(BASE_KEY) ?? '{}').wxTransp).toBe(70);
  });
  it('canvas підкладки під полем не перехоплює кліки й прихований від читачів екрана', () => {
    const { container } = show();
    const cv = container.querySelector('canvas.basemap');
    expect(cv?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Given обрана підкладка (AC4)', () => {
  it('атрибуція в куті карти змінюється з вибором', () => {
    const { container } = show(); openMenu();
    const attr = () => container.querySelector('.baseattr')?.textContent ?? '';
    expect(attr()).toBe('Ріки й озера: Natural Earth');
    fireEvent.click(screen.getByRole('radio', { name: 'Супутник' }));
    expect(attr()).toMatch(/Sentinel-2 cloudless by EOX/);
  });
});

describe('Given офлайн і OPSEC (AC5)', () => {
  it('зображення — лише однакові для всіх статичні файли, без координат у запиті', () => {
    show(); openMenu();
    fireEvent.click(screen.getByRole('radio', { name: 'Рельєф' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Супутник' }));
    expect(new Set(imgs)).toEqual(new Set(['./data/static/relief.png', './data/static/satellite.jpg']));
  });
});

describe('Given ріки й озера (AC3, AC5)', () => {
  it('water.json — один статичний файл, читається раз', async () => {
    const { loadWater } = await import('./basemapStore');
    const urls: string[] = [];
    const fake = (u: string) => { urls.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [{ geometry: { type: 'LineString', coordinates: [[30, 50], [31, 50]] } }] }) } as Response); };
    expect(await loadWater(fake)).toEqual([[[30, 50], [31, 50]]]);
    expect(await loadWater(fake)).toHaveLength(1);
    expect(urls).toEqual(['./data/static/water.json']);
  });
});

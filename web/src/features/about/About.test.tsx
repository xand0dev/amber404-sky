// Issue #173 AC1–AC3: «⋯» → «Про AMBER Sky» — діалог з розділами, фокус, Esc, обидві мови без змішування.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { About } from './About';
import { LANG_KEY, LangProvider } from '../../app/lang';
import { MapFrame } from '../../ui/MapFrame';

beforeEach(() => { localStorage.clear(); localStorage.setItem(LANG_KEY, 'uk'); });
afterEach(cleanup);

const view = () => render(<LangProvider><MapFrame><canvas className="map" /><About /></MapFrame></LangProvider>);
const dialog = () => screen.queryByRole('dialog');
const openUk = () => {
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Ще інструменти' }));
  fireEvent.click(screen.getByRole('button', { name: 'Про AMBER Sky' }));
  return dialog()!;
};

describe('Given сайт відкрито', () => {
  it('Then діалогу немає, доки не обрано пункт меню', () => {
    view();
    expect(dialog()).toBeNull();
  });

  it('AC1: When «⋯» → «Про AMBER Sky» Then діалог aria-modal з заголовком і фокусом усередині', () => {
    const d = openUk();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { level: 2, name: 'Про AMBER Sky' })).toBeTruthy();
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it('AC1: розділи — для кого, вердикт, космічні дані ЄС, приватність, джерела, команда', () => {
    openUk();
    const h3 = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(h3).toEqual(['Для кого', 'Як рахується вердикт', 'Космічні дані ЄС', 'Приватність', 'Джерела й ліцензії', 'Команда']);
    const d = dialog()!;
    for (const s of ['ДСНС', 'розмінування', 'агро', 'лише погода й готовність до вильоту', 'не гарантія безпеки',
      'PDOP', 'ERA5', 'Copernicus DEM', 'Sentinel-2', 'статичних файлів', 'GPS', 'лише за вашим вибором',
      'AMBER//404', 'CASSINI Hackathon']) expect(d.textContent).toContain(s);
  });

  it('AC1: космічні дані ЄС — 4 позначки-текст з посиланнями, що відкриваються в новій вкладці', () => {
    openUk();
    const eu = screen.getByRole('list', { name: 'Космічні дані ЄС' });
    const links = [...eu.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Galileo', 'Copernicus ERA5', 'Copernicus DEM', 'Sentinel-2']);
    for (const a of links) {
      expect(a.getAttribute('href')).toMatch(/^https:\/\//);
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });

  it('AC1: джерела з ліцензіями (з docs/SOURCES.md) і посилання на репозиторій', () => {
    openUk();
    const d = dialog()!;
    for (const s of ['Open-Meteo', 'CC BY 4.0', 'NOAA', 'Natural Earth', 'CC BY-NC-SA 4.0', 'OpenStreetMap', 'ODbL'])
      expect(d.textContent).toContain(s);
    const repo = screen.getByRole('link', { name: /github\.com\/xand0dev\/amber404-sky/ });
    expect(repo.getAttribute('href')).toBe('https://github.com/xand0dev/amber404-sky');
  });

  it('AC3: «Закрити» закриває й повертає фокус на кнопку «⋯»', () => {
    view();
    const more = screen.getByRole('button', { name: 'Ще інструменти' });
    fireEvent.click(more);
    const item = screen.getByRole('button', { name: 'Про AMBER Sky' });
    item.focus();
    fireEvent.click(item);
    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('AC3: Esc закриває', () => {
    openUk();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).toBeNull();
  });

  it('AC3: Tab з останнього елемента повертає на перший, Shift+Tab — навпаки (фокус-пастка)', () => {
    const d = openUk();
    const f = [...d.querySelectorAll<HTMLElement>('button, a[href]')];
    f[f.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(f[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(f[f.length - 1]);
  });
});

describe('AC2–AC3: обидві мови без змішування', () => {
  it('uk: немає англійських службових слів інтерфейсу', () => {
    const d = openUk();
    for (const s of ['About', 'Close', 'Who it is for', 'Privacy', 'Team', 'not a safety guarantee']) expect(d.textContent).not.toContain(s);
  });

  it('en: той самий зміст англійською і без кирилиці', () => {
    localStorage.setItem(LANG_KEY, 'en');
    view();
    fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'About AMBER Sky' }));
    const d = dialog()!;
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual(['Who it is for', 'How the verdict works', 'EU space data', 'Privacy', 'Sources and licences', 'Team']);
    for (const s of ['SES', 'demining', 'not a safety guarantee', 'PDOP', 'Sentinel-2', 'CASSINI Hackathon']) expect(d.textContent).toContain(s);
    expect(d.textContent).not.toMatch(/[А-Яа-яЇїІіЄєҐґ]/);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});

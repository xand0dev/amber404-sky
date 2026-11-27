import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Saved } from './Saved';
import { addSaved, kyivStamp, loadSaved, MAX_SAVED, persist, removeSaved, reportText, SAVED_KEY, type SavedWx } from './savedStore';

const E = (i: number, extra: Partial<SavedWx> = {}): SavedWx => ({
  id: `e${i}`, savedAt: '2026-11-28T09:00:00Z', place: 'Київ (50.450, 30.520)', lat: 50.45, lon: 30.52, altM: 120,
  time: '2026-11-28T08:00:00Z', drone: 'FPV 7″', ws: 6.24, dir: 330, g: 9.1, cb: 312.5, t: 2.5,
  level: 'CAUTION', reasons: ['Пориви 11.0 м/с — понад 80% ліміту'], window: 'сб 10:00 – 14:59 · 5 год',
  source: 'Open-Meteo', generatedAt: '2026-11-28T07:05:00Z', mock: false, ...extra,
});

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('F4-AC4: список збереженого', () => {
  it('новий запис першим, не більше 12 — найстаріший випадає', () => {
    let l: SavedWx[] = [];
    for (let i = 0; i < 14; i++) l = addSaved(l, E(i));
    expect(l).toHaveLength(MAX_SAVED);
    expect(l[0].id).toBe('e13');
    expect(l.map((x) => x.id)).not.toContain('e0');
    expect(l.map((x) => x.id)).not.toContain('e1');
  });
  it('той самий id не дублюється', () => {
    expect(addSaved([E(1)], E(1))).toHaveLength(1);
  });
  it('видалення', () => {
    expect(removeSaved([E(1), E(2)], 'e1').map((x) => x.id)).toEqual(['e2']);
  });
  it('лише localStorage: зберегти й прочитати; зіпсований JSON → порожньо', () => {
    persist([E(1)]);
    expect(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')).toHaveLength(1);
    expect(loadSaved()[0].id).toBe('e1');
    localStorage.setItem(SAVED_KEY, '{oops');
    expect(loadSaved()).toEqual([]);
  });
  it('без доступу до сховища — не падає', () => {
    const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
    expect(loadSaved(bad)).toEqual([]);
    expect(() => persist([E(1)], bad)).not.toThrow();
  });
});

describe('F4-AC4: текст звіту', () => {
  it('місце, час Київ, висота, дрон, вітер, хмари, вердикт, вікно, джерело', () => {
    const txt = reportText(E(1), 'uk', kyivStamp('2026-11-28T08:00:00Z'));
    expect(txt.split('\n')).toEqual([
      'AMBER Sky · погода для дрона',
      'Точка: Київ (50.450, 30.520)',
      'Час: 2026-11-28 10:00 (Київ) · висота 120 м · FPV 7″',
      'Вітер 6.2 м/с з 330° · пориви 9.1 м/с',
      'Хмари від 313 м · 2.5 °C',
      'Вердикт: ОБЕРЕЖНО — Пориви 11.0 м/с — понад 80% ліміту',
      'Вікно: сб 10:00 – 14:59 · 5 год',
      'Демонстраційна модель, не офіційний прогноз · Open-Meteo · прогноз 2026-11-28T07:05:00Z',
    ]);
  });
  it('MOCK позначено в заголовку; немає даних → «—»', () => {
    const txt = reportText(E(1, { mock: true, ws: null, dir: null, level: 'NO-DATA', reasons: ['Немає даних про вітер'] }), 'uk', 'x');
    expect(txt).toContain('AMBER Sky · погода для дрона · MOCK');
    expect(txt).toContain('Вітер — м/с з —°');
    expect(txt).toContain('Вердикт: НЕМАЄ ДАНИХ');
  });
  it('англійською', () => {
    expect(reportText(E(1), 'en', 'x')).toContain('Verdict: CAUTION');
  });
});

describe('F4-AC4: кнопки на екрані', () => {
  it('Given «Зберегти погоду» When клік Then запис у списку і в localStorage', () => {
    let i = 0;
    render(<Saved current={() => E(i++)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти погоду' }));
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти погоду' }));
    expect(screen.getByTestId('saved-list').querySelectorAll('li')).toHaveLength(2);
    expect(loadSaved()).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /Видалити/ })[0]);
    expect(loadSaved()).toHaveLength(1);
  });
  it('Given «Копіювати звіт» When клік Then текст звіту в буфері', async () => {
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    render(<Saved current={() => E(1)} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Копіювати звіт' })); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(String((write.mock.calls[0] as unknown[])[0])).toContain('Точка: Київ (50.450, 30.520)');
    expect(screen.getByRole('status').textContent).toBe('Звіт скопійовано');
  });
  it('Given буфер недоступний Then повідомлення і текст для ручного копіювання', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<Saved current={() => E(1)} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Копіювати звіт' })); });
    expect(screen.getByRole('status').textContent).toMatch(/Не вдалося скопіювати/);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('AMBER Sky');
  });
});

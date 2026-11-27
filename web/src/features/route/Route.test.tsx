import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouteView } from './Route';
import { routeSummary, batteryCheck } from './routeLogic';

const A = { lat: 50, lon: 30 }, B = { lat: 50.1, lon: 30 };
afterEach(cleanup);

function view(extra: Partial<Parameters<typeof RouteView>[0]> = {}) {
  const sum = routeSummary(A, B, 15, 100, () => [0, 5], () => false);
  return render(
    <RouteView a={A} b={B} altM={100} summary={sum} battery={batteryCheck(sum.route, 480)} usableS={480} why="паспорт 10 хв"
      onSetA={() => {}} onSetB={() => {}} onClear={() => {}} {...extra} />,
  );
}

describe('F4-AC3: режим маршруту на екрані', () => {
  it('без точок — підказка поставити A і B', () => {
    render(<RouteView a={null} b={null} altM={100} summary={null} battery={null} usableS={480} why="" onSetA={() => {}} onSetB={() => {}} onClear={() => {}} />);
    expect(screen.getByText(/Поставте A і B/)).toBeTruthy();
  });
  it('розріз: 40 стовпців, попутний і зустрічний', () => {
    view();
    expect(screen.getAllByTestId('cut-bar')).toHaveLength(40);
    expect(screen.getByLabelText(/Розріз попутного й зустрічного вітру/)).toBeTruthy();
  });
  it('час туди й назад, найсильніший зустрічний і боковий, найкраща висота, батарея', () => {
    view();
    expect(screen.getByText('Туди').parentElement?.textContent).toMatch(/хв/);
    expect(screen.getByText('Назад').parentElement?.textContent).toMatch(/хв/);
    expect(screen.getByText(/Зустрічний макс/).parentElement?.textContent).toContain('5.0 м/с');
    expect(screen.getByText(/Боковий макс/).parentElement?.textContent).toContain('0.0 м/с');
    expect(screen.getByText(/Найкраща висота/).parentElement?.textContent).toMatch(/\d+ м/);
    expect(screen.getByTestId('route-battery').textContent).toMatch(/GO|CAUTION|NO-GO/);
  });
  it('кнопки A, B і скинути', () => {
    let n = 0;
    view({ onSetA: () => n++, onSetB: () => n++, onClear: () => n++ });
    fireEvent.click(screen.getByRole('button', { name: /A = точка/ }));
    fireEvent.click(screen.getByRole('button', { name: /B = точка/ }));
    fireEvent.click(screen.getByRole('button', { name: /Скинути/ }));
    expect(n).toBe(3);
  });
});

describe('uk/en: маршрут англійською (SPEC §11 — англійські рядки інтерфейсу)', () => {
  it('Given EN Then заголовок, кнопки, підказка англійською', () => {
    render(<RouteView a={null} b={null} altM={100} summary={null} battery={null} usableS={480} why="" lang="en" onSetA={() => {}} onSetB={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('region', { name: 'Route A → B' })).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toBe('Route A → B · 100 m');
    for (const n of ['A = point', 'B = point', 'Reset']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.getByText(/Set A and B/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
  it('Given EN і маршрут Then значення, розріз і батарея англійською, без кирилиці', () => {
    const sum = routeSummary(A, B, 15, 100, () => [0, 5], () => false);
    render(<RouteView a={A} b={B} altM={100} summary={sum} battery={batteryCheck(sum.route, 480, false, 'en')} usableS={480} why="datasheet 10 min" lang="en"
      onSetA={() => {}} onSetB={() => {}} onClear={() => {}} />);
    expect(screen.getByText('Out').parentElement?.textContent).toMatch(/min$/);
    expect(screen.getByText('Max headwind').parentElement?.textContent).toContain('5.0 m/s');
    expect(screen.getByText('Distance').parentElement?.textContent).toMatch(/km/);
    expect(screen.getByLabelText(/Tailwind and headwind along the route/)).toBeTruthy();
    expect(screen.getByTestId('route-battery').textContent).toMatch(/^(GO|CAUTION|NO-GO) · Out/);
    expect(document.body.textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
  it('батарея: усі причини обома мовами, українська — як раніше', () => {
    const r = (there: number | null, back: number | null) => ({ distM: 1, bearing: 0, there: { timeS: there, maxHead: 0, maxCross: 0 }, back: { timeS: back, maxHead: 0, maxCross: 0 }, totalS: there != null && back != null ? there + back : null });
    expect(batteryCheck(r(100, 100), 480).reasons).toEqual(['Туди й назад 3.3 хв ≤ 8.0 хв (T×0.8)']);
    expect(batteryCheck(r(100, 100), 480, false, 'en').reasons).toEqual(['Out and back 3.3 min ≤ 8.0 min (T×0.8)']);
    expect(batteryCheck(r(600, 100), 480, false, 'en')).toEqual({ level: 'NO-GO', reasons: ['Out 10.0 min > 8.0 min (T×0.8)'] });
    expect(batteryCheck(r(300, 300), 480, false, 'en').reasons[0]).toBe('Out and back 10.0 min > 8.0 min (T×0.8) — not enough to return');
    expect(batteryCheck(r(null, null), 480, false, 'en').reasons[0]).toBe("Won't reach B: wind ≥ drone speed");
    expect(batteryCheck(r(100, null), 480, false, 'en').reasons[0]).toBe("Won't make it back: headwind ≥ drone speed");
    expect(batteryCheck(r(100, 100), 480, true, 'en').reasons[0]).toBe('No wind data along the route');
  });
});

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
      onPick={() => {}} onClear={() => {}} {...extra} />,
  );
}

describe('F4-AC3: режим маршруту на екрані', () => {
  it('без B — пояснення, навіщо маршрут, і одна кнопка «Обрати B на карті»', () => {
    render(<RouteView a={A} b={null} altM={100} summary={null} battery={null} usableS={480} why="" onPick={() => {}} onClear={() => {}} />);
    expect(screen.getByText(/вистачить батареї/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Обрати B на карті' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Скинути/ })).toBeNull();
    expect(screen.queryAllByTestId('cut-bar')).toHaveLength(0);
  });
  it('режим вибору — підказка тапнути карту й «Скасувати»', () => {
    let n = 0;
    render(<RouteView a={A} b={null} altM={100} summary={null} battery={null} usableS={480} why="" picking onPick={() => {}} onCancel={() => n++} onClear={() => {}} />);
    expect(screen.getByRole('status').textContent).toMatch(/Торкніться карти/);
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(n).toBe(1);
  });
  it('A = B (ближче 300 м) — без розрізу й вердикту, просимо точку далі', () => {
    render(<RouteView a={A} b={{ lat: 50.001, lon: 30 }} altM={100} summary={null} battery={null} usableS={480} why="" onPick={() => {}} onClear={() => {}} />);
    expect(screen.getByText(/ближче ніж 300 м/)).toBeTruthy();
    expect(screen.queryAllByTestId('cut-bar')).toHaveLength(0);
    expect(screen.queryByTestId('route-battery')).toBeNull();
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
  it('з B — «Змінити B» і «Скинути»', () => {
    let n = 0;
    view({ onPick: () => n++, onClear: () => n++ });
    fireEvent.click(screen.getByRole('button', { name: 'Змінити B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Скинути' }));
    expect(n).toBe(2);
  });
});

describe('uk/en: маршрут англійською (SPEC §11 — англійські рядки інтерфейсу)', () => {
  it('Given EN Then заголовок, кнопка, пояснення англійською', () => {
    render(<RouteView a={A} b={null} altM={100} summary={null} battery={null} usableS={480} why="" lang="en" onPick={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('region', { name: 'Route A → B' })).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toBe('Route A → B · 100 m');
    expect(screen.getByRole('button', { name: 'Pick B on the map' })).toBeTruthy();
    expect(screen.getByText(/battery/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[А-Яа-яІіЇїЄє]/);
  });
  it('Given EN і маршрут Then значення, розріз і батарея англійською, без кирилиці', () => {
    const sum = routeSummary(A, B, 15, 100, () => [0, 5], () => false);
    render(<RouteView a={A} b={B} altM={100} summary={sum} battery={batteryCheck(sum.route, 480, false, 'en')} usableS={480} why="datasheet 10 min" lang="en"
      onPick={() => {}} onClear={() => {}} />);
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

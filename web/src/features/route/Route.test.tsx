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

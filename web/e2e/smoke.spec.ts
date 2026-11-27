// Smoke сайту на mocks (issue #34): плашка вердикту, карта, 48 годин, панель, клік по карті, консоль без помилок.
import { expect, test, type Page } from '@playwright/test';

// Збирає помилки консолі й невловлені винятки сторінки.
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('сайт на mocks: вердикт, карта, 48 годин, панель і клік по карті', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');

  const status = page.locator('header.status');
  await expect(status).toBeVisible();
  await expect(status.locator('.word')).toHaveText(/МОЖНА|ОБЕРЕЖНО|НЕ МОЖНА|НЕМАЄ ДАНИХ/);
  await expect(status.getByText('MOCK', { exact: true })).toBeVisible();

  const map = page.locator('canvas.map');
  await expect(map).toBeVisible();

  await expect(page.getByRole('navigation', { name: 'Година прогнозу' }).getByRole('button')).toHaveCount(48);

  const panel = page.getByRole('region', { name: 'Точка' });
  await expect(panel).toBeVisible();

  // Координати точки в панелі: «50.450, 30.520 · …» (у маршруту F4 свій рядок «A: … · B: …»).
  const coord = panel.locator('p.coord').filter({ hasText: /^-?\d+\.\d{3}, -?\d+\.\d{3}/ });
  await expect(coord).toHaveText(/^50\.450, 30\.520/);
  const before = await coord.textContent();
  // Центр карти — середина рамки України (≈ 48.25° пн. ш.) за будь-якого розміру, тобто не стартовий Київ.
  await map.click();
  await expect(coord).not.toHaveText(before ?? '');

  expect(errors).toEqual([]);
});


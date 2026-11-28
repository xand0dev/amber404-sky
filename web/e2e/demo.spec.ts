// Issue #169 AC5: «▶ Демо» — тур доходить до кінця на 1280×800 (справжній час, ~30 с); дотик зупиняє; ?demo=1 без координат.
import { expect, test } from '@playwright/test';
import { DEMO_TOTAL_MS } from '../src/core/demo';

const cap = '.demo-cap';

test('?demo=1 → 5 кроків SPEC §3 до кінця, після — керування в людини в тому ж стані', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1280, 'AC5: повний тур — на 1280×800');
  test.setTimeout(DEMO_TOTAL_MS + 60_000);
  await page.goto('./?demo=1');
  const c = page.locator(cap);
  await expect(c).toContainText('1 з 5');
  await expect(c).toContainText('вітер на 120 м');
  await expect(page.getByRole('dialog', { name: 'Як це працює' })).toBeHidden();
  await expect(c).toContainText('Можна летіти', { timeout: 10_000 });
  await expect(c).toContainText('Точка біля Полтави:', { timeout: 10_000 });
  await expect(page.locator('.panel .point h2')).toHaveText('Полтава');
  await expect(c).toContainText('48 год', { timeout: 10_000 });
  await expect(c).toContainText('5 з 5', { timeout: 10_000 });
  await expect(c).toContainText('Galileo');
  await expect(c).toContainText('ERA5');
  await expect(c).toBeHidden({ timeout: 10_000 });
  // Стан лишився: FPV 7″, 50 м, точка біля Полтави.
  await expect(page.locator('.panel select')).toHaveValue('fpv7');
  await expect(page.locator('.panel .point h2')).toHaveText('Полтава');
  await expect(page.locator('.panel .row b')).toHaveText('50 м');
});

test('«⋯» → «▶ Демо»; дотик до карти зупиняє тур', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('amber404.tour', '1'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Ще інструменти' }).click();
  await page.getByRole('button', { name: '▶ Демо' }).click();
  const c = page.locator(cap);
  await expect(c).toContainText('1 з 5');
  await page.locator('canvas.map').click({ position: { x: 20, y: 20 } });
  await expect(c).toBeHidden();
});

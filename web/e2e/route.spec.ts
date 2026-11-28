// Маршрут A → B (F4, SPEC §7.5a): A — обрана точка, «Обрати B на карті» → тап по карті → лінія на карті й розрахунок у панелі.
import { expect, test } from '@playwright/test';

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

for (const [w, h] of [[400, 800], [1280, 800]]) {
  test(`${w}×${h}: обрати B тапом по карті → розріз, час і батарея; скинути`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('./');
    const route = page.getByRole('region', { name: /Маршрут/ });
    await expect(route.getByText(/вистачить батареї/)).toBeVisible();
    await expect(route.getByTestId('cut-bar')).toHaveCount(0);

    await route.getByRole('button', { name: 'Обрати B на карті' }).click();
    const pick = page.getByTestId('route-pick');
    await expect(pick.getByRole('status')).toContainText('Торкніться карти');
    // A за замовчуванням — Київ; тап у центр карти — значно далі за 300 м.
    await pick.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600); // плавна прокрутка до карти на телефоні
    const b = await pick.boundingBox();
    if (!b) throw new Error('немає шару вибору');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2 + 20);

    await expect(pick).toHaveCount(0);
    await expect(route.getByTestId('cut-bar')).toHaveCount(40);
    await expect(route.getByTestId('route-battery')).toContainText(/GO|CAUTION|NO-GO/);
    await expect(route.getByText('Відстань').locator('..')).toContainText('км');

    await route.getByRole('button', { name: 'Скинути' }).click();
    await expect(route.getByTestId('cut-bar')).toHaveCount(0);
    await expect(route.getByRole('button', { name: 'Обрати B на карті' })).toBeVisible();
  });
}

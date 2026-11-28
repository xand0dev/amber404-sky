// Смуга 48 год (issue #172, F3): день/ніч у точці, лінія «зараз», скраб пальцем/мишею, ←/→, рамка вікна. Телефон 400×800.
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 400, height: 800 }, hasTouch: true });

test('400×800: ніч затемнена з ☀/☾, «зараз» видно, перетягування й ←/→ міняють годину, без горизонтального скролу', async ({ page, request }) => {
  // Годинник — на 20 хв після першої години mock-прогнозу, щоб «зараз» потрапило в смугу незалежно від дати збірки.
  const meta = await (await request.get('./data/meta.json')).json();
  await page.clock.setFixedTime(Date.parse(meta.times[0]) + 20 * 60_000);
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Година прогнозу' });
  const hour = (h: number) => nav.locator(`[data-hour="${h}"]`);
  const sel = () => nav.locator('[aria-pressed="true"]').getAttribute('data-hour');

  // AC1: 48 год завжди містять ніч у Києві (точка за замовчуванням) — затемнені години й позначки сходу/заходу.
  expect(await nav.locator('button.nt').count()).toBeGreaterThan(8);
  await expect(page.getByTestId('sun-edge').filter({ hasText: '☀' }).first()).toBeAttached();
  await expect(page.getByTestId('sun-edge').filter({ hasText: '☾' }).first()).toBeAttached();
  // AC2: лінія «зараз» на першій годині, підписи днів.
  const now = page.getByTestId('now-line');
  await expect(now).toBeVisible();
  const [nb, hb] = [await now.boundingBox(), await hour(0).boundingBox()];
  expect(nb!.x).toBeGreaterThan(hb!.x);
  expect(nb!.x).toBeLessThan(hb!.x + hb!.width / 2);
  expect(await page.getByTestId('day-mark').count()).toBeGreaterThanOrEqual(2);

  // AC3: перетягування з години 1 на 3 години вправо.
  const b1 = (await hour(1).boundingBox())!;
  const y = b1.y + b1.height / 2;
  await page.mouse.move(b1.x + b1.width / 2, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(b1.x + b1.width / 2 + i * 16, y);
  await page.mouse.up();
  expect(await sel()).toBe('4');
  // ←/→ як раніше.
  await hour(4).focus();
  await page.keyboard.press('ArrowRight');
  expect(await sel()).toBe('5');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await sel()).toBe('3');

  // AC4: якщо в mock є вікно — рамка в межах смуги й підпис «вікно».
  const win = page.getByTestId('win');
  if (await win.count()) await expect(win).toHaveText('вікно');

  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(sw).toBeLessThanOrEqual(400);
});

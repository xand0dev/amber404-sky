// Issue #166: заставка й онбординг першого відкриття. AC4: перший візит → онбординг; після «Пропустити»/«Почати» —
// не з'являється; з «⋯» — знову; заставка — лише при повільних даних. Картки не перекривають підсвічене місце (AC3).
import { expect, test, type Page } from '@playwright/test';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Як це працює' });

/** Картка й підсвічене місце не перетинаються (рамка анімується, тож міряємо саму ціль). */
async function noOverlap(page: Page) {
  const c = (await page.locator('.tour-card').boundingBox())!;
  const s = (await page.locator('.tour-on').boundingBox())!;
  const hit = c.x < s.x + s.width && s.x < c.x + c.width && c.y < s.y + s.height && s.y < c.y + c.height;
  expect(hit, JSON.stringify({ c, s })).toBe(false);
  const vp = page.viewportSize()!;
  expect(c.y + c.height).toBeLessThanOrEqual(vp.height);
  expect(c.x + c.width).toBeLessThanOrEqual(vp.width);
}

test('перший візит → 3 картки з підсвіткою, «Почати»; після перезавантаження — немає; з «⋯» — знову', async ({ page }) => {
  await page.goto('./');
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d).toHaveAttribute('aria-modal', 'true');
  await expect(d).toContainText('Вітер по висотах над усією Україною');
  await expect(page.locator('.mapwrap')).toHaveClass(/tour-on/);
  if (page.viewportSize()!.width <= 400) await noOverlap(page);

  await page.getByRole('button', { name: 'Далі' }).click();
  await expect(d).toContainText('Обери дрон і висоту');
  await expect(page.locator('.panel .row')).toHaveClass(/tour-on/);
  if (page.viewportSize()!.width <= 400) await noOverlap(page);

  await page.getByRole('button', { name: 'Далі' }).click();
  await expect(d).toContainText('Тапни будь-яку точку або ⌖');
  await expect(page.locator('.locbtn')).toHaveClass(/tour-on/);
  if (page.viewportSize()!.width <= 400) await noOverlap(page);

  await page.getByRole('button', { name: 'Почати' }).click();
  await expect(d).toBeHidden();

  await page.reload();
  await expect(page.locator('canvas.map')).toBeVisible();
  await expect(d).toBeHidden();

  await page.getByRole('button', { name: 'Ще інструменти' }).click();
  await page.getByRole('button', { name: 'Як це працює' }).click();
  await expect(d).toBeVisible();
  await expect(d).toContainText('1 з 3');
});

test('«Пропустити» і Esc закривають назавжди; клавіатура: фокус у діалозі й по колу', async ({ page }) => {
  await page.goto('./');
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(page.getByRole('button', { name: 'Далі' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Пропустити' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Далі' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(d).toContainText('2 з 3');
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  await page.reload();
  await expect(page.locator('canvas.map')).toBeVisible();
  await expect(d).toBeHidden();

  // «Пропустити» — у новому браузері.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(d).toBeVisible();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect(d).toBeHidden();
  await page.reload();
  await expect(page.locator('canvas.map')).toBeVisible();
  await expect(d).toBeHidden();
});

test.describe('заставка', () => {
  test.beforeEach(({ page }) => page.addInitScript(() => {
    localStorage.setItem('amber404.tour', '1');
    // Чи з'являлась заставка хоч на мить і коли з'явилась карта (від виконання модуля застосунку ≈ DOMContentLoaded).
    const w = window as unknown as { splashSeen?: boolean; t0?: number; tMap?: number };
    document.addEventListener('DOMContentLoaded', () => { w.t0 = performance.now(); });
    new MutationObserver(() => {
      if (document.querySelector('.splash')) w.splashSeen = true;
      if (w.tMap == null && document.querySelector('.shell')) w.tMap = performance.now();
    }).observe(document, { childList: true, subtree: true });
  }));

  test('повільні дані → логотип і «Завантажуємо прогноз…», потім зникає над готовою картою', async ({ page }) => {
    await page.route('**/data/meta.json', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
    await page.goto('./');
    const sp = page.getByRole('status').filter({ hasText: 'Завантажуємо прогноз…' });
    await expect(sp).toBeVisible();
    await expect(sp).toContainText('AMBER Sky');
    await expect(page.locator('canvas.map')).toBeVisible();
    await expect(page.locator('.splash')).toHaveCount(0);
  });

  test('швидкі дані (< 300 мс) → заставки немає', async ({ page }) => {
    // Дані — з пам'яті, без мережі (зокрема години профілю profile/hNN.json, #165); решта часу — розбір JSON.
    const cache = new Map<string, { body: Buffer; type: string }>();
    await page.route('**/data/**/*.json', async (r) => {
      const u = r.request().url();
      if (!cache.has(u)) { const res = await r.fetch(); cache.set(u, { body: await res.body(), type: res.headers()['content-type'] ?? 'application/json' }); }
      const c = cache.get(u)!;
      await r.fulfill({ body: c.body, contentType: c.type });
    });
    await page.goto('./');
    await expect(page.locator('canvas.map')).toBeVisible();
    await page.reload(); // тепер дані вже в пам'яті тесту
    await expect(page.locator('canvas.map')).toBeVisible();
    const r = await page.evaluate(() => { const x = window as unknown as { splashSeen?: boolean; t0?: number; tMap?: number }; return { seen: !!x.splashSeen, ms: (x.tMap ?? 0) - (x.t0 ?? 0) }; });
    // Межа з запасом: якщо машина повільна й дані йшли довше — заставка чесно мала показатись, тоді перевіряти нічого.
    test.skip(r.ms >= 250, `дані йшли ${Math.round(r.ms)} мс — це вже не «швидко»`);
    expect(r.seen).toBe(false);
  });
});

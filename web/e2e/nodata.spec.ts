// Issue #140: місця без даних (Open-Meteo 429 на південних пакетах) — штрихування на карті й «немає даних» у легенді.
import { expect, test, type Page } from '@playwright/test';

// Онбординг першого відкриття (#166) лягає поверх карти — у цих тестах його вже пройдено.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

/** Підміняє profile.json: рядки сітки r ≥ 12 (46.5° і південніше) — null у всіх полях. */
async function southless(page: Page) {
  await page.route('**/data/profile.json', async (route) => {
    const res = await route.fetch();
    const p = await res.json();
    const nc = 38;
    const cut = (row: (number | null)[]) => row.map((v, i) => (Math.floor(i / nc) >= 12 ? null : v));
    for (const k of ['spd', 'dir']) p[k] = p[k].map((l: (number | null)[][]) => l.map(cut));
    for (const k of ['gust', 'temp', 'precip', 'rh', 'vis']) p[k] = p[k].map(cut);
    await route.fulfill({ response: res, json: p });
  });
}

async function open(page: Page, night = false) {
  await page.addInitScript((n) => localStorage.setItem('amber404.night', n ? '1' : '0'), night);
  await page.goto('./');
  await expect(page.locator('canvas.map')).toBeVisible();
  await page.waitForTimeout(400);
}

/** Частка «смуг» у прямокутнику 44.3–45.7° пн. ш., 22.5–26° сх. д. (без міст і підписів): пікселі, помітно яскравіші
 *  за найтемніший у прямокутнику. Гладке поле дає мало таких пікселів, штрихування — багато. */
async function hatchShare(page: Page): Promise<number> {
  return page.locator('canvas.map').evaluate((cv: HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] }) => {
    const dpr = cv.width / cv.clientWidth, ctx = cv.getContext('2d')!;
    const lum: number[] = [];
    for (let y = 0; y < cv.clientHeight; y += 1) for (let x = 0; x < cv.clientWidth; x += 3) {
      const [lat, lon] = cv.unproject!(x, y);
      if (lat < 44.3 || lat > 45.7 || lon < 22.5 || lon > 26) continue;
      const [r, g, b] = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
      lum.push(0.3 * r + 0.59 * g + 0.11 * b);
    }
    if (!lum.length) return 0;
    const min = Math.min(...lum);
    return lum.filter((l) => l - min > 40).length / lum.length;
  });
}

test.describe('400×800', () => {
  test.use({ viewport: { width: 400, height: 800 }, hasTouch: true });

  test('південь без даних: штрихування на карті й «немає даних» у легенді', async ({ page }) => {
    await southless(page);
    await open(page);
    await expect(page.locator('.legend .lg-nodata')).toHaveText('немає даних');
    expect(await hatchShare(page)).toBeGreaterThan(0.2); // ~0.4 зі штрихуванням
  });

  test('уночі штрихування теж є (червоне)', async ({ page }) => {
    await southless(page);
    await open(page, true);
    expect(await hatchShare(page)).toBeGreaterThan(0.2); // ~0.4 зі штрихуванням
  });

  test('повні дані: без штрихування й без пункту в легенді', async ({ page }) => {
    await open(page);
    await expect(page.locator('.legend .lg-nodata')).toHaveCount(0);
    expect(await hatchShare(page)).toBeLessThan(0.1); // ~0.03 — кордони й ріки
  });
});

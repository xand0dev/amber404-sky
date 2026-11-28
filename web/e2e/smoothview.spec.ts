// Issue #174 (F0): плавні переходи вигляду, щипок і подвійний тап на телефоні.
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

type MapCanvas = HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] };
/** Ширина видимої карти в градусах довготи: менше — ближче. */
const spanLon = (page: Page) => page.locator('canvas.map').evaluate((cv: MapCanvas) => cv.unproject!(cv.clientWidth, 0)[1] - cv.unproject!(0, 0)[1]);

async function open(page: Page) {
  await page.goto('./');
  await expect(page.locator('canvas.map')).toBeVisible();
  await expect.poll(() => page.locator('canvas.map').evaluate((cv: MapCanvas) => typeof cv.unproject)).toBe('function');
  return (await page.locator('canvas.map').boundingBox())!;
}

test.describe('телефон', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'дотики — лише в phone-400');

  test('AC2, AC5: щипок двома пальцями наближає карту', async ({ page }) => {
    const m = await open(page);
    const before = await spanLon(page);
    const cdp = await page.context().newCDPSession(page);
    const cx = m.x + m.width / 2, cy = m.y + m.height / 2;
    const pts = (d: number) => [{ x: cx - d, y: cy, id: 0 }, { x: cx + d, y: cy, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(30) });
    for (const d of [45, 60, 75, 90]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Щипок миттєвий: розвели пальці втричі — масштаб ×3, видно втричі вужче.
    await expect.poll(() => spanLon(page)).toBeLessThan(before / 2.5);
  });

  test('AC2: подвійний тап — наближення ×2', async ({ page }) => {
    const m = await open(page);
    const before = await spanLon(page);
    const x = m.x + m.width / 2, y = m.y + m.height / 2;
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    await expect.poll(() => spanLon(page)).toBeCloseTo(before / 2, 2);
  });
});

test('AC1: «+» — плавний перехід, а не стрибок', async ({ page }) => {
  await open(page);
  const before = await spanLon(page);
  // Записуємо ширину карти на кожному кадрі протягом переходу.
  const frames = page.locator('canvas.map').evaluate((cv: MapCanvas) => new Promise<number[]>((done) => {
    const out: number[] = [], t0 = performance.now();
    const f = () => { out.push(cv.unproject!(cv.clientWidth, 0)[1] - cv.unproject!(0, 0)[1]); if (performance.now() - t0 < 600) requestAnimationFrame(f); else done(out); };
    requestAnimationFrame(f);
  }));
  await page.getByRole('button', { name: 'Наблизити' }).click();
  const seen = await frames;
  expect(seen.some((s) => s < before * 0.95 && s > before / 2 * 1.05)).toBe(true);
  await expect.poll(() => spanLon(page)).toBeCloseTo(before / 2, 2);
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('AC4: «+» — одразу, без проміжних кадрів', async ({ page }) => {
    await open(page);
    const before = await spanLon(page);
    await page.getByRole('button', { name: 'Наблизити' }).click();
    await expect.poll(() => spanLon(page), { intervals: [0], timeout: 150 }).toBeCloseTo(before / 2, 2);
  });
});

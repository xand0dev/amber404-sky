// Issue #167: карта-«вау» — рельєф за замовчуванням, віньєтка поза Україною, пульсуюче кільце; знімок 📷 не порожній.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.describe('1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('AC1: без збереженого вибору — Рельєф і прозорість погоди 40 %', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('canvas.basemap[data-drawn="relief"]')).toBeVisible();
    await page.getByRole('toolbar', { name: 'Інструменти карти' }).getByRole('button', { name: 'Підкладка', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Рельєф', exact: true })).toBeChecked();
    await expect(page.getByRole('slider', { name: 'Прозорість погоди' })).toHaveValue('40');
  });

  test('AC2: точка в Польщі темніша за ту саму підкладку в Україні — є віньєтка', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('canvas.basemap[data-drawn="relief"]')).toBeVisible();
    await page.waitForTimeout(300);
    // Віньєтка — напівпрозоре затемнення на canvas.map поверх поля: поза Україною непрозорість canvas більша, ніж у ній.
    const [pl, ua] = await page.locator('canvas.map').evaluate((cv: HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] }) => {
      const ctx = cv.getContext('2d')!, dpr = cv.width / cv.clientWidth;
      const [la0, lo0] = cv.unproject!(0, 0), [la1, lo1] = cv.unproject!(cv.clientWidth, cv.clientHeight);
      /** Медіана альфи в латці 7×7 — тонкі лінії рік і кордонів її не зсувають. */
      const alpha = (lat: number, lon: number) => {
        const x = ((lon - lo0) / (lo1 - lo0)) * cv.clientWidth, y = ((lat - la0) / (la1 - la0)) * cv.clientHeight;
        const d = ctx.getImageData(Math.round(x * dpr) - 3, Math.round(y * dpr) - 3, 7, 7).data;
        const a: number[] = [];
        for (let i = 3; i < d.length; i += 4) a.push(d[i]);
        return a.sort((p, q) => p - q)[a.length >> 1];
      };
      return [alpha(51.25, 22.57), alpha(48.9, 27.3)];
    });
    expect(pl).toBeGreaterThan(ua + 20);
  });

  test('AC4: пульсуюче кільце над обраною точкою', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.pulse .pulse-ring')).toBeAttached();
    await expect(page.locator('.pulse .pulse-ring')).toHaveCSS('animation-name', 'amber-pulse');
  });

  test('AC5: знімок 📷 — PNG не порожній (віньєтка й статичне кільце — на canvas.map, який малює compose.ts)', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('canvas.basemap[data-drawn="relief"]')).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Знімок карти', exact: true }).click()]);
    const png = readFileSync((await dl.path())!);
    expect(png.length).toBeGreaterThan(20_000);
    const stats = await page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = `data:image/png;base64,${b64}`; });
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
      const colors = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 97) colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      return { w: img.width, colors: colors.size };
    }, png.toString('base64'));
    expect(stats.w).toBeGreaterThan(300);
    expect(stats.colors).toBeGreaterThan(200);
  });
});

test.describe('400×800 reduced motion', () => {
  test.use({ viewport: { width: 400, height: 800 }, hasTouch: true });

  test('AC4: reduced-motion — кільце статичне', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await expect(page.locator('.pulse .pulse-ring')).toHaveCSS('animation-name', 'none');
  });
});

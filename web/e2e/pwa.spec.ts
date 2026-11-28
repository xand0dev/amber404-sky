// Issue #170: manifest валідний (поля, розміри картинок) і явний офлайн-індикатор у шапці на прод-збірці.
import { expect, test } from '@playwright/test';

interface Img { src: string; sizes: string; type: string; form_factor?: string }
interface Manifest {
  name: string; short_name: string; start_url: string; scope: string; display: string; theme_color: string; background_color: string;
  icons: Img[]; screenshots: Img[]; shortcuts: { name: string; url: string; icons?: Img[] }[];
}

test('manifest: обов’язкові поля, іконки, знімки й ярлики, розміри картинок як у sizes', async ({ page }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const base = new URL(href ?? '', page.url()).href;
  const res = await page.request.get(base);
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as Manifest;
  expect(m).toMatchObject({ name: 'AMBER Sky', start_url: './', scope: './', display: 'standalone' });
  expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(m.screenshots.map((s) => s.form_factor).sort()).toEqual(['narrow', 'wide']);
  expect(m.shortcuts.map((s) => s.name)).toEqual(['Де я', 'Можна летіти']);
  const imgs = [...m.icons, ...m.screenshots, ...m.shortcuts.flatMap((s) => s.icons ?? [])];
  for (const i of imgs) {
    const url = new URL(i.src, base).href;
    expect((await page.request.get(url)).ok(), url).toBe(true);
    const size = await page.evaluate(async (u) => {
      const im = new Image(); im.src = u; await im.decode();
      return `${im.naturalWidth}x${im.naturalHeight}`;
    }, url);
    expect(size, i.src).toBe(i.sizes);
  }
});

test('офлайн: у шапці «офлайн · дані від HH:MM», мережа повернулась — індикатор зник без перезавантаження', async ({ page, context }) => {
  await page.goto('./');
  const status = page.locator('header.status');
  await expect(status.locator('.word')).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __mark: number }).__mark = 1; });
  await context.setOffline(true);
  const badge = status.getByRole('status');
  await expect(badge).toHaveText(/^офлайн · дані від \d{2}:\d{2}$/);
  await expect(badge).toBeVisible();
  await context.setOffline(false);
  await expect(badge).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(1);
});

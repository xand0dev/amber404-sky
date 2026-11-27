// Шапка й вердикт (issue #87, F3): на телефоні плашка ≤ 120 px, технічне — у «Деталі» й «Джерела».
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
}

for (const [w, h] of [[375, 812], [400, 800]]) {
  test.describe(`${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true });

    test('AC1: плашка вердикту ≤ 120 px — слово й один рядок «чому»', async ({ page }) => {
      await open(page);
      const hb = (await page.locator('header.status').boundingBox())!;
      expect(hb.height).toBeLessThanOrEqual(120);
      await expect(page.locator('header.status .word')).toBeVisible();
      const why = (await page.locator('header.status .why').boundingBox())!;
      expect(why.height).toBeLessThanOrEqual(24);
    });

    test('AC2: формула зони й assumption не видно на першому екрані без «Деталі»', async ({ page }) => {
      await open(page);
      for (const re of [/assumption/, /паспорт/, /nodata/]) {
        const vis = await page.getByText(re).evaluateAll((els) => els.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.height > 0 && r.top < innerHeight && (e as HTMLElement).checkVisibility();
        }).length);
        expect(vis, String(re)).toBe(0);
      }
    });

    test('AC3: MOCK видно; «Джерела» тапом показує статуси джерел', async ({ page }) => {
      await open(page);
      await expect(page.locator('header.status').getByText('MOCK', { exact: true })).toBeVisible();
      const b = page.getByRole('button', { name: /Джерела/ });
      await b.tap();
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('region', { name: 'Джерела' })).toBeVisible();
    });
  });
}

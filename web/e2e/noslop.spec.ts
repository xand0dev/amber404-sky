// Issue #192: без емодзі в кнопках, посиланнях і заголовках (іконки — inline-SVG); довгих тире у видимому тексті ≤ 15.
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

/** Тексти button, a, h1–h3 (і їхні ::before/::after) з емодзі — разом із прихованими (меню «⋯», плашки). */
const pictographic = (page: Page) => page.evaluate(() => {
  const re = /\p{Extended_Pictographic}/u;
  const bad: string[] = [];
  for (const el of document.querySelectorAll('button, a, h1, h2, h3')) {
    const pseudo = ['::before', '::after'].map((p) => getComputedStyle(el, p).content).join(' ');
    const txt = `${el.textContent ?? ''} ${pseudo}`;
    // © у підписах джерел — не емодзі, а знак авторського права; його не рахуємо.
    if (re.test(txt.replace(/©/g, ''))) bad.push(`${el.tagName}.${el.className}: ${txt.trim().slice(0, 60)}`);
  }
  return bad;
});

for (const [w, h] of [[400, 800], [1280, 800]] as const) {
  test.describe(`${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('AC1: немає Extended_Pictographic у button, a, h1–h3', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('.tl-play')).toBeVisible();
      await expect(page.locator('.tl-play svg')).toBeAttached();
      expect(await pictographic(page)).toEqual([]);
      // Відкрите вікно підкладки (онлайн-пункти й попередження) — теж без емодзі.
      await page.getByRole('toolbar', { name: 'Інструменти карти' }).getByRole('button', { name: 'Підкладка', exact: true }).click();
      await page.getByRole('radio', { name: /Вулиці/ }).check();
      expect(await pictographic(page)).toEqual([]);
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      await page.getByRole('button', { name: /Програти/ }).click();
      await expect(page.getByRole('button', { name: 'Пауза' }).locator('svg')).toBeAttached();
      expect(await pictographic(page)).toEqual([]);
    });
  });
}

test.describe('1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('AC2: довгих тире у видимому тексті головного екрана ≤ 15 (UK)', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.tl-play')).toBeVisible();
    const n = await page.evaluate(() => (document.body.innerText.match(/—/g) ?? []).length);
    expect(n).toBeLessThanOrEqual(15);
  });
});

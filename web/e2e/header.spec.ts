// Шапка й вердикт (issue #87, F3): на телефоні плашка ≤ 120 px, технічне — у «Деталі» й «Джерела».
import { expect, test, type Page } from '@playwright/test';

// Онбординг першого відкриття (#166) лягає поверх карти — у цих тестах його вже пройдено.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

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

    test('AC1: рядок «чому» не обрізаний — «Ніч» і UK/EN не забирають його місце', async ({ page }) => {
      await open(page);
      const word = (await page.locator('header.status .word').boundingBox())!;
      for (const sel of ['header.status .nightbtn', 'header.status .langsw']) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(Math.abs(b.y + b.height / 2 - (word.y + word.height / 2)), sel).toBeLessThanOrEqual(12);
        expect(b.x + b.width, sel).toBeLessThanOrEqual(w);
      }
      // «Чому» має весь другий рядок до кнопки «Джерела» (обрізання тексту залежить від шрифту, тож міряємо місце).
      const sum = (await page.locator('header.status .st-more summary').boundingBox())!;
      const src = (await page.locator('header.status .srcbtn').boundingBox())!;
      expect(sum.x).toBeLessThanOrEqual(14);
      expect(src.x - (sum.x + sum.width)).toBeLessThanOrEqual(8);
      expect(sum.width).toBeGreaterThanOrEqual(w * 0.65);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    });

    test('F3-AC5: із запасним шрифтом (без DIN Condensed) шапка без горизонтальної прокрутки', async ({ page }) => {
      await open(page);
      for (const font of ['Arial', 'Verdana']) {
        await page.addStyleTag({ content: `*{font-family:${font},sans-serif !important}` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), font).toBeLessThanOrEqual(w);
        for (const sel of ['header.status .nightbtn', 'header.status .langsw', 'header.status .srcbtn']) {
          const b = (await page.locator(sel).boundingBox())!;
          expect(b.x + b.width, `${font} ${sel}`).toBeLessThanOrEqual(w);
        }
        expect((await page.locator('header.status').boundingBox())!.height, font).toBeLessThanOrEqual(120);
        // Слово вердикту вміщається у свою колонку й не налазить на MOCK (запасний шрифт ≈ Roboto / Arial).
        if (font === 'Arial') {
          const fits = await page.locator('header.status .word').evaluate((e) => e.scrollWidth <= e.clientWidth + 1);
          expect(fits, 'слово вердикту').toBe(true);
        }
      }
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

test.describe('1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('AC1: на десктопі рядок «чому» не обрізаний', async ({ page }) => {
    await open(page);
    const clipped = await page.locator('header.status .why').evaluate((e) => e.scrollWidth > e.clientWidth + 1);
    expect(clipped).toBe(false);
  });

  test('AC2: «Деталі» відкриваються під шапкою і видно повністю', async ({ page }) => {
    await open(page);
    const hb = (await page.locator('header.status').boundingBox())!;
    const sum = page.locator('header.status .st-more summary');
    const before = (await sum.boundingBox())!;
    await sum.click();
    const after = (await sum.boundingBox())!;
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(after.y).toBeGreaterThanOrEqual(hb.y);
    const sub = page.locator('header.status .st-more .sub');
    await expect(sub).toBeVisible();
    const sb = (await sub.boundingBox())!;
    // Над картою, а не обрізано шапкою: елемент у точці — сам підпис.
    const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.st-more'), [sb.x + 4, sb.y + sb.height / 2]);
    expect(hit).toBe(true);
    expect((await page.locator('header.status').boundingBox())!.height).toBe(hb.height);
  });
});

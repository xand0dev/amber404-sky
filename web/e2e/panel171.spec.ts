// Панель точки (issue #171, F4): вердикт-герой, чипи причин (найгірша перша), вітер на 12 год, 400 px, ніч, reduced motion.
// Знімки — вкладення звіту Playwright (не еталони: шрифти Linux CI і macOS різні).
import { expect, test, type Page } from '@playwright/test';

const SEV = { no: 0, cau: 1, ok: 2, nodata: 3 } as const;

async function open(page: Page, night = false) {
  await page.addInitScript((n) => localStorage.setItem('amber404.night', n ? '1' : '0'), night);
  await page.goto('./');
  await expect(page.locator('canvas.map')).toBeVisible();
}

for (const [w, h] of [[400, 800], [1280, 800]]) {
  test.describe(`${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('герой, чипи від найгіршого, графік 12 год, без горизонтального скролу', async ({ page }, info) => {
      await open(page);
      const panel = page.getByRole('region', { name: 'Точка' });
      const hero = panel.locator('.hero');
      await expect(hero.locator('.word')).toHaveText(/^(МОЖНА|ОБЕРЕЖНО|НЕ МОЖНА|НЕМАЄ ДАНИХ)$/);
      await expect(hero.locator('h2')).not.toBeEmpty();
      await expect(hero.getByTestId('hero-why')).not.toBeEmpty();
      // Колір героя = колір рівня (той самий клас, що в плашці статусу).
      const lv = await page.locator('header.status').getAttribute('class');
      expect(await hero.getAttribute('class')).toContain(lv!.match(/lv-[A-Z-]+/)![0]);

      const sev = await panel.getByTestId('chips').locator('li').evaluateAll((li) => li.map((x) => x.getAttribute('data-sev')));
      expect(sev).toHaveLength(9);
      const ranks = sev.map((x) => SEV[x as keyof typeof SEV]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

      const pts = await panel.locator('.spark polyline.sp-line').evaluateAll((p) => p.flatMap((x) => (x.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean)));
      expect(pts).toHaveLength(12);
      await expect(panel.locator('.spark line.sp-lim')).toHaveCount(1);
      await expect(panel.locator('.spark rect.sp-b')).toHaveCount(12);

      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const over = await panel.evaluate((el) => [...el.querySelectorAll('.hero, .chips, .chip, .spark, .vals')]
        .filter((e) => e.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5).length);
      expect(over).toBe(0);

      await hero.scrollIntoViewIfNeeded();
      await info.attach(`panel-${w}`, { body: await panel.screenshot(), contentType: 'image/png' });
    });

    test('ніч: герой без зеленого й синього, рівень — смужкою', async ({ page }, info) => {
      await open(page, true);
      const hero = page.locator('.hero');
      const st = await hero.evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, c: getComputedStyle(e).color, sh: getComputedStyle(e).boxShadow }));
      for (const c of [st.bg, st.c]) {
        const [, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number);
        expect(g, c).toBeLessThan(120);
        expect(b, c).toBeLessThan(120);
      }
      expect(st.sh).toContain('inset');
      await info.attach(`panel-night-${w}`, { body: await page.getByRole('region', { name: 'Точка' }).screenshot(), contentType: 'image/png' });
    });
  });
}

test('зміна години — колір героя з переходом; reduced motion — без', async ({ page }) => {
  await open(page);
  expect(await page.locator('.hero').evaluate((e) => getComputedStyle(e).transitionDuration)).toContain('0.4s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.hero').evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('none');
});

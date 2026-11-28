// Issue #145: «Деталі ▾» у згорнутому підписі зони видно завжди — навіть коли зони немає й підпис найдовший.
import { expect, test, type Page } from '@playwright/test';

/** Вітер 30 м/с скрізь (×10 у profile.json) — понад ліміт будь-якого дрона: «зона відсутня» + причина. */
async function stormy(page: Page) {
  await page.route('**/data/profile.json', async (route) => {
    const res = await route.fetch();
    const p = await res.json();
    p.spd = p.spd.map((l: (number | null)[][]) => l.map((row) => row.map((v) => (v == null ? v : 300))));
    await route.fulfill({ response: res, json: p });
  });
}

for (const [locale, word] of [['uk-UA', 'Деталі'], ['en-US', 'Details']]) {
  test.describe(`412×915 ${locale}`, () => {
    test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, locale });

    test(`довгий підпис без зони: «${word} ▾» повністю видно`, async ({ page }) => {
      await stormy(page);
      await page.goto('./');
      await expect(page.locator('canvas.map')).toBeVisible();
      const more = page.locator('.zonecap .zonemore');
      await expect(more).toContainText(word);
      const cap = (await page.locator('.zonecap button').boundingBox())!;
      const m = (await more.boundingBox())!;
      expect(m.width).toBeGreaterThan(20);
      expect(m.x + m.width).toBeLessThanOrEqual(cap.x + cap.width + 0.5);
      expect(m.x + m.width).toBeLessThanOrEqual(412);
      // Те, що видно в точці «Деталі», — сам «Деталі» (не обрізаний переповненням тексту перед ним).
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.zonemore') != null, [m.x + m.width - 4, m.y + m.height / 2]);
      expect(hit).toBe(true);
    });
  });
}

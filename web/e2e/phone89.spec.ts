// Прогін демо на телефоні (issue #89): правки, знайдені в сценарії «відкрити → дрон → висота → тап → зона → знімок».
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, night = false) {
  await page.addInitScript((n) => localStorage.setItem('amber404.night', n ? '1' : '0'), night);
  await page.goto('./');
  await expect(page.locator('canvas.map')).toBeVisible();
}

test.describe('320×568 (iPhone SE, малі Android)', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });

  test('без горизонтальної прокрутки; «⋯» видно на екрані', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const more = (await page.getByRole('button', { name: 'Ще інструменти' }).boundingBox())!;
    expect(more.x).toBeGreaterThanOrEqual(0);
    expect(more.x + more.width).toBeLessThanOrEqual(320);
  });
});

/** Частка пікселів canvas, де G або B більші за R/2 (тобто «не червоні»). */
async function nonRedShare(page: Page, sel: string): Promise<number> {
  return page.locator(sel).evaluate((cv: HTMLCanvasElement) => {
    const ctx = cv.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    let bad = 0, all = 0;
    for (let i = 0; i < data.length; i += 4 * 7) {
      if (data[i + 3] < 64) continue; // майже прозорі краї слідів: колір з малої альфи округлюється неточно
      all++;
      if (data[i + 1] > data[i] / 2 + 3 || data[i + 2] > data[i] / 2 + 3) bad++;
    }
    return all ? bad / all : 0;
  });
}

test.describe('нічний режим (#36): карта лише червона', () => {
  test.use({ viewport: { width: 400, height: 800 }, hasTouch: true });

  test('уночі поле, кордони, ріки, підписи й частинки — без зеленого й синього', async ({ page }) => {
    await open(page, true);
    await page.waitForTimeout(500);
    expect(await nonRedShare(page, 'canvas.map')).toBe(0);
    expect(await nonRedShare(page, 'canvas.wind-particles')).toBe(0);
  });

  test('удень на карті є зелені тони (перевірка розрізняє теми)', async ({ page }) => {
    await open(page, false);
    expect(await nonRedShare(page, 'canvas.map')).toBeGreaterThan(0.2);
  });
});

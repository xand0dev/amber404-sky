// Десктоп (issue #86, F3): дві колонки — карта на всю висоту й панель точки з власною прокруткою, шапка в один рядок.
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Точка' })).toBeVisible();
}

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`немає ${sel}`);
  return b;
};

// Документ не ширший за вікно (без горизонтальної прокрутки).
const docWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
  test.describe(`${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('AC1: карта ліворуч на всю висоту, панель праворуч 360–420 px із власною прокруткою', async ({ page }) => {
      await open(page);
      const hd = await box(page, 'header.status');
      const m = await box(page, 'canvas.map');
      const p = await box(page, 'section.panel');
      // Панель — права колонка від шапки до низу вікна.
      expect(p.width).toBeGreaterThanOrEqual(360);
      expect(p.width).toBeLessThanOrEqual(420);
      expect(p.x + p.width).toBeCloseTo(w, 0);
      expect(p.y).toBeCloseTo(hd.y + hd.height, 0);
      expect(p.y + p.height).toBeCloseTo(h, 0);
      // Карта ліворуч від панелі, від лівого краю до панелі, без порожнеч.
      expect(m.x).toBeCloseTo(0, 0);
      expect(m.x + m.width).toBeLessThanOrEqual(p.x + 0.5);
      expect(m.x + m.width).toBeGreaterThanOrEqual(p.x - 2);
      // Карта займає більшу частину висоти під шапкою (решта — ряд інструментів, шари, смуга 48 год).
      expect(m.height / (h - hd.height)).toBeGreaterThanOrEqual(0.55);
      // Сторінка сама не прокручується — прокручується панель.
      const doc = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(doc).toBeLessThanOrEqual(h);
      const sc = await page.locator('section.panel').evaluate((el) => ({ oy: getComputedStyle(el).overflowY, sh: el.scrollHeight, ch: el.clientHeight }));
      expect(sc.oy).toBe('auto');
      expect(sc.sh).toBeGreaterThan(sc.ch);
      // Дрон, висота, точка й вердикт — у панелі.
      const panel = page.getByRole('region', { name: 'Точка' });
      await expect(panel.locator('select').first()).toBeVisible();
      await expect(panel.locator('input[type=range]').first()).toBeVisible();
      await expect(panel.getByTestId('point-level')).toBeVisible();
    });

    test('AC2: смуга 48 год під картою на ширину колонки карти', async ({ page }) => {
      await open(page);
      const m = await box(page, 'canvas.map');
      const tl = await box(page, '.tl');
      expect(tl.y).toBeGreaterThanOrEqual(m.y + m.height - 0.5);
      expect(tl.y + tl.height).toBeLessThanOrEqual(h + 0.5);
      expect(tl.x).toBeCloseTo(m.x, 0);
      expect(tl.width).toBeCloseTo(m.width, 0);
    });

    test('AC3: шапка — один рядок ≤ 72 px', async ({ page }) => {
      await open(page);
      const hd = await box(page, 'header.status');
      expect(hd.height).toBeLessThanOrEqual(72);
      expect(hd.width).toBeCloseTo(w, 0);
      // Вердикт, MOCK, «Джерела» (бейджі зібрано в неї, #87), «Ніч» і UK/EN в одному рядку.
      for (const sel of ['header.status .word', 'header.status .badge.mock', 'header.status .srcbtn', 'header.status .nightbtn', 'header.status .langsw']) {
        const b = await box(page, sel);
        expect(b.y, sel).toBeGreaterThanOrEqual(hd.y);
        expect(b.y + b.height, sel).toBeLessThanOrEqual(hd.y + hd.height + 0.5);
      }
    });

    test('AC4: без горизонтальної прокрутки', async ({ page }) => {
      await open(page);
      expect(await docWidth(page)).toBeLessThanOrEqual(w);
    });
  });
}

test.describe('768×1024', () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true });

  test('AC4: як на телефоні — на всю ширину, без порожнеч і горизонтальної прокрутки', async ({ page }) => {
    await open(page);
    expect(await docWidth(page)).toBeLessThanOrEqual(768);
    for (const sel of ['header.status', 'canvas.map', 'section.panel', '.tl']) {
      const b = await box(page, sel);
      expect(b.x, sel).toBeCloseTo(0, 0);
      expect(b.width, sel).toBeCloseTo(768, 0);
    }
  });
});

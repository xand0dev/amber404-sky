// Мобільний екран (issue #85, F3): карта велика, інструменти в один ряд над нею, легенда смужкою, шари під картою.
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Інструменти карти' }).getByRole('button', { name: 'Малювання' })).toBeVisible();
}

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`немає ${sel}`);
  return b;
};

for (const [w, h] of [[375, 812], [400, 800]]) {
  test.describe(`${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true });

    // #143 (рішення Івана, замість «≥ 55% екрана» з #85): карта під висоту України — уся країна, без порожніх смуг,
    // а вибір дрона — на першому екрані.
    test('AC1: уся Україна по ширині, смуги над і під нею ≤ 60 px; дрон видно на першому екрані', async ({ page }) => {
      await open(page);
      const m = await box(page, 'canvas.map');
      const r = await page.locator('canvas.map').evaluate((cv: HTMLCanvasElement & { unproject?: (x: number, y: number) => [number, number] }) => {
        const [latTop, lonL] = cv.unproject!(0, 0), [latBot, lonR] = cv.unproject!(cv.clientWidth, cv.clientHeight);
        return { latTop, latBot, lonL, lonR };
      });
      // Рамка України: 52.6…43.9° пн. ш., 21.9…40.6° сх. д. (core MAP_BOX).
      expect(r.lonL).toBeLessThanOrEqual(21.9 + 0.01);
      expect(r.lonR).toBeGreaterThanOrEqual(40.6 - 0.01);
      expect(r.latTop).toBeGreaterThanOrEqual(52.6);
      expect(r.latBot).toBeLessThanOrEqual(43.9);
      const pxPerDeg = m.height / (r.latTop - r.latBot);
      expect((r.latTop - 52.6) * pxPerDeg).toBeLessThanOrEqual(60);
      expect((43.9 - r.latBot) * pxPerDeg).toBeLessThanOrEqual(60);
      // Легенда й підпис зони — нижче південного узбережжя Криму (~44.4°).
      const crimeaY = m.y + (r.latTop - 44.4) * pxPerDeg;
      for (const sel of ['.legend', '.zonecap .zonetxt']) expect((await box(page, sel)).y, sel).toBeGreaterThanOrEqual(crimeaY);
      const drone = await page.getByRole('combobox').first().boundingBox();
      expect(drone!.y + drone!.height).toBeLessThanOrEqual(h);
    });

    // #161: «Де я» — у ряду; 📷 на екрані < 420 px переходить у «⋯» (9 кнопок по 44 px не вміщуються).
    test('AC2: один ряд інструментів ≤ 48 px над картою, кнопки ≥ 44 px, решта в «⋯»', async ({ page }) => {
      await open(page);
      const bar = page.getByRole('toolbar', { name: 'Інструменти карти' });
      const b = await bar.boundingBox();
      const m = await box(page, 'canvas.map');
      expect(b!.height).toBeLessThanOrEqual(48);
      expect(b!.y + b!.height).toBeLessThanOrEqual(m.y + 0.5);
      for (const name of ['Де я', 'Малювання', 'Підкладка', 'Наблизити', 'Віддалити', 'До зони', 'Україна', 'Ще інструменти']) {
        const btn = bar.getByRole('button', { name, exact: true });
        await expect(btn, name).toBeVisible();
        const bb = (await btn.boundingBox())!;
        expect(bb.height, name).toBeGreaterThanOrEqual(44);
        expect(bb.width, name).toBeGreaterThanOrEqual(44);
        // Увесь ряд видно без прокрутки — кнопка в межах екрана.
        expect(bb.x + bb.width, name).toBeLessThanOrEqual(w);
        expect(Math.abs(bb.y - b!.y), name).toBeLessThanOrEqual(4);
      }
      await expect(page.getByRole('button', { name: 'Зона', exact: true })).toBeHidden();
      await bar.getByRole('button', { name: 'Ще інструменти' }).click();
      await expect(page.getByRole('button', { name: 'Зона', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Знімок карти', exact: true })).toBeVisible();
    });

    test('AC3: легенда — смужка ≤ 32 px унизу карти', async ({ page }) => {
      await open(page);
      const lg = await box(page, 'figure.legend');
      const m = await box(page, 'canvas.map');
      expect(lg.height).toBeLessThanOrEqual(32);
      expect(lg.y + lg.height).toBeLessThanOrEqual(m.y + m.height);
      expect(lg.y).toBeGreaterThan(m.y + m.height * 0.8);
    });

    test('AC4: підпис зони — один рядок; тап відкриває деталі', async ({ page }) => {
      await open(page);
      const cap = page.locator('.zonecap button');
      await expect(cap).toHaveAttribute('aria-expanded', 'false');
      const text = page.locator('.zonecap .zonetxt');
      const one = (await text.boundingBox())!.height;
      expect(one).toBeLessThanOrEqual(22);
      await cap.tap();
      await expect(cap).toHaveAttribute('aria-expanded', 'true');
      expect((await text.boundingBox())!.height).toBeGreaterThan(one);
    });

    test('AC5: смуга шарів під картою, а не поверх неї', async ({ page }) => {
      await open(page);
      const layers = await box(page, '[role=radiogroup][aria-label="Шар карти"]');
      const m = await box(page, 'canvas.map');
      expect(layers.y).toBeGreaterThanOrEqual(m.y + m.height - 0.5);
    });

    test('AC6: тап по центру карти обирає точку', async ({ page }) => {
      await open(page);
      const coord = page.getByRole('region', { name: 'Точка' }).locator('p.coord').filter({ hasText: /^-?\d+\.\d{3}, -?\d+\.\d{3}/ });
      await expect(coord).toHaveText(/^50\.450, 30\.520/);
      await page.locator('canvas.map').tap();
      await expect(coord).not.toHaveText(/^50\.450, 30\.520/);
    });
  });
}

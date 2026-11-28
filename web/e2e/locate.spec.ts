// Issue #161 (F3): «Де я» — геолокація браузера (Playwright geolocation + дозвіл) → синя точка на карті й вердикт у панелі.
// OPSEC (AC6): після «Де я» жоден запит не несе координат.
import { expect, test } from '@playwright/test';

// Онбординг першого відкриття (#166) лягає поверх карти — у цих тестах його вже пройдено.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

// Львів: у межах карти, найближче місто в cities.json — «Львів» (панель покаже його назву).
const LVIV = { latitude: 49.842, longitude: 24.031, accuracy: 40 };

test.describe('«Де я» з дозволом', () => {
  test.use({ geolocation: LVIV, permissions: ['geolocation'] });

  test('AC1–AC3, AC6: точка й коло точності, карта наближена, панель — вердикт у Львові, без запитів з координатами', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('canvas.map')).toBeVisible();
    const sent: string[] = [];
    page.on('request', (r) => sent.push(r.url() + ' ' + (r.postData() ?? '')));
    const btn = page.getByRole('toolbar', { name: 'Інструменти карти' }).getByRole('button', { name: 'Де я', exact: true });
    await expect(btn).toBeVisible();
    await btn.click();
    const dot = page.getByRole('img', { name: /Моя позиція ±40 м/ });
    await expect(dot).toBeVisible();
    await expect(page.locator('svg.locate circle.locacc')).toHaveCount(1);
    await expect(page.locator('.point h2')).toHaveText('Львів');
    await expect(page.getByTestId('point-level')).toBeVisible();
    await expect(page.getByTestId('verdict-explain')).not.toBeEmpty();
    // Точка — у центрі карти (центрування на позиції).
    const m = (await page.locator('canvas.map').boundingBox())!;
    const c = (await page.locator('svg.locate circle.locme').boundingBox())!;
    expect(Math.abs(c.x + c.width / 2 - (m.x + m.width / 2))).toBeLessThanOrEqual(3);
    expect(Math.abs(c.y + c.height / 2 - (m.y + m.height / 2))).toBeLessThanOrEqual(3);
    // Стеження вмик/вимик (AC4).
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(sent.filter((u) => /49\.84|24\.03/.test(u))).toEqual([]);
    expect(page.url()).not.toMatch(/49\.84|24\.03/);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toMatch(/49\.84|24\.03/);
  });
});

test.describe('«Де я» поза рамкою', () => {
  test.use({ geolocation: { latitude: 52.23, longitude: 21.01 }, permissions: ['geolocation'] });

  test('AC5: Варшава → «Ви поза зоною карти», точки немає', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Де я', exact: true }).click();
    await expect(page.locator('.locmsg')).toHaveText('Ви поза зоною карти');
    await expect(page.locator('svg.locate circle')).toHaveCount(0);
  });
});

test.describe('«Де я» без дозволу', () => {
  test.use({ permissions: [] });

  test('AC5: відмова → «Немає доступу до геолокації»', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Де я', exact: true }).click();
    await expect(page.locator('.locmsg')).toHaveText('Немає доступу до геолокації');
    await expect(page.locator('svg.locate circle')).toHaveCount(0);
  });
});

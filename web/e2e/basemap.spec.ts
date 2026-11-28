// Підкладки (issue #100, SPEC §7.6a): меню, збереження вибору, повзунок, атрибуція, офлайн без запитів з координатами, ≤ 300 мс.
// Issue #130: одна кнопка «Підкладка» в ряду інструментів відкриває вибір; форма «Своя карта» — лише після вибору.
import { expect, test, type Page } from '@playwright/test';

const barBtn = (page: Page) => page.getByRole('toolbar', { name: 'Інструменти карти' }).getByRole('button', { name: 'Підкладка', exact: true });

async function openMenu(page: Page) {
  await expect(page.locator('header.status')).toBeVisible();
  await barBtn(page).click();
  return page.getByRole('radiogroup', { name: 'Підкладка' });
}

test('#130: Підкладка → Рельєф → на карті relief.png і атрибуція Copernicus DEM', async ({ page }) => {
  await page.goto('./');
  const g = await openMenu(page);
  await g.getByText('Рельєф', { exact: true }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(g).toBeHidden();
  await expect(page.locator('canvas.basemap[data-drawn="relief"]')).toBeVisible();
  await expect(page.locator('.baseattr')).toContainText('Copernicus DEM');
});

test('#130: у ряду одна «Підкладка», у «⋯» пункту «Підкладка карти» немає', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  await expect(page.getByRole('button', { name: /Підкладка/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Ще інструменти' }).click();
  await expect(page.getByRole('button', { name: 'Підкладка карти' })).toHaveCount(0);
});

test('#130: OK, Esc і клік поза вікном закривають вибір; вікно не перекриває карту', async ({ page }) => {
  await page.goto('./');
  let g = await openMenu(page);
  const win = await page.locator('section.basepanel').boundingBox();
  const map = await page.locator('canvas.map').boundingBox();
  expect(win!.width * win!.height).toBeLessThan(0.5 * map!.width * map!.height);
  // Поле лівіше за вікно лишається вільним.
  expect(win!.x).toBeGreaterThan(map!.x + 80);
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(g).toBeHidden();
  g = await openMenu(page);
  await page.keyboard.press('Escape');
  await expect(g).toBeHidden();
  g = await openMenu(page);
  await page.mouse.click(map!.x + 20, map!.y + map!.height / 2);
  await expect(g).toBeHidden();
});

test('#130: форма прив\'язки з\'являється лише після вибору «Своя карта»', async ({ page }) => {
  await page.goto('./');
  const g = await openMenu(page);
  await expect(page.locator('.ovpanel')).toHaveCount(0);
  await g.getByText('Своя карта', { exact: true }).click();
  await expect(g).toBeHidden();
  await expect(page.locator('.ovpanel')).toBeVisible();
  // Повторне відкриття вибору прибирає форму.
  await barBtn(page).click();
  await expect(page.locator('.ovpanel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Файл і прив’язка' }).click();
  await expect(page.locator('.ovpanel')).toBeVisible();
});

test('AC1, AC2, AC4: Рельєф → підкладка під полем, повзунок, атрибуція; вибір переживає перезавантаження', async ({ page }) => {
  await page.goto('./');
  const g = await openMenu(page);
  for (const name of ['Без', 'Рельєф', 'Супутник', 'Своя карта']) await expect(g.getByRole('radio', { name, exact: true })).toBeAttached();
  await g.getByText('Рельєф', { exact: true }).click();
  await expect(page.locator('canvas.basemap[data-drawn="relief"]')).toBeVisible();
  await expect(page.locator('.baseattr')).toContainText('Copernicus DEM GLO-90');
  // Підкладка — під картою (раніше в DOM), той самий розмір.
  const order = await page.evaluate(() => {
    const els = [...document.querySelectorAll('main.mapwrap > canvas')].map((c) => c.className);
    return els.indexOf('basemap') < els.indexOf('map');
  });
  expect(order).toBe(true);
  const slider = page.getByRole('slider', { name: 'Прозорість погоди' });
  await slider.fill('70');
  await g.getByText('Супутник', { exact: true }).click();
  await expect(page.locator('.baseattr')).toContainText('Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020');

  await page.reload();
  await expect(page.locator('canvas.basemap[data-drawn="satellite"]')).toBeVisible();
  const g2 = await openMenu(page);
  await expect(g2.getByRole('radio', { name: 'Супутник', exact: true })).toBeChecked();
  await expect(page.getByRole('slider', { name: 'Прозорість погоди' })).toHaveValue('70');
});

test('AC5: лише статичні файли того самого походження — без запитів з координатами', async ({ page, baseURL }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('./');
  const g = await openMenu(page);
  for (const name of ['Рельєф', 'Супутник', 'Без', 'Своя карта']) await g.getByText(name, { exact: true }).click();
  await barBtn(page).click(); // прибирає форму «Своя карта»
  await page.getByRole('button', { name: 'OK' }).click();
  await page.locator('canvas.map').click({ position: { x: 120, y: 120 } });
  await page.waitForLoadState('networkidle');
  const origin = new URL(baseURL ?? '').origin;
  for (const u of urls) {
    const url = new URL(u);
    expect(url.origin, u).toBe(origin);
    expect(url.search, u).toBe('');
  }
  for (const f of ['static/relief.png', 'static/satellite.jpg', 'static/water.json']) expect(urls.some((u) => u.endsWith(`/data/${f}`)), f).toBe(true);
});

test('AC5: relief.png, satellite.jpg, water.json — у кеші service worker', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // тепер сторінку контролює SW і кладе файли даних у кеш
  await expect(page.locator('header.status')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const hits = await Promise.all(['relief.png', 'satellite.jpg', 'water.json'].map((f) => caches.match(new URL(`data/static/${f}`, location.href).href)));
    return hits.every(Boolean);
  }), { timeout: 10_000 }).toBe(true);
});

test('AC6: перемикання підкладки ≤ 300 мс (F3-AC2)', async ({ page }) => {
  await page.goto('./');
  const g = await openMenu(page);
  await g.getByText('Рельєф', { exact: true }).click();
  await expect(page.locator('canvas.basemap[data-drawn="relief"]')).toBeVisible();
  await g.getByText('Супутник', { exact: true }).click();
  await expect(page.locator('canvas.basemap[data-drawn="satellite"]')).toBeVisible();
  // Від кліку до готових кадрів підкладки й поля — у самій сторінці, без затримок Playwright.
  const ms = await page.evaluate(() => new Promise<number>((res) => {
    const cv = document.querySelector<HTMLCanvasElement>('canvas.basemap')!;
    const radio = [...document.querySelectorAll<HTMLInputElement>('input[name=basemap]')].find((r) => r.value === 'relief')!;
    const t0 = performance.now();
    radio.click();
    const wait = () => (cv.dataset.drawn === 'relief' ? requestAnimationFrame(() => res(performance.now() - t0)) : requestAnimationFrame(wait));
    wait();
  }));
  expect(ms).toBeLessThanOrEqual(300);
});

test('Онлайн «Вулиці»: тайли лише після вибору, попередження OPSEC, після перезапуску — знову офлайн', async ({ page }) => {
  const tiles: string[] = [];
  // У CI без зовнішньої мережі: тайл OSM підміняємо прозорим PNG 1×1.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.route('https://tile.openstreetmap.org/**', (r) => { tiles.push(r.request().url()); return r.fulfill({ body: png, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }); });
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  expect(tiles).toHaveLength(0);
  const g = await openMenu(page);
  await g.getByRole('radio', { name: 'Вулиці', exact: true }).check();
  await expect(page.locator('.basewarn')).toContainText('Сервер карти бачить');
  await expect(page.locator('canvas.basemap[data-drawn="streets"]')).toBeVisible();
  await expect(page.locator('.baseattr')).toContainText('OpenStreetMap');
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.every((u) => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u))).toBe(true);
  await expect(page.getByRole('slider', { name: 'Прозорість погоди' })).toHaveValue('70');
  tiles.length = 0;
  await page.reload();
  await expect(page.locator('header.status')).toBeVisible();
  await page.waitForTimeout(500);
  expect(tiles).toHaveLength(0);
});

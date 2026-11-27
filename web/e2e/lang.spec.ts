// Англійська карта (issue #119, SPEC §7.11 uk/en): після перемикання на EN у видимому тексті карти й шарів немає кирилиці.
// Проєкти playwright — 400×800 і 1280×800. Назви міст малюються на canvas і в innerText не потрапляють.
import { expect, test, type Page } from '@playwright/test';

const CYR = /[Ѐ-ӿ]/;

// Видимий текст ряду інструментів, карти (зона, панелі малювання й підкладки), шарів і легенди.
const mapText = (page: Page) => page.evaluate(() =>
  ['.mapbarwrap', 'main.mapwrap', '.layers', 'figure.legend']
    .map((s) => [...document.querySelectorAll<HTMLElement>(s)].map((e) => e.innerText).join('\n'))
    .join('\n'));

const cyrLines = (text: string) => text.split('\n').filter((l) => CYR.test(l));

test('EN: карта, зона, малювання, підкладка, шари й легенда — без кирилиці', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  await page.getByRole('group', { name: 'Мова інтерфейсу' }).getByRole('button', { name: 'EN' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Меню «⋯» (на телефоні там «Зона»), підпис зони розгорнуто.
  await page.locator('.morebtn').click();
  await page.locator('.zonecap button').click();
  expect(cyrLines(await mapText(page))).toEqual([]);

  // Кожен шар: назва в смузі шарів і в легенді.
  for (const b of await page.locator('.layers button').all()) {
    await b.click();
    expect(cyrLines(await mapText(page))).toEqual([]);
  }

  // Панелі малювання й підкладки.
  await page.locator('.drawbtn').click();
  await expect(page.locator('.drawpanel')).toBeVisible();
  expect(cyrLines(await mapText(page))).toEqual([]);
  await page.locator('.drawbtn').click();
  await page.locator('.ovbtn').click();
  await expect(page.locator('.ovpanel')).toBeVisible();
  expect(cyrLines(await mapText(page))).toEqual([]);
});

test('EN: доступні імена кнопок масштабу, шарів і інструментів — англійською', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('group', { name: 'Мова інтерфейсу' }).getByRole('button', { name: 'EN' }).click();
  for (const name of ['Zoom in', 'Zoom out', 'To zone', 'Ukraine', 'Drawing', 'Underlay']) {
    await expect(page.getByRole('button', { name, exact: true }), name).toBeAttached();
  }
  await expect(page.getByRole('radiogroup', { name: 'Map layer' })).toBeVisible();
  await expect(page.getByRole('figure', { name: /^Legend: Wind · 50 m$/ })).toBeVisible();
});

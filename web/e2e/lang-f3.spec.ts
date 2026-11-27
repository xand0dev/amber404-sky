// Англійська в карті, шарах і смузі годин (issue #116, F3): після EN — без кирилиці у видимому тексті
// й у доступних іменах (aria-label, title) ряду інструментів, карти, легенди й смуги годин.
// Назви міст малюються на canvas — їх перевіряє unit-тест map/translit.test.ts.
import { expect, test } from '@playwright/test';

const CYR = /[Ѐ-ӿ]/;

test('EN: смуга годин, ряд інструментів, карта й легенда — без кирилиці в тексті й aria-label/title', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
  await page.getByRole('group', { name: 'Мова інтерфейсу' }).getByRole('button', { name: 'EN' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const bad = await page.evaluate((re) => {
    const cyr = new RegExp(re);
    const out: string[] = [];
    for (const root of document.querySelectorAll<HTMLElement>('.mapbarwrap, main.mapwrap, figure.legend, .tl')) {
      for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        for (const a of ['aria-label', 'title']) { const v = el.getAttribute(a); if (v && cyr.test(v)) out.push(`${a}: ${v}`); }
      }
      for (const l of root.innerText.split('\n')) if (cyr.test(l)) out.push(`text: ${l}`);
    }
    return out;
  }, CYR.source);
  expect(bad).toEqual([]);
  await expect(page.getByRole('navigation', { name: 'Forecast hour' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Map tools' })).toBeVisible();
});

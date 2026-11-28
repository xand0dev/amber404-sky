// Візуальна система (issue #88, AC2): у справжньому браузері текст кожної видимої кнопки й заголовка вердикту
// має контраст ≥ 4.5:1 зі своїм тлом — удень і вночі. Ловить і помилки каскаду (колір, що «протік» з батька).
import { expect, test, type Page } from '@playwright/test';

// Онбординг першого відкриття (#166) лягає поверх карти — у цих тестах його вже пройдено.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('amber404.tour', '1')));

async function open(page: Page, night: boolean) {
  await page.addInitScript((n) => localStorage.setItem('amber404.night', n ? '1' : '0'), night);
  await page.goto('./');
  await expect(page.locator('canvas.map')).toBeVisible();
}

/** Пари (текст, контраст) для видимих кнопок з непрозорим тлом і для слова вердикту. */
async function lowContrast(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const cr = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    /** Перше непрозоре тло вгору по дереву. */
    const bgOf = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] === 1)) return c.slice(0, 3);
      }
      return [0, 0, 0];
    };
    const els = [...document.querySelectorAll('button, header.status .word, header.status .why')].filter((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && (e.textContent ?? '').trim() !== '' && Number(cs.opacity) === 1;
    });
    return els.flatMap((e) => {
      const k = cr(rgb(getComputedStyle(e).color).slice(0, 3), bgOf(e));
      return k < 4.5 ? [`${(e.textContent ?? '').trim().slice(0, 20)} — ${k.toFixed(2)}`] : [];
    });
  });
}

for (const night of [false, true]) {
  for (const [w, h] of [[400, 800], [1280, 800]]) {
    test(`AC2: контраст кнопок і вердикту ≥ 4.5 — ${night ? 'ніч' : 'день'}, ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, night);
      expect(await lowContrast(page)).toEqual([]);
    });
  }
}

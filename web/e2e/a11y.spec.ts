// Доступність і 400 px (issue #47, SPEC §7.10, F3-AC5): скрол, кнопки ≥ 44 px, доступні імена, видимий фокус, reduced motion.
import { expect, test, type Locator, type Page } from '@playwright/test';

// Збирає помилки консолі й невловлені винятки сторінки.
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function open(page: Page) {
  await page.goto('./');
  await expect(page.locator('header.status')).toBeVisible();
}

// Табує, доки фокус не опиниться на елементі (не більше max натискань). Без кліку — лише клавіатура.
async function tabTo(page: Page, target: Locator, max = 120): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return true;
  }
  return false;
}

// Видимий фокус = непрозорий outline ненульової товщини або box-shadow на сфокусованому елементі.
async function hasVisibleFocus(el: Locator): Promise<boolean> {
  return el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && !/rgba\(.*,\s*0\)$/.test(cs.outlineColor);
    return outline || (cs.boxShadow !== 'none' && cs.boxShadow !== '');
  });
}

type AXNode = { ignored: boolean; role?: { value: unknown }; name?: { value: unknown }; backendDOMNodeId?: number };
const ROLES = new Set(['button', 'link', 'radio', 'checkbox', 'switch', 'combobox', 'listbox', 'slider', 'textbox', 'spinbutton', 'searchbox', 'tab', 'menuitem', 'option']);

test.describe('400×800', () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test('немає горизонтального скролу', async ({ page }) => {
    await open(page);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
  });

  test('усі видимі кнопки ≥ 44 px заввишки', async ({ page }) => {
    await open(page);
    const small = await page.locator('button, [role=button], [role=radio]').evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.outerHTML.slice(0, 60), h: el.getBoundingClientRect().height }))
        .filter((x) => x.h < 44),
    );
    expect(small).toEqual([]);
  });

  test('кожен інтерактивний елемент має доступне ім\'я', async ({ page }) => {
    await open(page);
    // Дерево доступності Chromium (CDP): ім'я рахує браузер — aria-label, <label>, текст.
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
    const interactive = nodes.filter((x) => !x.ignored && ROLES.has(String(x.role?.value)));
    expect(interactive.length).toBeGreaterThan(0);
    const nameless = interactive.filter((x) => !String(x.name?.value ?? '').trim()).map((x) => `${x.role?.value} #${x.backendDOMNodeId}`);
    expect(nameless).toEqual([]);
  });
});

test.describe('клавіатура', () => {
  test('шари, години, дрон, висота: Tab доходить і фокус видимий', async ({ page }) => {
    await open(page);
    const targets: [string, Locator][] = [
      ['шар', page.getByRole('radiogroup', { name: 'Шар карти' }).getByRole('radio').first()],
      ['година', page.getByRole('navigation', { name: 'Година прогнозу' }).getByRole('button').first()],
      ['дрон', page.getByRole('region', { name: 'Точка' }).locator('select').first()],
      ['висота', page.getByRole('region', { name: 'Точка' }).locator('input[type=range]').first()],
    ];
    for (const [name, el] of targets) {
      await page.locator('body').focus();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      expect(await tabTo(page, el), `Tab не доходить до: ${name}`).toBe(true);
      expect(await hasVisibleFocus(el), `немає видимого фокусу: ${name}`).toBe(true);
    }
  });
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('сторінка відкривається без помилок', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect(page.locator('canvas.map')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Година прогнозу' }).getByRole('button')).toHaveCount(48);
    expect(errors).toEqual([]);
  });
});


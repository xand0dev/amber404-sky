// Issue #89: розміщення підписів міст без накладань. Жадібно в порядку cities.json (Київ — першим, решта — за важливістю):
// кожен підпис пробує 10 положень навколо своєї точки й бере перше, що не перетинає вже поставлені підписи, точки інших
// міст, маркер обраної точки й краї карти. Не вміщується ніде — точка лишається без підпису (краще, ніж каша з літер).

export interface Box { x: number; y: number; w: number; h: number }
/** Місце підпису: рамка й точка, від якої малювати текст (ліворуч, по базовій лінії). */
export interface Placed extends Box { tx: number; by: number }
export interface LabelItem { x: number; y: number; w: number; h: number }

const GAP = 5;
const DOT = 2;

/** Відступ «за маркером»: коли обрана точка стоїть на місті, підпис відходить за хрестик (32 px). */
const FAR = 20;

/** Кандидати: праворуч угорі (як було), праворуч унизу, ліворуч угорі, ліворуч унизу, над точкою, під точкою;
 *  далі — ті самі боки, але за маркером обраної точки. */
function candidates(it: LabelItem): [number, number][] {
  const { x, y, w, h } = it;
  return [[x + GAP, y - 4], [x + GAP, y + h], [x - GAP - w, y - 4], [x - GAP - w, y + h], [x - w / 2, y - 6], [x - w / 2, y + h + 4],
    [x + FAR, y + h / 2 - 2], [x - FAR - w, y + h / 2 - 2], [x - w / 2, y - FAR], [x - w / 2, y + FAR + h - 2]];
}

const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** `avoid` — інші перешкоди (маркер обраної точки). */
export function placeLabels(items: LabelItem[], W: number, H: number, avoid: Box[] = []): (Placed | null)[] {
  const dots: Box[] = items.map((d) => ({ x: d.x - DOT, y: d.y - DOT, w: DOT * 2, h: DOT * 2 }));
  const placed: Box[] = [...avoid];
  return items.map((it, i) => {
    for (const [tx, by] of candidates(it)) {
      const b: Placed = { x: tx, y: by - it.h + 3, w: it.w, h: it.h, tx, by };
      if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H) continue;
      if (placed.some((p) => hit(b, p)) || dots.some((d, j) => j !== i && hit(b, d))) continue;
      placed.push(b);
      return b;
    }
    return null;
  });
}

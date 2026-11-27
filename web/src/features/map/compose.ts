// F3-AC7 (§7.12): PNG з того, що на карті — підкладка, поле, стрілки замість частинок, зона, малюнки — плюс штамп.
// Лише власні Canvas/SVG шари й локальні Blob URL, без мережі й сторонніх сервісів.
import type { Bundle } from '../../app/data';
import type { AppState } from '../../app/state';
import { makeProjection, type View } from '../../core';
import { drawWindArrows } from './arrows';

const LINE = 16, PAD = 8;
const visible = (el: Element | null): el is HTMLElement => !!el && !(el as HTMLElement).hidden && getComputedStyle(el).display !== 'none';

/** SVG малюнків → Image: у клон вписуємо стилі тексту (клас .drawtext не переживає серіалізацію). */
async function svgImage(svg: SVGSVGElement, W: number, H: number): Promise<HTMLImageElement | null> {
  if (!svg.querySelector('line,polyline,polygon,path,circle,text,g > *')) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = svg.querySelectorAll('text'), dst = clone.querySelectorAll('text');
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    dst[i].setAttribute('style', `font:${cs.font};fill:${cs.fill};stroke:${cs.stroke};stroke-width:${cs.strokeWidth};paint-order:${cs.paintOrder};stroke-linejoin:round`);
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(W)); clone.setAttribute('height', String(H));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('svg')); img.src = url; });
    return img;
  } finally { URL.revokeObjectURL(url); }
}

export async function composeSnapshot(wrap: HTMLElement, data: Bundle, s: AppState, reduce: boolean, lines: string[], view?: View): Promise<Blob> {
  const map = wrap.querySelector<HTMLCanvasElement>('canvas.map');
  if (!map) throw new Error('немає карти');
  const W = map.clientWidth, H = map.clientHeight, dpr = window.devicePixelRatio || 1;
  const stampH = PAD * 2 + LINE * lines.length;
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round((H + stampH) * dpr);
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('canvas недоступний');
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = css.getPropertyValue('--base').trim() || '#1c2117'; ctx.fillRect(0, 0, W, H + stampH);

  const under = wrap.querySelector<HTMLCanvasElement>('canvas.underlay');
  if (visible(under) && under.width > 0) ctx.drawImage(under, 0, 0, W, H);
  ctx.globalAlpha = Number(getComputedStyle(map).opacity) || 1;
  ctx.drawImage(map, 0, 0, W, H);
  ctx.globalAlpha = 1;
  if (!reduce) drawWindArrows(ctx, data, s, makeProjection(W, H, view).project); // частинки → стрілки (§7.12)
  const zone = wrap.querySelector<HTMLCanvasElement>('canvas.zone');
  if (visible(zone) && zone.width > 0) ctx.drawImage(zone, 0, 0, W, H);
  const svg = wrap.querySelector<SVGSVGElement>('svg.drawlayer');
  if (svg) { const img = await svgImage(svg, W, H); if (img) ctx.drawImage(img, 0, 0, W, H); }

  // Штамп під картою.
  ctx.fillStyle = 'rgba(17,21,14,.96)'; ctx.fillRect(0, H, W, stampH);
  ctx.fillStyle = css.getPropertyValue('--ink').trim() || '#e6e2cc'; ctx.textBaseline = 'top';
  lines.forEach((ln, i) => {
    ctx.font = i === 0 ? '700 13px system-ui, sans-serif' : '500 12px system-ui, sans-serif';
    ctx.fillText(ln, PAD, H + PAD + i * LINE, W - PAD * 2);
  });
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('PNG не зібрано'))), 'image/png'));
}

// Issue #100 (SPEC §7.6a): підкладка під полем погоди — Без / Рельєф / Супутник / Своя карта (§7.14, F0 — як є).
// Окремий canvas під canvas.map у спільній проєкції (#64); вибір і прозорість — у localStorage; атрибуція — у куті карти.
// Issue #130: вибір відкриває кнопка «Підкладка» в ряду інструментів; кнопку форми «Своя карта» (Overlay, F0) ховає CSS,
// а форму відкриваємо її ж кліком лише після вибору «Своя карта». OK, Esc чи клік поза вікном закривають вибір.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../app/lang';
import { useView } from '../../app/view/view';
import { makeProjection } from '../../core';
import { InBar } from '../../ui/MapFrame';
import { attribution, BASE_IDS, BASE_NAME, HI_TILES, IMAGE_BASES, imageAffine, ONLINE, type BaseId } from './basemaps';
import { loadBaseImage, loadImage, setBasemap, useBasemap } from './basemapStore';
import { drawTile, loadTile, TILE_SOURCES, visibleTiles } from './tiles';

/** З якого масштабу «Супутник» докачує різкі шматки (~4.6 МБ): на всій Україні вистачає грубого. */
const HI_ZOOM = 1.6;
/** assumption: 70 % — вулиці й будинки читаються, колір вітру ще видно. */
const ONLINE_TRANSP = 70;
import './basemap.css';

const TXT = {
  uk: { btn: 'Підкладка', menu: 'Підкладка', op: 'Прозорість погоди', own: 'Файл і прив’язка', online: 'Онлайн — детально до вулиць',
    warn: 'Сервер карти бачить, який район ви дивитесь. Не вмикайте там, де це небезпечно. Після перезапуску — знову офлайн.' },
  en: { btn: 'Underlay', menu: 'Basemap', op: 'Weather transparency', own: 'File and anchors', online: 'Online — street-level detail',
    warn: 'The map server sees which area you view. Do not use where that is unsafe. Back to offline after restart.' },
};
const ICON: Record<BaseId, string> = { none: '∅', relief: '⛰', satellite: '🛰', own: '▦', satlive: '🛰', streets: '🗺' };

/** Відкрити чи закрити форму «Своя карта» (F0) її власною кнопкою — стан форми живе в Overlay. */
function ownForm(want: boolean) {
  const b = document.querySelector<HTMLButtonElement>('button.ovbtn');
  if (b && (b.getAttribute('aria-expanded') === 'true') !== want) b.click();
}

export function Basemap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const { base, wxTransp } = useBasemap();
  const { view } = useView();
  const { lang } = useT();
  const tx = TXT[lang];
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  // Обрана підкладка — атрибут mapwrap: CSS ховає «Свою карту», коли обрано іншу (basemap.css).
  useEffect(() => {
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    wrap.dataset.base = base;
    return () => { delete wrap.dataset.base; };
  }, [base]);

  // Офлайн (AC5): обидва зображення читаються, коли браузер вільний, — потрапляють у кеш service worker, а перемикання
  // миттєве. Не на старті (#89): 470 КБ не конкурують із даними прогнозу за мережу першого екрана. Обрану — одразу (нижче).
  useEffect(() => {
    const pre = () => { void loadBaseImage('relief'); void loadBaseImage('satellite'); };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(pre, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(pre, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const upd = () => setSize([cv.clientWidth, cv.clientHeight]);
    upd();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', upd); return () => window.removeEventListener('resize', upd); }
    const ro = new ResizeObserver(upd);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let alive = true;
    const [W, H] = size, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    delete cv.dataset.drawn;
    const ctx = cv.getContext('2d');
    if (!IMAGE_BASES.has(base)) return;
    const proj = makeProjection(W, H, view);
    // Шари малюємо по черзі, щойно вантажаться: спершу грубе статичне зображення, поверх — детальніше.
    let low: HTMLImageElement | null = null;
    const hi = new Map<string, HTMLImageElement>();
    const tiles = new Map<string, HTMLImageElement>();
    const online = (base === 'satlive' || base === 'streets') && W && H ? visibleTiles(proj, W, H, dpr, TILE_SOURCES[base]) : [];
    const hiOn = base === 'satellite' && view.zoom >= HI_ZOOM;
    const render = () => {
      if (!alive || !ctx || !W || !H) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (low) {
        const m = imageAffine(proj.affine, low.naturalWidth, low.naturalHeight);
        ctx.setTransform(dpr * m[0], dpr * m[3], dpr * m[1], dpr * m[4], dpr * m[2], dpr * m[5]);
        ctx.drawImage(low, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      for (const t of HI_TILES) { const im = hi.get(t.url); if (im) drawTile(ctx, im, t, proj.project); }
      for (const t of online) { const im = tiles.get(t.url); if (im) drawTile(ctx, im, t, proj.project); }
      cv.dataset.drawn = base;
    };
    // Під онлайн-супутником — статичний (поки тайли летять, не порожньо); під вулицями — нічого.
    const lowId: BaseId | null = base === 'relief' ? 'relief' : base === 'satellite' || base === 'satlive' ? 'satellite' : null;
    if (lowId) void loadBaseImage(lowId).then((im) => { low = im; render(); });
    if (hiOn) for (const t of HI_TILES) void loadImage(t.url).then((im) => { if (im) { hi.set(t.url, im); render(); } });
    for (const t of online) void loadTile(t.url).then((im) => { if (im) { tiles.set(t.url, im); render(); } });
    return () => { alive = false; };
  }, [base, size, view]);

  // Esc і клік поза вікном (і поза кнопкою) закривають вибір.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => { if (!open) ownForm(false); setOpen(!open); };
  const setupOwn = () => { setOpen(false); ownForm(true); };
  // Детальна онлайн-підкладка під густим полем погоди — каша: піднімаємо прозорість погоди до 70 %, якщо вона нижча.
  const choose = (id: BaseId) => {
    setBasemap(ONLINE.has(id) && wxTransp < ONLINE_TRANSP ? { base: id, wxTransp: ONLINE_TRANSP } : { base: id });
    if (id === 'own') setupOwn();
  };

  const image = IMAGE_BASES.has(base);
  return (
    <>
      <canvas ref={ref} className="basemap" aria-hidden="true" hidden={!image} />
      <p className="baseattr">{attribution(base, lang)}</p>
      <InBar>
        <button ref={btn} type="button" className="basebtn" title={tx.btn} aria-expanded={open} onClick={toggle}>
          <span className="tb-ico" aria-hidden="true">{ICON[base]}</span><span className="tb-txt">{tx.btn}</span>
        </button>
      </InBar>
      {open && (
        <section ref={panel} className="basepanel" aria-label={tx.menu}>
          <div role="radiogroup" aria-label={tx.menu} className="basegroup">
            {BASE_IDS.filter((id) => !ONLINE.has(id)).map((id) => (
              <label key={id}>
                <input type="radio" name="basemap" value={id} checked={base === id} onChange={() => choose(id)} />
                {BASE_NAME[lang][id]}
              </label>
            ))}
            <p className="baseonline">{tx.online}</p>
            {BASE_IDS.filter((id) => ONLINE.has(id)).map((id) => (
              <label key={id} className="online">
                <input type="radio" name="basemap" value={id} checked={base === id} onChange={() => choose(id)} />
                <span aria-hidden="true">{ICON[id]} </span>{BASE_NAME[lang][id]}
              </label>
            ))}
          </div>
          {ONLINE.has(base) && <p className="basewarn" role="note">⚠ {tx.warn}</p>}
          {image && (
            <label className="baseop">{tx.op}: {wxTransp}%
              <input type="range" min="0" max="100" step="5" aria-label={tx.op} value={wxTransp}
                onChange={(e) => setBasemap({ wxTransp: Number(e.target.value) })} />
            </label>
          )}
          {base === 'own' && <button type="button" className="baseown" onClick={setupOwn}><span aria-hidden="true">▦ </span>{tx.own}</button>}
          <button type="button" className="baseclose" onClick={() => setOpen(false)}>OK</button>
        </section>
      )}
    </>
  );
}

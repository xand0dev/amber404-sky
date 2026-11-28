// Issue #100 (SPEC §7.6a): підкладка під полем погоди — Без / Рельєф / Супутник / Своя карта (§7.14, F0 — як є).
// Окремий canvas під canvas.map у спільній проєкції (#64); вибір і прозорість — у localStorage; атрибуція — у куті карти.
// Issue #130: вибір відкриває кнопка «Підкладка» в ряду інструментів; кнопку форми «Своя карта» (Overlay, F0) ховає CSS,
// а форму відкриваємо її ж кліком лише після вибору «Своя карта». OK, Esc чи клік поза вікном закривають вибір.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../app/lang';
import { useView } from '../../app/view/view';
import { makeProjection } from '../../core';
import { InBar } from '../../ui/MapFrame';
import { attribution, BASE_IDS, BASE_NAME, imageAffine, type BaseId } from './basemaps';
import { loadBaseImage, setBasemap, useBasemap } from './basemapStore';
import './basemap.css';

const TXT = {
  uk: { btn: 'Підкладка', menu: 'Підкладка', op: 'Прозорість погоди', own: 'Файл і прив’язка' },
  en: { btn: 'Underlay', menu: 'Basemap', op: 'Weather transparency', own: 'File and anchors' },
};
const ICON: Record<BaseId, string> = { none: '∅', relief: '⛰', satellite: '🛰', own: '▦' };

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
    void loadBaseImage(base).then((img) => {
      const ctx = cv.getContext('2d');
      if (!alive || !img || !ctx || !W || !H) return;
      const m = imageAffine(makeProjection(W, H, view).affine, img.naturalWidth, img.naturalHeight);
      ctx.setTransform(dpr * m[0], dpr * m[3], dpr * m[1], dpr * m[4], dpr * m[2], dpr * m[5]);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0);
      cv.dataset.drawn = base;
    });
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
  const choose = (id: BaseId) => { setBasemap({ base: id }); if (id === 'own') setupOwn(); };

  const image = base === 'relief' || base === 'satellite';
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
            {BASE_IDS.map((id) => (
              <label key={id}>
                <input type="radio" name="basemap" value={id} checked={base === id} onChange={() => choose(id)} />
                {BASE_NAME[lang][id]}
              </label>
            ))}
          </div>
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

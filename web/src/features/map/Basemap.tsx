// Issue #100 (SPEC §7.6a): підкладка під полем погоди — Без / Рельєф / Супутник / Своя карта (§7.14, F0 — як є).
// Окремий canvas під canvas.map у спільній проєкції (#64); вибір і прозорість — у localStorage; атрибуція — у куті карти.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../app/lang';
import { useView } from '../../app/view/view';
import { makeProjection } from '../../core';
import { InBar } from '../../ui/MapFrame';
import { attribution, BASE_IDS, BASE_NAME, imageAffine, type BaseId } from './basemaps';
import { loadBaseImage, setBasemap, useBasemap } from './basemapStore';
import './basemap.css';

const TXT = {
  uk: { btn: 'Підкладка карти', menu: 'Підкладка', op: 'Прозорість погоди', own: 'Файл і прив’язка — кнопка ▦ «Підкладка»; прозорість — там само.' },
  en: { btn: 'Basemap', menu: 'Basemap', op: 'Weather transparency', own: 'File and anchors — the ▦ “Underlay” button; transparency is there too.' },
};
const ICON: Record<BaseId, string> = { none: '∅', relief: '⛰', satellite: '🛰', own: '▦' };

export function Basemap() {
  const ref = useRef<HTMLCanvasElement>(null);
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

  // Офлайн (AC5): обидва зображення читаються одразу — потрапляють у кеш service worker, а перемикання миттєве.
  useEffect(() => { void loadBaseImage('relief'); void loadBaseImage('satellite'); }, []);

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

  const image = base === 'relief' || base === 'satellite';
  return (
    <>
      <canvas ref={ref} className="basemap" aria-hidden="true" hidden={!image} />
      <p className="baseattr">{attribution(base, lang)}</p>
      <InBar slot="more">
        <button type="button" className="basebtn" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{ICON[base]} </span>{tx.btn}
        </button>
      </InBar>
      {open && (
        <section className="basepanel" aria-label={tx.menu}>
          <div role="radiogroup" aria-label={tx.menu} className="basegroup">
            {BASE_IDS.map((id) => (
              <label key={id}>
                <input type="radio" name="basemap" value={id} checked={base === id} onChange={() => setBasemap({ base: id })} />
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
          {base === 'own' && <p className="basenote">{tx.own}</p>}
          <button type="button" className="baseclose" onClick={() => setOpen(false)}>OK</button>
        </section>
      )}
    </>
  );
}

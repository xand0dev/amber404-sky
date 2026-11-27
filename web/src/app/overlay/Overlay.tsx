// Власна карта-підкладка (SPEC §7.14, F5-AC1): зображення + 3 точки прив'язки, окремий canvas під полем погоди.
// Файл користувача не покидає браузер: читається локально, зберігається в IndexedDB.
import { useEffect, useRef, useState } from 'react';
import { composeAffine, fitAffine, makeProjection, type Affine, type Anchor } from '../../core';
import { clearOverlay, loadOverlay, saveOverlay } from './store';

type Row = Record<keyof Anchor, string>;
interface Img { blob: Blob; el: HTMLImageElement; url: string }

const EMPTY: Row[] = [0, 1, 2].map(() => ({ x: '', y: '', lat: '', lon: '' }));
const TYPES = ['image/png', 'image/jpeg'];
const FIELDS: [keyof Anchor, string][] = [['x', 'x'], ['y', 'y'], ['lat', 'широта'], ['lon', 'довгота']];

const toAnchors = (rows: Row[]): Anchor[] =>
  rows.map((r) => ({ x: parseNum(r.x), y: parseNum(r.y), lat: parseNum(r.lat), lon: parseNum(r.lon) }));
const parseNum = (v: string) => (v.trim() === '' ? NaN : Number(v));
const toRows = (a: Anchor[]): Row[] => a.map((p) => ({ x: String(p.x), y: String(p.y), lat: String(p.lat), lon: String(p.lon) }));

function loadImage(blob: Blob): Promise<Img> {
  const url = URL.createObjectURL(blob);
  return new Promise((res, rej) => {
    const el = new Image();
    el.onload = () => res({ blob, el, url });
    el.onerror = () => { URL.revokeObjectURL(url); rej(new Error('не вдалося прочитати зображення')); };
    el.src = url;
  });
}

export function Overlay() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<Img | null>(null);
  const [rows, setRows] = useState<Row[]>(EMPTY);
  const [pick, setPick] = useState(0);
  const [opacity, setOpacity] = useState(50);
  const [fit, setFit] = useState<{ m: Affine; anchors: Anchor[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  // Відновлення з IndexedDB.
  useEffect(() => {
    let alive = true;
    void loadOverlay().then(async (v) => {
      if (!v || !alive) return;
      const im = await loadImage(v.image).catch(() => null);
      if (!im || !alive) return;
      const m = fitAffine(v.anchors);
      setImg(im); setRows(toRows(v.anchors)); setOpacity(v.opacity); setFit(m && { m, anchors: v.anchors });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  // Розмір шару = розмір mapwrap.
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

  // Прозорість поля погоди над підкладкою: CSS-змінна на mapwrap, MapView (F3) не змінюється.
  const shown = Boolean(img && fit);
  useEffect(() => {
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    wrap.style.setProperty('--wx-op', String(+(1 - opacity / 100).toFixed(2)));
    wrap.classList.toggle('has-underlay', shown);
    return () => { wrap.classList.remove('has-underlay'); };
  }, [opacity, shown]);

  // Малювання: піксель зображення → lat/lon (прив'язка) → екран (спільна проєкція), одним setTransform.
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const [W, H] = size, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    if (!img || !fit || !W || !H) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const m = composeAffine(makeProjection(W, H).affine, fit.m);
    ctx.setTransform(dpr * m[0], dpr * m[3], dpr * m[1], dpr * m[4], dpr * m[2], dpr * m[5]);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.el, 0, 0);
  }, [img, fit, size]);

  useEffect(() => {
    if (!img || !fit) return;
    void saveOverlay({ image: img.blob, anchors: fit.anchors, opacity }).then((ok) =>
      setNote(ok ? null : 'Не збережено: сховище браузера недоступне (приватне вікно?)'));
  }, [img, fit, opacity]);

  const setField = (i: number, k: keyof Anchor, v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) { setErr('Потрібне зображення PNG або JPG'); return; }
    try { setImg(await loadImage(f)); setFit(null); setErr(null); setPick(0); } catch (e) { setErr((e as Error).message); }
  };

  const onPick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!img) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * img.el.naturalWidth);
    const y = Math.round(((e.clientY - r.top) / r.height) * img.el.naturalHeight);
    setField(pick, 'x', String(x)); setField(pick, 'y', String(y));
    setPick((pick + 1) % 3);
  };

  const apply = () => {
    const anchors = toAnchors(rows), m = fitAffine(anchors);
    if (!m) { setErr('Потрібні 3 заповнені точки не на одній прямій'); return; }
    if (!img) { setErr('Спершу оберіть файл карти'); return; }
    setErr(null); setFit({ m, anchors });
  };

  const remove = () => {
    void clearOverlay();
    setImg(null); setFit(null); setRows(EMPTY); setPick(0); setErr(null); setNote(null);
  };

  return (
    <>
      <canvas ref={ref} className="underlay" aria-hidden="true" />
      <button type="button" className="ovbtn" aria-expanded={open} onClick={() => setOpen(!open)}>Підкладка</button>
      {open && (
        <section className="ovpanel" aria-label="Власна карта-підкладка">
          <label>Файл карти
            <input type="file" accept={TYPES.join(',')} onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <p className="ovnote">Файл не покидає браузер: зберігається лише на цьому пристрої.</p>
          {img && (
            <div className="ovprev">
              <img src={img.url} alt={`Карта користувача; клацніть, щоб поставити точку ${pick + 1}`} onClick={onPick} />
              {rows.map((r, i) => r.x !== '' && r.y !== '' && (
                <span key={i} className="ovmark" style={{ left: `${(Number(r.x) / img.el.naturalWidth) * 100}%`, top: `${(Number(r.y) / img.el.naturalHeight) * 100}%` }}>{i + 1}</span>
              ))}
            </div>
          )}
          {rows.map((r, i) => (
            <fieldset key={i} className={i === pick ? 'ovrow on' : 'ovrow'}>
              <legend><button type="button" onClick={() => setPick(i)}>Точка {i + 1}</button></legend>
              {FIELDS.map(([k, name]) => (
                <label key={k}>{name}
                  <input type="number" step="any" inputMode="decimal" aria-label={`Точка ${i + 1}: ${name}`}
                    value={r[k]} onChange={(e) => setField(i, k, e.target.value)} />
                </label>
              ))}
            </fieldset>
          ))}
          <label>Прозорість погоди: {opacity}%
            <input type="range" min="0" max="100" step="5" aria-label="Прозорість погоди"
              value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
          </label>
          <p className="ovnote">assumption: афінна прив'язка за 3 точками — точна лише для невеликої ділянки (десятки км).</p>
          {err && <p role="alert" className="overr">{err}</p>}
          {note && <p className="overr">{note}</p>}
          <div className="ovact">
            <button type="button" onClick={apply}>Накласти</button>
            <button type="button" onClick={remove}>Прибрати</button>
          </div>
        </section>
      )}
    </>
  );
}

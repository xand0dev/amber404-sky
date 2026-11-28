// Малювання на карті (SPEC §7.13, F3-AC8): точка з підписом, лінія, стрілка, область, текст — окремий SVG над полем погоди.
// Загальні позначки, без тактичних знаків і без шару цілей (Конституція 8). Лише localStorage, експорт/імпорт — файлами в браузері.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fromGeoJSON, makeProjection, newId, toGeoJSON, toKML, type Key, type Shape, type ShapeKind } from '../../core';
import { useT } from '../lang';
import { useView } from '../view/view';
import { InBar } from '../../ui/MapFrame';
import { draw, initDraw, loadShapes, saveShapes } from './store';
import './draw.css';

const TOOLS: ShapeKind[] = ['point', 'line', 'arrow', 'area', 'text'];
const COLORS: [string, Key][] = [
  ['#e2a72e', 'col.amber'], ['#e0532f', 'col.red'], ['#8cbf4f', 'col.green'],
  ['#4fb3e0', 'col.blue'], ['#ffffff', 'col.white'], ['#11150e', 'col.black'],
];
const MIN: Record<ShapeKind, number> = { point: 1, text: 1, line: 2, arrow: 2, area: 3 };
const multi = (k: ShapeKind | null) => k === 'line' || k === 'arrow' || k === 'area';

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Draw() {
  const ref = useRef<SVGSVGElement>(null);
  const [st, dispatch] = useReducer(draw, undefined, () => initDraw(loadShapes()));
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<ShapeKind | null>(null);
  const [color, setColor] = useState(COLORS[0][0]);
  const [label, setLabel] = useState('');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const { view } = useView();
  const { t } = useT();
  const name = (k: ShapeKind) => t(`draw.${k}`);

  // Запис у localStorage на кожну зміну фігур (ідемпотентний); false — сховище недоступне.
  const stored = useMemo(() => saveShapes(st.shapes), [st.shapes]);

  // Розмір шару = розмір mapwrap; та сама проєкція, що в MapView (F3) і підкладці.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => { const r = el.getBoundingClientRect(); setSize([r.width, r.height]); };
    upd();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', upd); return () => window.removeEventListener('resize', upd); }
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const finish = () => {
    if (!tool || !multi(tool) || !draft.length) return;
    if (draft.length < MIN[tool]) setErr(t('draw.min', { tool: name(tool), n: MIN[tool] }));
    else { dispatch({ type: 'add', shape: { id: newId(), kind: tool, color, coords: draft } }); setErr(null); }
    setDraft([]);
  };

  const pickTool = (k: ShapeKind) => {
    if (multi(tool) && draft.length >= MIN[tool!]) finish(); else setDraft([]);
    setTool(tool === k ? null : k); setErr(null);
  };

  const onTap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!tool) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const ll = makeProjection(r.width, r.height, view).unproject(e.clientX - r.left, e.clientY - r.top);
    if (multi(tool)) { setDraft((d) => [...d, ll]); return; }
    const text = label.trim();
    if (tool === 'text' && !text) { setErr(t('draw.needText')); return; }
    dispatch({ type: 'add', shape: { id: newId(), kind: tool, color, coords: [ll], ...(text ? { label: text } : {}) } });
    setErr(null);
  };

  const undo = () => { if (draft.length) setDraft((d) => d.slice(0, -1)); else dispatch({ type: 'undo' }); };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const shapes = fromGeoJSON(JSON.parse(await f.text()));
      if (!shapes.length) { setErr(t('draw.empty')); return; }
      dispatch({ type: 'import', shapes }); setErr(null);
    } catch (e) {
      setErr(e instanceof SyntaxError ? t('draw.notJson') : (e as Error).message);
    }
  };

  const [W, H] = size;
  const pr = W && H ? makeProjection(W, H, view) : null;
  const pts = (cs: [number, number][]) => cs.map(([la, lo]) => pr!.project(la, lo).map((v) => v.toFixed(1)).join(',')).join(' ');
  const xy = (c: [number, number]) => pr!.project(c[0], c[1]);

  const render = (s: Shape) => {
    if (s.kind === 'area') return <polygon key={s.id} points={pts(s.coords)} stroke={s.color} fill={s.color} fillOpacity={0.2} strokeWidth={2} />;
    if (s.kind === 'line' || s.kind === 'arrow') {
      return <polyline key={s.id} points={pts(s.coords)} stroke={s.color} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        markerEnd={s.kind === 'arrow' ? `url(#ah-${s.id})` : undefined} />;
    }
    const [x, y] = xy(s.coords[0]);
    return (
      <g key={s.id}>
        {s.kind === 'point' && <circle cx={x} cy={y} r={6} fill={s.color} stroke="#11150e" strokeWidth={1.5} />}
        {s.label && <text x={s.kind === 'point' ? x + 9 : x} y={s.kind === 'point' ? y + 5 : y} fill={s.color}
          textAnchor={s.kind === 'text' ? 'middle' : 'start'} className={s.kind === 'text' ? 'drawtext big' : 'drawtext'}>{s.label}</text>}
      </g>
    );
  };

  return (
    <>
      <svg ref={ref} className={tool ? 'drawlayer drawing' : 'drawlayer'} onClick={onTap}
        role={tool ? 'application' : undefined} aria-label={tool ? t('draw.on', { tool: name(tool) }) : undefined} aria-hidden={tool ? undefined : true}>
        <defs>
          {st.shapes.filter((s) => s.kind === 'arrow').map((s) => (
            <marker key={s.id} id={`ah-${s.id}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={s.color} />
            </marker>
          ))}
        </defs>
        {pr && st.shapes.map(render)}
        {pr && draft.length > 0 && (
          <g className="drawdraft">
            <polyline points={pts(tool === 'area' && draft.length > 2 ? [...draft, draft[0]] : draft)} stroke={color} fill="none" strokeWidth={2} strokeDasharray="6 4" />
            {draft.map((c, i) => { const [x, y] = xy(c); return <circle key={i} cx={x} cy={y} r={4} fill={color} />; })}
          </g>
        )}
      </svg>
      <InBar>
        <button type="button" className="drawbtn" title={t('draw.btn')} aria-expanded={open} onClick={() => { if (open) { finish(); setTool(null); } setOpen(!open); }}>
          <span className="tb-ico" aria-hidden="true">✎</span><span className="tb-txt">{t('draw.btn')}</span>
        </button>
      </InBar>
      {open && (
        // Поки інструмент обрано, панель згорнута в один рядок, щоб карта під нею лишалась доступною для дотиків.
        <section className={tool ? 'drawpanel active' : 'drawpanel'} aria-label={t('draw.panel')}>
          <div className="drawtools" role="group" aria-label={t('draw.tools')}>
            {TOOLS.map((k) => <button key={k} type="button" aria-pressed={tool === k} onClick={() => pickTool(k)}>{name(k)}</button>)}
          </div>
          <div className="drawrow">
            <label><span className="drawlbl">{t('draw.color')}</span>
              <select value={color} onChange={(e) => setColor(e.target.value)}>
                {COLORS.map(([v, n]) => <option key={v} value={v}>{t(n)}</option>)}
              </select>
            </label>
            <label><span className="drawlbl">{t('draw.label')}</span>
              <input type="text" maxLength={80} value={label} placeholder={t('draw.labelPh')} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          <p className="ovnote">
            {tool ? t(multi(tool) ? 'draw.hintMulti' : 'draw.hintOne', { tool: name(tool) }) : t('draw.pick')}
            {' '}{t('draw.local')}
          </p>
          <div className="ovact">
            <button type="button" onClick={finish} disabled={!draft.length}>{t('draw.done')}</button>
            <button type="button" onClick={undo} disabled={!draft.length && !st.past.length}>{t('draw.undo')}</button>
            {tool && <button type="button" aria-label={t('draw.close')} onClick={() => { finish(); setTool(null); }}>✕</button>}
          </div>
                    <div className="drawmore">
            {st.shapes.length > 0 && (
              <ul className="drawlist">
                {st.shapes.map((s) => {
                  const what = `${name(s.kind).toLowerCase()}${s.label ? ` «${s.label}»` : ''}`;
                  return (
                    <li key={s.id}>
                      <span className="drawsw" style={{ background: s.color }} aria-hidden="true" />{what}
                      <button type="button" aria-label={t('draw.delWhat', { what })} onClick={() => dispatch({ type: 'remove', id: s.id })}>{t('draw.del')}</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="ovact">
              <button type="button" disabled={!st.shapes.length}
                onClick={() => download('amber-sky-drawings.geojson', 'application/geo+json', JSON.stringify(toGeoJSON(st.shapes), null, 1))}>{t('draw.expGeo')}</button>
              <button type="button" disabled={!st.shapes.length}
                onClick={() => download('amber-sky-drawings.kml', 'application/vnd.google-earth.kml+xml', toKML(st.shapes))}>{t('draw.expKml')}</button>
            </div>
            <label>{t('draw.imp')}
              <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {err && <p role="alert" className="overr">{err}</p>}
          {!stored && <p className="overr">{t('store.off')}</p>}
        </section>
      )}
    </>
  );
}

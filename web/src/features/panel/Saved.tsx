// F4 (Оля): «Зберегти погоду» і «Копіювати звіт» (F4-AC4, issue #18). Лише в браузері — на сервер нічого не йде.
import { useState } from 'react';
import { useT } from '../../app/lang';
import type { Lang } from '../../core';
import { addSaved, copyText, kyivStamp, loadSaved, persist, removeSaved, reportText, type SavedWx } from './savedStore';
import { pt } from './strings';

export interface SavedViewProps {
  list: SavedWx[]; lang: Lang; msg: { ok: boolean; text: string } | null; fallback: string | null;
  onSave: () => void; onCopy: (e: SavedWx | null) => void; onDelete: (id: string) => void; onClear: () => void;
}

export function SavedView({ list, lang, msg, fallback, onSave, onCopy, onDelete, onClear }: SavedViewProps) {
  const L = (k: Parameters<typeof pt>[0], p?: Record<string, string | number>) => pt(k, lang, p);
  return (
    <section className="psec" aria-label={L('save')}>
      <div className="pbtns">
        <button type="button" onClick={onSave}>{L('save')}</button>
        <button type="button" onClick={() => onCopy(null)}>{L('copy')}</button>
      </div>
      {msg && <p className={msg.ok ? 'pok' : 'perr'} role="status">{msg.text}</p>}
      {fallback && <textarea className="report" readOnly value={fallback} aria-label={L('copy')} onFocus={(e) => e.currentTarget.select()} />}
      {list.length > 0 && (
        <>
          <h3 style={{ marginTop: 10 }}>{L('saved', { n: list.length })}</h3>
          <ul className="saved" data-testid="saved-list">
            {list.map((e) => (
              <li key={e.id} className={`lv-${e.level}`}>
                <span className="txt">
                  <b>{e.place}</b> · {kyivStamp(e.time)} · {e.altM} {L('unit.m')} · {e.drone}<br />
                  {e.ws == null ? '—' : e.ws.toFixed(1)} {L('unit.ms')} · {e.level}
                </span>
                <span className="pbtns">
                  <button type="button" aria-label={`${L('copy')}: ${e.place}`} onClick={() => onCopy(e)}>⧉</button>
                  <button type="button" aria-label={`${L('del')}: ${e.place}`} onClick={() => onDelete(e.id)}>✕</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="pbtns" style={{ marginTop: 6 }}><button type="button" onClick={onClear}>{L('clear')}</button></div>
        </>
      )}
    </section>
  );
}

/** current() — знімок поточної точки (місце, висота, година, значення, вердикт). */
export function Saved({ current }: { current: () => SavedWx }) {
  const { lang } = useT();
  const [list, setList] = useState<SavedWx[]>(() => loadSaved());
  const [msg, setMsg] = useState<SavedViewProps['msg']>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const update = (l: SavedWx[]) => { setList(l); persist(l); };
  return (
    <SavedView list={list} lang={lang} msg={msg} fallback={fallback}
      onSave={() => { const next = addSaved(list, current()); update(next); setMsg({ ok: true, text: pt('saved', lang, { n: next.length }) }); }}
      onCopy={(e) => {
        const entry = e ?? current();
        const text = reportText(entry, lang, kyivStamp(entry.time));
        void copyText(text).then((ok) => {
          setMsg({ ok, text: pt(ok ? 'copied' : 'copyFail', lang) });
          setFallback(ok ? null : text);
        });
      }}
      onDelete={(id) => update(removeSaved(list, id))}
      onClear={() => { update([]); setMsg(null); }} />
  );
}

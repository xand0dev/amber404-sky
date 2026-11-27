// F4 (Оля): таблиця «висоти × години» (F4-AC2, issue #16) — число м/с і стрілка напряму, червона рамка понад ліміт,
// штрихування в хмарі, клік по клітинці міняє годину й висоту. Клавіатура: одна клітинка в Tab, стрілки — сусідні.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { kyivHM, type Lang } from '../../core';
import type { DroneProfile } from '../../contracts';
import { arrowDeg } from './place';
import { heightsTable, pageStart, TABLE_HOURS, type HCell } from './heights';
import { pt } from './strings';

/** Колір клітинки — частка ліміту вітру дрона: < 80% — GO, ≤ 100% — CAUTION; понад ліміт — темне тло, щоб червону рамку було видно. */
export function cellColor(ws: number | null, limit: number): string {
  if (ws == null) return 'var(--rule)';
  if (ws > limit) return 'var(--base)';
  if (ws > 0.8 * limit) return 'var(--cau)';
  return 'var(--go)';
}

export interface HeightTableViewProps {
  cells: HCell[][]; times: string[]; limit: number; hour: number; altM: number; total: number;
  onPick: (hour: number, altM: number) => void; onPage: (start: number) => void; lang: Lang;
}

export function HeightTableView({ cells, times, limit, hour, altM, total, onPick, onPage, lang }: HeightTableViewProps) {
  const L = (k: Parameters<typeof pt>[0], p?: Record<string, string | number>) => pt(k, lang, p);
  const ref = useRef<HTMLTableElement>(null);
  const cols = cells[0]?.length ?? 0;
  const start = cells[0]?.[0]?.hour ?? 0;
  // Клітинка в Tab: обрана (година + найближча висота) або перша.
  const fc = Math.max(0, Math.min(cols - 1, hour - start));
  let fr = 0, bestD = Infinity;
  cells.forEach((row, r) => { const d = Math.abs(row[0].altM - altM); if (d < bestD) { bestD = d; fr = r; } });
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [cr, cc] = focus ?? [fr, fc];

  const move = (e: KeyboardEvent, r: number, c: number) => {
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    const nr = Math.max(0, Math.min(cells.length - 1, r + v[0])), nc = Math.max(0, Math.min(cols - 1, c + v[1]));
    setFocus([nr, nc]);
    ref.current?.querySelector<HTMLButtonElement>(`[data-rc="${nr}-${nc}"]`)?.focus();
  };

  return (
    <section className="psec heights" aria-label={L('tbl')}>
      <h3>{L('tbl')}</h3>
      {total > TABLE_HOURS && (
        <div className="pbtns">
          <button type="button" aria-pressed={start === 0} onClick={() => onPage(0)}>{L('tbl.prev')}</button>
          <button type="button" aria-pressed={start > 0} onClick={() => onPage(TABLE_HOURS)}>{L('tbl.next')}</button>
        </div>
      )}
      <div className="hgrid">
        <table ref={ref} aria-label={L('tbl.aria')}>
          <thead>
            <tr><th scope="col">м</th>{cells[0]?.map((x) => <th key={x.hour} scope="col">{kyivHM(times[x.hour]).slice(0, 2)}</th>)}</tr>
          </thead>
          <tbody>
            {cells.map((row, r) => (
              <tr key={row[0].altM}>
                <th scope="row">{row[0].altM}</th>
                {row.map((x, c) => {
                  const on = x.hour === hour && x.altM === altM;
                  const v = x.ws == null ? '—' : `${x.ws.toFixed(1)} ${L('unit.ms')}${x.dir != null ? ` ${L('wind.from', { dir: x.dir.toFixed(0) })}` : ''}`;
                  const extra = [x.over ? L('tbl.over') : '', x.cloud ? L('tbl.inCloud') : ''].filter(Boolean).join(', ');
                  return (
                    <td key={x.hour}>
                      <button type="button" data-rc={`${r}-${c}`} data-testid="hcell"
                        className={`cell${x.over ? ' over' : ''}${x.cloud ? ' cloud' : ''}${on ? ' on' : ''}`}
                        style={{ backgroundColor: cellColor(x.ws, limit) }}
                        tabIndex={r === cr && c === cc ? 0 : -1} aria-pressed={on}
                        aria-label={L('tbl.cell', { alt: x.altM, time: kyivHM(times[x.hour]), v: extra ? `${v}, ${extra}` : v })}
                        onClick={() => { setFocus([r, c]); onPick(x.hour, x.altM); }} onKeyDown={(e) => move(e, r, c)}>
                        <span>{x.ws == null ? '—' : Math.round(x.ws)}</span>
                        {x.dir != null && x.ws != null && <span className="a" aria-hidden="true" style={{ transform: `rotate(${arrowDeg(x.dir)}deg)` }}>↑</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pnote">{L('tbl.legend')}</p>
    </section>
  );
}

export function HeightTable({ prof }: { prof: DroneProfile }) {
  const { data, s, set } = useApp();
  const { lang } = useT();
  const total = data.meta.times.length;
  const start = pageStart(s.hour, total);
  const cells = useMemo(() => {
    const src = { meta: data.meta, profile: data.profile, kp: data.kp, galileo: data.galileo };
    return heightsTable(src, s.lat, s.lon, prof, start);
  }, [data, s.lat, s.lon, prof, start]);
  return (
    <HeightTableView cells={cells} times={data.meta.times} limit={prof.windMs} hour={s.hour} altM={s.altM} total={total} lang={lang}
      onPick={(hour, altM) => set({ hour, altM })} onPage={(h) => set({ hour: h })} />
  );
}

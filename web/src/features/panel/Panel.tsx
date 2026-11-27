// F4 (Оля): панель точки — дрон, висота, значення, причини. Маршрут і зона — задачі F4.
import { useApp } from '../../app/state';
import { useVerdicts } from '../../app/useVerdict';
import { Route } from '../route/Route';

const n = (x: number | null, d = 1) => (x == null ? '—' : x.toFixed(d));

export function Panel() {
  const { data, s, set } = useApp();
  const { wx, now } = useVerdicts();
  return (
    <section className="panel" aria-label="Точка">
      <div className="row">
        <label>Дрон
          <select value={s.droneId} onChange={(e) => { const p = data.profiles.find((x) => x.id === e.target.value); set({ droneId: e.target.value, altM: p?.defaultAltM ?? s.altM }); }}>
            {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Висота: <b>{s.altM} м</b>
          <input type="range" min={10} max={1000} step={10} value={s.altM} onChange={(e) => set({ altM: Number(e.target.value) })} />
        </label>
      </div>
      <dl className="vals">
        <div><dt>Вітер</dt><dd>{n(wx.ws)} м/с · {n(wx.dir, 0)}°</dd></div>
        <div><dt>Пориви</dt><dd>{n(wx.g)} м/с</dd></div>
        <div><dt>Хмари від</dt><dd>{n(wx.cb, 0)} м</dd></div>
        <div><dt>Темп.</dt><dd>{n(wx.t)} °C</dd></div>
        <div><dt>Kp</dt><dd>{n(wx.kp)}</dd></div>
        <div><dt>Galileo</dt><dd>{wx.galVisible ?? '—'} · PDOP {n(wx.galPdop)}</dd></div>
      </dl>
      <ul className="reasons">{now.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="coord">{s.lat.toFixed(3)}, {s.lon.toFixed(3)} · ліміти дронів — assumption</p>
      <Route />
    </section>
  );
}

// F3: легенда шару зі шкалою SPEC §7.6 — колір і текст (§7.10).
import { useApp } from '../../app/state';
import { LAYERS } from './LayerPicker';
import { SCALES, css, layerRGBA } from './colors';
import './legend.css';

const num = (x: number) => String(x).replace('-', '−');

export function Legend() {
  const { s } = useApp();
  const sc = SCALES[s.layer];
  const name = LAYERS.find(([id]) => id === s.layer)?.[1] ?? s.layer;
  const title = s.layer === 'wind' ? `${name} · ${s.altM} м` : name;
  return (
    <figure className="legend" aria-label={`Легенда: ${title}`}>
      <figcaption className="lg-title">{title}</figcaption>
      {sc.kind === 'ramp' ? (
        // Смужка в один рядок (issue #85): мінімум · градієнт · максимум з одиницею; середину ховає CSS, щоб не тіснити смужку.
        <div className="lg-ramp">
          <span className="lg-lo">{num(sc.min)}</span>
          <div className="lg-bar" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => css(layerRGBA(s.layer, sc.min + (sc.max - sc.min) * t))).join(',')})` }} />
          <span className="lg-mid">{num((sc.min + sc.max) / 2)}</span>
          <span className="lg-hi">{`${num(sc.max)} ${sc.unit}`}</span>
        </div>
      ) : (
        <ul className="lg-classes">
          {sc.items.map((i) => <li key={String(i.value)}><i style={{ background: css(i.rgba) }} aria-hidden="true" />{i.text}</li>)}
        </ul>
      )}
    </figure>
  );
}

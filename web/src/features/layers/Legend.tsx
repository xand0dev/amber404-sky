// F3: легенда шару зі шкалою SPEC §7.6 — колір і текст (§7.10).
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import type { Key } from '../../core';
import { SCALES, css, layerRGBA, type Scale } from './colors';
import './legend.css';

const num = (x: number) => String(x).replace('-', '−');
// Одиниці й класи шкали (colors.ts, українською) → ключі i18n (issue #119).
const UNIT: Record<string, Key> = { 'м/с': 'unit.ms', 'м': 'unit.m', 'км': 'unit.km' };
type Item = Extract<Scale, { kind: 'classes' }>['items'][number];
const itemKey = (i: Item): Key => (typeof i.value === 'string' ? `lv.${i.value}` as Key : i.value ? 'icing.yes' : 'icing.no');

export function Legend() {
  const { s } = useApp();
  const { t } = useT();
  const sc = SCALES[s.layer];
  const name = t(`layer.${s.layer}`);
  const title = s.layer === 'wind' ? `${name} · ${s.altM} ${t('unit.m')}` : name;
  return (
    <figure className="legend" aria-label={t('legend', { title })}>
      <figcaption className="lg-title">{title}</figcaption>
      {sc.kind === 'ramp' ? (
        // Смужка в один рядок (issue #85): мінімум · градієнт · максимум з одиницею; середину ховає CSS, щоб не тіснити смужку.
        <div className="lg-ramp">
          <span className="lg-lo">{num(sc.min)}</span>
          <div className="lg-bar" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => css(layerRGBA(s.layer, sc.min + (sc.max - sc.min) * t))).join(',')})` }} />
          <span className="lg-mid">{num((sc.min + sc.max) / 2)}</span>
          <span className="lg-hi">{`${num(sc.max)} ${UNIT[sc.unit] ? t(UNIT[sc.unit]) : sc.unit}`}</span>
        </div>
      ) : (
        <ul className="lg-classes">
          {sc.items.map((i) => <li key={String(i.value)}><i style={{ background: css(i.rgba) }} aria-hidden="true" />{t(itemKey(i))}</li>)}
        </ul>
      )}
    </figure>
  );
}

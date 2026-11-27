// F3-AC6: підказка біля курсора. У правій / нижній половині карти — з іншого боку курсора,
// ширина обмежена місцем до краю, тож за карту не вилазить (400 px без горизонтального скролу).
import type { CSSProperties } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { hoverInfo, hoverRows } from './hover';
import './hover.css';

export interface HoverPos { x: number; y: number; lat: number; lon: number; W: number; H: number }
const GAP = 14;

export function HoverTip({ at }: { at: HoverPos }) {
  const { data, s } = useApp();
  const { lang } = useT();
  const info = hoverInfo(data, s, at.lat, at.lon, lang);
  if (!info) return null;
  const flipX = at.x > at.W / 2, flipY = at.y > at.H / 2;
  const style: CSSProperties = {
    ...(flipX ? { right: at.W - at.x + GAP } : { left: at.x + GAP }),
    ...(flipY ? { bottom: at.H - at.y + GAP } : { top: at.y + GAP }),
    maxWidth: Math.min(260, (flipX ? at.x : at.W - at.x) - GAP - 4),
  };
  return (
    <div role="tooltip" className={`hovertip lv-${info.level}-tip`} style={style}>
      <dl>{hoverRows(info, lang, s.altM).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}

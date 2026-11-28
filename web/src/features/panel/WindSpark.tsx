// Issue #171 AC3: міні-графік вітру на 12 год на обраній висоті — лінія вітру, лінія ліміту дрона,
// години зафарбовані за вердиктом (МОЖНА / ОБЕРЕЖНО / НЕ МОЖНА). Модель — spark.ts.
import { kyivHM, type Lang } from '../../core';
import { SPARK, type SparkModel } from './spark';
import { pt } from './strings';

export interface WindSparkViewProps { model: SparkModel; times: string[]; hour: number; limit: number; altM: number; lang: Lang }

export function WindSparkView({ model, times, hour, limit, altM, lang }: WindSparkViewProps) {
  const { segs, bands, limitY, max } = model;
  const first = bands[0], last = bands[bands.length - 1];
  if (!first) return null;
  const hm = (h: number) => kyivHM(times[h] ?? '');
  return (
    <figure className="spark">
      <figcaption>{pt('spark', lang, { alt: altM })}</figcaption>
      <svg viewBox={`0 0 ${SPARK.w} ${SPARK.h}`} preserveAspectRatio="none" role="img"
        aria-label={pt('spark.aria', lang, { alt: altM, max: max.toFixed(1), lim: limit })}>
        {bands.map((b) => (
          <rect key={b.hour} className={`sp-b sp-${b.level}${b.hour === hour ? ' on' : ''}`} data-level={b.level} data-hour={b.hour}
            x={b.x} y={SPARK.top} width={b.w} height={SPARK.h - SPARK.top - SPARK.bottom} />
        ))}
        <line className="sp-lim" x1={0} x2={SPARK.w} y1={limitY} y2={limitY} />
        {segs.map((s, i) => <polyline key={i} className="sp-line" points={s.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />)}
      </svg>
      <div className="spaxis" data-testid="spark-axis">
        <span>{hm(first.hour)}</span><span className="splim">{pt('spark.lim', lang, { lim: limit })}</span><span>{hm(last.hour)}</span>
      </div>
    </figure>
  );
}

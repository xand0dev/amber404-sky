// F4 (Оля): висота місцевості й плашка «гори» в панелі точки (issue #101, SPEC §7.6a).
import { useEffect, useState } from 'react';
import type { Lang } from '../../core';
import { isMountain, loadRelief, type ReliefGrid, type Terrain } from './relief';
import { pt } from './strings';

export function TerrainView({ terrain, range, lang }: { terrain: Terrain; range: number | null; lang: Lang }) {
  const L = (k: Parameters<typeof pt>[0], p?: Record<string, string | number>) => pt(k, lang, p);
  const val = terrain.kind === 'land' ? L('terrain.val', { m: Math.round(terrain.elevM) })
    : terrain.kind === 'sea' ? L('terrain.sea') : L('terrain.nodata');
  return (
    <div className="terrain" data-testid="terrain">
      <p><span>{L('terrain')}</span> <b data-testid="terrain-val">{val}</b> · {L('terrain.agl')}</p>
      {isMountain(range) && (
        <p className="mtn" role="note" data-testid="terrain-mtn">
          <b>assumption</b> · {L('terrain.mtn')} ({L('terrain.range', { m: Math.round(range as number) })})
        </p>
      )}
    </div>
  );
}

// Один запит на сесію: файл статичний і однаковий для всіх.
let cached: Promise<ReliefGrid | null> | null = null;
export function resetReliefCache() { cached = null; }

/** Сітка висот; null, поки вантажиться або якщо файлу немає. */
export function useRelief(): ReliefGrid | null {
  const [g, setG] = useState<ReliefGrid | null>(null);
  useEffect(() => {
    let alive = true;
    cached ??= loadRelief();
    void cached.then((v) => { if (alive) setG(v); });
    return () => { alive = false; };
  }, []);
  return g;
}

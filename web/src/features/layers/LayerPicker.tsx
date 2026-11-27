// F3: перемикач шарів (SPEC §7.6).
import { useApp, type LayerId } from '../../app/state';
import { useT } from '../../app/lang';
import { DICT } from '../../core';

const IDS: LayerId[] = ['wind', 'go', 'gust', 'cloud', 'icing', 'temp', 'vis'];
/** Назви шарів українською (штамп знімка); мовою інтерфейсу — t(`layer.${id}`) (issue #119). */
export const LAYERS: [LayerId, string][] = IDS.map((id) => [id, DICT.uk[`layer.${id}`]]);

export function LayerPicker() {
  const { s, set } = useApp();
  const { t } = useT();
  return (
    <div className="layers" role="radiogroup" aria-label={t('layer.group')}>
      {IDS.map((id) => (
        <button key={id} role="radio" aria-checked={s.layer === id} className={s.layer === id ? 'on' : ''} onClick={() => set({ layer: id })}>{t(`layer.${id}`)}</button>
      ))}
    </div>
  );
}

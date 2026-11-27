// F3: перемикач шарів (SPEC §7.6).
import { useApp, type LayerId } from '../../app/state';

export const LAYERS: [LayerId, string][] = [['wind', 'Вітер'], ['go', 'Можна летіти'], ['gust', 'Пориви'], ['cloud', 'Хмари'], ['icing', 'Обмерзання'], ['temp', 'Темп.'], ['vis', 'Видимість']];

export function LayerPicker() {
  const { s, set } = useApp();
  return (
    <div className="layers" role="radiogroup" aria-label="Шар карти">
      {LAYERS.map(([id, name]) => (
        <button key={id} role="radio" aria-checked={s.layer === id} className={s.layer === id ? 'on' : ''} onClick={() => set({ layer: id })}>{name}</button>
      ))}
    </div>
  );
}

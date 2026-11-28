// Issue #166 AC1: заставка поки вантажаться дані — логотип AMBER Sky (бурштинове коло, як іконка PWA) і лінії вітру.
// Показуємо лише якщо дані йдуть довше SPLASH_DELAY_MS (без мигання); коли карта готова — плавний fade.
// Анімація — CSS (splash.css); prefers-reduced-motion — без анімацій.
import { useEffect, useState } from 'react';
import { useT } from '../lang';
import { SPLASH_DELAY_MS, SPLASH_FADE_MS, splashNext, type SplashPhase } from '../../core/tour';
import './splash.css';

export function Splash({ ready }: { ready: boolean }) {
  const { t } = useT();
  const [phase, setPhase] = useState<SplashPhase>(ready ? 'gone' : 'wait');
  // «Карта готова» — під час рендеру (а не в ефекті), щоб не було зайвого кадру заставки.
  const [wasReady, setWasReady] = useState(ready);
  if (ready !== wasReady) {
    setWasReady(ready);
    if (ready) setPhase(splashNext(phase, 'ready'));
  }
  useEffect(() => {
    const id = setTimeout(() => setPhase((p) => splashNext(p, 'delay')), SPLASH_DELAY_MS);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (phase !== 'fade') return;
    const id = setTimeout(() => setPhase((p) => splashNext(p, 'faded')), SPLASH_FADE_MS);
    return () => clearTimeout(id);
  }, [phase]);
  if (phase === 'wait' || phase === 'gone') return null;
  return (
    <div className={phase === 'fade' ? 'splash fade' : 'splash'} role="status" aria-live="polite">
      <svg className="sp-logo" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="sp-sun" cx="60" cy="60" r="44" />
        <path className="sp-mark" d="M60 30 L84 82 H36 Z M50 62 H70 L72 67 H48 Z" fillRule="evenodd" />
        <g className="sp-wind">
          <path d="M4 40 C30 32 50 48 76 40 S108 34 116 38" />
          <path d="M10 64 C36 56 58 72 84 64 S110 58 118 62" />
          <path d="M2 88 C28 80 48 96 74 88 S104 82 114 86" />
        </g>
      </svg>
      <p className="sp-name">AMBER Sky</p>
      <p className="sp-msg">{t('boot.loading')}</p>
    </div>
  );
}

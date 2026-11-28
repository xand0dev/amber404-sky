// Issue #192: прості inline-SVG іконки замість емодзі в кнопках. Лінія currentColor — колір від кнопки (день/ніч),
// aria-hidden — доступне ім'я дає підпис чи aria-label кнопки, а не іконка.

export type IconName = 'camera' | 'relief' | 'none' | 'satellite' | 'grid' | 'map' | 'play' | 'pause' | 'warn';

const PATH: Record<IconName, string> = {
  camera: 'M3 8h4l2-3h6l2 3h4v11H3z M12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7',
  relief: 'M2 20l7-12 4 6 3-4 6 10z',
  none: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M5.6 18.4L18.4 5.6',
  satellite: 'M9 9l6 6 M10 6l8 8-4 4-8-8z M7 3L3 7l3 3 4-4z M21 17l-4 4-3-3 4-4z M6 21a3 3 0 0 1-3-3',
  grid: 'M4 4h16v16H4z M4 9.3h16 M4 14.7h16 M9.3 4v16 M14.7 4v16',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4v16 M17 4v16',
  warn: 'M12 3l10 18H2z M12 10v5 M12 17.5v.5',
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-icon={name}>
      <path d={PATH[name]} />
    </svg>
  );
}

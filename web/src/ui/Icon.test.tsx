// Issue #192: іконки — inline-SVG без емодзі, лінія currentColor, приховані від читача екрана, 16–20 px.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, type IconName } from './Icon';

const NAMES: IconName[] = ['camera', 'relief', 'none', 'satellite', 'grid', 'map', 'play', 'pause', 'warn'];

describe('Icon', () => {
  it.each(NAMES)('Given %s When рендер Then svg aria-hidden, stroke currentColor, 18 px, без тексту', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.querySelector('path')!.getAttribute('d')).toMatch(/^M/);
    expect(container.textContent).toBe('');
  });
});

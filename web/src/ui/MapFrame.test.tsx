// Issue #85 (F3, мобільний екран): тонкий ряд інструментів над картою, меню «⋯», карта окремо від смуги шарів.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InBar, MapFrame, useMapWrap } from './MapFrame';
import { LANG_KEY, LangProvider } from '../app/lang';

afterEach(cleanup);

function WrapProbe() {
  const wrap = useMapWrap();
  return <span data-testid="probe">{wrap?.className ?? 'none'}</span>;
}

const mount = () => render(
  <MapFrame>
    <canvas className="map" />
    <InBar><button type="button">Малювання</button></InBar>
    <InBar slot="more"><button type="button">Зона</button></InBar>
    <WrapProbe />
  </MapFrame>,
);

describe('Given карта в рамці (AC2)', () => {
  it('Then інструменти — в одному ряду над картою, а не поверх неї', async () => {
    const { container } = mount();
    await act(async () => {});
    const bar = screen.getByRole('toolbar', { name: 'Інструменти карти' });
    const wrap = container.querySelector('.mapwrap')!;
    expect(bar.contains(screen.getByRole('button', { name: 'Малювання' }))).toBe(true);
    expect(wrap.contains(bar)).toBe(false);
    // Ряд стоїть перед картою в DOM — тобто над нею.
    expect(bar.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wrap.querySelector('canvas.map')).not.toBeNull();
  });

  it('Then решта — у меню «⋯», закритому за замовчуванням; When «⋯»; Then меню відкрите', async () => {
    mount();
    await act(async () => {});
    const more = screen.getByRole('button', { name: 'Ще інструменти' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Зона' })).toBeNull(); // прихований
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const zone = screen.getByRole('button', { name: 'Зона' });
    expect(screen.getByRole('toolbar').contains(zone)).toBe(false);
  });

  it('Then шари карти бачать свій mapwrap через контекст (жести, знімок)', async () => {
    mount();
    await act(async () => {});
    expect(screen.getByTestId('probe').textContent).toBe('mapwrap');
  });

  it('Given без рамки (окремий тест компонента); Then кнопка рендериться на місці', () => {
    render(<InBar><button type="button">Знімок</button></InBar>);
    expect(screen.getByRole('button', { name: 'Знімок' })).toBeTruthy();
  });
});

// Issue #116: EN — доступні імена ряду й «⋯» англійською.
describe('Given EN (issue #116)', () => {
  afterEach(() => localStorage.clear());
  it('Then toolbar «Map tools», кнопка «More tools»', async () => {
    localStorage.setItem(LANG_KEY, 'en');
    render(<LangProvider><MapFrame><canvas className="map" /></MapFrame></LangProvider>);
    await act(async () => {});
    expect(screen.getByRole('toolbar', { name: 'Map tools' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More tools' })).toBeTruthy();
  });
});

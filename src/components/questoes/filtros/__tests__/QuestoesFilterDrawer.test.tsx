import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestoesFilterDrawer } from '../QuestoesFilterDrawer';

describe('QuestoesFilterDrawer', () => {
  it('renderiza children left e right', () => {
    render(
      <QuestoesFilterDrawer
        left={<div data-testid="picker">picker</div>}
        right={<div data-testid="painel">painel</div>}
      />,
    );
    expect(screen.getByTestId('picker')).toBeInTheDocument();
    expect(screen.getByTestId('painel')).toBeInTheDocument();
  });

  it('grid template-columns 7fr 3fr (70/30)', () => {
    const { container } = render(
      <QuestoesFilterDrawer left={<div>L</div>} right={<div>R</div>} />,
    );
    const grid = container.querySelector('[data-testid="drawer-grid"]') as HTMLElement;
    expect(grid).toBeInTheDocument();
    expect(grid.style.gridTemplateColumns).toBe('7fr 3fr');
  });
});

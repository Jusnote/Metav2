import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveFiltersGroup } from '../ActiveFiltersGroup';

describe('ActiveFiltersGroup', () => {
  it('renderiza label uppercase', () => {
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE']}
        onClearGroup={() => {}}
        onRemoveItem={() => {}}
      />,
    );
    expect(screen.getByText('BANCA')).toBeInTheDocument();
  });

  it('renderiza items', () => {
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE', 'FGV']}
        onClearGroup={() => {}}
        onRemoveItem={() => {}}
      />,
    );
    expect(screen.getByText('CESPE')).toBeInTheDocument();
    expect(screen.getByText('FGV')).toBeInTheDocument();
  });

  it('click no × do header dispara onClearGroup', () => {
    const onClearGroup = vi.fn();
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE']}
        onClearGroup={onClearGroup}
        onRemoveItem={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar grupo BANCA/i }));
    expect(onClearGroup).toHaveBeenCalled();
  });

  it('click no × do item dispara onRemoveItem com o valor', () => {
    const onRemoveItem = vi.fn();
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE', 'FGV']}
        onClearGroup={() => {}}
        onRemoveItem={onRemoveItem}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remover CESPE/i }));
    expect(onRemoveItem).toHaveBeenCalledWith('CESPE');
  });

  it('grupo vazio não renderiza nada', () => {
    const { container } = render(
      <ActiveFiltersGroup
        label="BANCA"
        items={[]}
        onClearGroup={() => {}}
        onRemoveItem={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

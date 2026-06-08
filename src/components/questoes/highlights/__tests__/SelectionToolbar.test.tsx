import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar } from '../SelectionToolbar';

describe('SelectionToolbar', () => {
  it('começa em Atenção e troca para Grifo comum', () => {
    render(<SelectionToolbar onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /Atenção/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Grifo comum/ }));
    expect(screen.getByRole('button', { name: /Grifo comum/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar numa cor chama onPick(color, kind) com o kind ativo', () => {
    const onPick = vi.fn();
    render(<SelectionToolbar onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Grifo comum/ }));
    fireEvent.click(screen.getByTestId('swatch-#E0484D'));
    expect(onPick).toHaveBeenCalledWith('#E0484D', 'plain');
  });

  it('respeita defaultKind', () => {
    render(<SelectionToolbar onPick={() => {}} defaultKind="plain" />);
    expect(screen.getByRole('button', { name: /Grifo comum/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

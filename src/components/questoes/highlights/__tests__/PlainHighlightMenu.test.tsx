import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlainHighlightMenu } from '../PlainHighlightMenu';

const pos = { left: 10, top: 10 };

describe('PlainHighlightMenu', () => {
  it('trocar cor chama onColor', () => {
    const onColor = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" position={pos} onColor={onColor} onPromote={() => {}} onRemove={() => {}} />);
    fireEvent.click(screen.getByTestId('plain-swatch-#8B5CF6'));
    expect(onColor).toHaveBeenCalledWith('#8B5CF6');
  });
  it('"Virar Atenção" chama onPromote', () => {
    const onPromote = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" position={pos} onColor={() => {}} onPromote={onPromote} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Virar Atenção/ }));
    expect(onPromote).toHaveBeenCalled();
  });
  it('"Remover" chama onRemove', () => {
    const onRemove = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" position={pos} onColor={() => {}} onPromote={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});

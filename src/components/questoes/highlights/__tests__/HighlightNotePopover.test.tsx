import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightNotePopover } from '../HighlightNotePopover';
import type { Highlight } from '../types';

const base: Highlight = {
  id: '1', questionId: 1, target: 'enunciado', kind: 'attention', color: '#E0484D',
  type: 'pegadinha', quote: 'x', prefix: '', suffix: '', note: '', createdAt: '', updatedAt: '',
};
const pos = { left: 10, top: 10 };

describe('HighlightNotePopover', () => {
  it('mostra o tipo atual e troca via dropdown chamando onChange', () => {
    const onChange = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={onChange} onRemove={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Pegadinha/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cuidado' }));
    expect(onChange).toHaveBeenCalledWith({ type: 'cuidado' });
  });

  it('trocar cor chama onChange com a cor', () => {
    const onChange = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={onChange} onRemove={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('note-swatch-#4CAF6E'));
    expect(onChange).toHaveBeenCalledWith({ color: '#4CAF6E' });
  });

  it('auto-save: digitar e disparar onClose salva a nota', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={onChange} onRemove={() => {}} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/Anote/), { target: { value: 'trocaram pode por deve' } });
    fireEvent.blur(screen.getByPlaceholderText(/Anote/));
    expect(onChange).toHaveBeenCalledWith({ note: 'trocaram pode por deve' });
  });

  it('lixeira chama onRemove', () => {
    const onRemove = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={() => {}} onRemove={onRemove} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightBalloon } from '../HighlightBalloon';
import type { Highlight } from '../types';

const base: Highlight = {
  id: '1', questionId: 1, target: 'enunciado', kind: 'attention', color: '#F2C231',
  type: 'pegadinha', quote: 'x', prefix: '', suffix: '', note: 'trocaram pode por deve', createdAt: '', updatedAt: '',
};

function noop() {}

describe('HighlightBalloon', () => {
  it('modo leitura mostra o tipo e a nota, e o lápis chama onEdit', () => {
    const onEdit = vi.fn();
    render(<HighlightBalloon highlight={base} mode="read" onEdit={onEdit} onChange={noop} onRemove={noop} onClose={noop} />);
    expect(screen.getByText('Pegadinha')).toBeInTheDocument();
    expect(screen.getByText('trocaram pode por deve')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('modo leitura sem nota mostra o placeholder', () => {
    render(<HighlightBalloon highlight={{ ...base, note: '' }} mode="read" onEdit={noop} onChange={noop} onRemove={noop} onClose={noop} />);
    expect(screen.getByText(/Sem anotação ainda/)).toBeInTheDocument();
  });

  it('modo edição: trocar tipo pelo dropdown chama onChange', () => {
    const onChange = vi.fn();
    render(<HighlightBalloon highlight={base} mode="edit" onEdit={noop} onChange={onChange} onRemove={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Pegadinha/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cuidado' }));
    expect(onChange).toHaveBeenCalledWith({ type: 'cuidado' });
  });

  it('modo edição: trocar cor chama onChange', () => {
    const onChange = vi.fn();
    render(<HighlightBalloon highlight={base} mode="edit" onEdit={noop} onChange={onChange} onRemove={noop} onClose={noop} />);
    fireEvent.click(screen.getByTestId('bln-swatch-#4CAF6E'));
    expect(onChange).toHaveBeenCalledWith({ color: '#4CAF6E' });
  });

  it('modo edição: digitar + Salvar grava a nota e fecha', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<HighlightBalloon highlight={{ ...base, note: '' }} mode="edit" onEdit={noop} onChange={onChange} onRemove={noop} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/Escreva a pegadinha/), { target: { value: 'cuidado com sempre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onChange).toHaveBeenCalledWith({ note: 'cuidado com sempre' });
    expect(onClose).toHaveBeenCalled();
  });

  it('modo edição: lixeira chama onRemove', () => {
    const onRemove = vi.fn();
    render(<HighlightBalloon highlight={base} mode="edit" onEdit={noop} onChange={noop} onRemove={onRemove} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestoesFilterChipStrip } from '../QuestoesFilterChipStrip';

describe('QuestoesFilterChipStrip', () => {
  it('renderiza 4 chips na ordem canônica', () => {
    render(
      <QuestoesFilterChipStrip activeChip="materia_assuntos" onChange={() => {}} />,
    );
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(4);
    expect(chips[0]).toHaveTextContent(/Disciplina/i);
    expect(chips[1]).toHaveTextContent(/Banca/i);
    expect(chips[2]).toHaveTextContent(/Instituição/i);
    expect(chips[3]).toHaveTextContent(/Ano/i);
  });

  it('chip ativa tem aria-pressed=true; outras false', () => {
    render(<QuestoesFilterChipStrip activeChip="banca" onChange={() => {}} />);
    const chips = screen.getAllByRole('button');
    expect(chips[0]).toHaveAttribute('aria-pressed', 'false');
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true');
    expect(chips[2]).toHaveAttribute('aria-pressed', 'false');
    expect(chips[3]).toHaveAttribute('aria-pressed', 'false');
  });

  it('click em chip dispara onChange com a key correta', () => {
    const onChange = vi.fn();
    render(<QuestoesFilterChipStrip activeChip="materia_assuntos" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Banca/i }));
    expect(onChange).toHaveBeenCalledWith('banca');
  });
});

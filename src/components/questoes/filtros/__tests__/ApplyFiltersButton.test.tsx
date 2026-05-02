import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyFiltersButton } from '../ApplyFiltersButton';

describe('ApplyFiltersButton', () => {
  it('label "Aplicar filtros" quando !isDirty', () => {
    render(<ApplyFiltersButton isDirty={false} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Aplicar filtros');
  });

  it('label "Aplicar mudanças" quando isDirty', () => {
    render(<ApplyFiltersButton isDirty={true} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Aplicar mudanças');
  });

  it('disabled quando !isDirty', () => {
    render(<ApplyFiltersButton isDirty={false} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('habilitado quando isDirty', () => {
    render(<ApplyFiltersButton isDirty={true} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('habilitado mesmo com count=0 (não bloqueia)', () => {
    render(<ApplyFiltersButton isDirty={true} count={0} onClick={() => {}} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('disabled quando count=null (loading)', () => {
    render(<ApplyFiltersButton isDirty={true} count={null} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('click dispara onClick quando habilitado', () => {
    const onClick = vi.fn();
    render(<ApplyFiltersButton isDirty={true} count={100} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});

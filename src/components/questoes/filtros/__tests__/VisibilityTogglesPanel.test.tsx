import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisibilityTogglesPanel } from '../VisibilityTogglesPanel';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

describe('VisibilityTogglesPanel — render', () => {
  it('renderiza 4 grupos com labels esperados', () => {
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    expect(screen.getByText(/Anuladas/i)).toBeInTheDocument();
    expect(screen.getByText(/Desatualizadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Já respondidas/i)).toBeInTheDocument();
    expect(screen.getByText(/Errei antes/i)).toBeInTheDocument();
  });

  it('Anuladas tem 2 opções (Mostrar, Esconder)', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="anuladas"]');
    const radios = group?.querySelectorAll('input[type="radio"]');
    expect(radios?.length).toBe(2);
  });

  it('Errei antes tem 3 opções (Mostrar, Esconder, Somente)', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="errei_antes"]');
    const radios = group?.querySelectorAll('input[type="radio"]');
    expect(radios?.length).toBe(3);
  });

  it('Anuladas com pendentes vazio → Mostrar selecionado por padrão', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="anuladas"]');
    const checked = group?.querySelector('input[type="radio"]:checked');
    expect((checked as HTMLInputElement)?.value).toBe('mostrar');
  });

  it('Anuladas com pendentes.visibility_anuladas="esconder" → Esconder selecionado', () => {
    const { container } = render(
      <VisibilityTogglesPanel
        pendentes={{ ...EMPTY_FILTERS, visibility_anuladas: 'esconder' }}
        onChange={() => {}}
      />,
    );
    const group = container.querySelector('[data-toggle-group="anuladas"]');
    const checked = group?.querySelector('input[type="radio"]:checked');
    expect((checked as HTMLInputElement)?.value).toBe('esconder');
  });
});

describe('VisibilityTogglesPanel — funcionais (Anuladas, Desatualizadas)', () => {
  it('clicar em Esconder de Anuladas dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={onChange} />,
    );
    const radio = screen.getByLabelText('Esconder Anuladas');
    fireEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith({
      visibility_anuladas: 'esconder',
    });
  });

  it('clicar em Esconder de Desatualizadas dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={onChange} />,
    );
    const radio = screen.getByLabelText('Esconder Desatualizadas');
    fireEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith({
      visibility_desatualizadas: 'esconder',
    });
  });
});

describe('VisibilityTogglesPanel — disabled (Já respondidas, Errei antes)', () => {
  it('Já respondidas tem aria-disabled', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="ja_respondidas"]');
    expect(group).toHaveAttribute('aria-disabled', 'true');
  });

  it('Já respondidas tem title "em breve"', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="ja_respondidas"]');
    expect(group).toHaveAttribute('title', expect.stringMatching(/em breve/i));
  });

  it('clicar em Esconder Já respondidas NÃO dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={onChange} />,
    );
    const radio = screen.getByLabelText('Esconder Já respondidas');
    fireEvent.click(radio);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Errei antes tem aria-disabled e tooltip', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="errei_antes"]');
    expect(group).toHaveAttribute('aria-disabled', 'true');
    expect(group).toHaveAttribute('title', expect.stringMatching(/em breve/i));
  });
});

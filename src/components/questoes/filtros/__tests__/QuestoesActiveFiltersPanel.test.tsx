import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestoesActiveFiltersPanel } from '../QuestoesActiveFiltersPanel';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

describe('QuestoesActiveFiltersPanel — header', () => {
  it('mostra "FILTROS ATIVOS · 0" quando vazio', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/FILTROS ATIVOS · 0/i)).toBeInTheDocument();
  });

  it('conta filtros aplicados (não pendentes)', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE', 'FGV'], anos: [2023] }}
        isDirty={false}
        count={1000}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/FILTROS ATIVOS · 3/i)).toBeInTheDocument();
  });
});

describe('QuestoesActiveFiltersPanel — empty state', () => {
  it('renderiza empty state quando pendentes vazio', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Nenhum filtro selecionado.')).toBeInTheDocument();
  });

  it('NÃO renderiza empty state quando há pendentes', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={1000}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('Nenhum filtro selecionado.')).not.toBeInTheDocument();
  });
});

describe('QuestoesActiveFiltersPanel — count', () => {
  it('mostra count formatado em pt-BR', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('3.886.057')).toBeInTheDocument();
  });

  it('mostra "—" quando count=null', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={null}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('label muda pra "total no banco" quando empty', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('total no banco')).toBeInTheDocument();
  });

  it('label "questões encontradas" quando há filtros', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        isDirty={false}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('questões encontradas')).toBeInTheDocument();
  });
});

describe('QuestoesActiveFiltersPanel — Aplicar', () => {
  it('botão habilitado quando isDirty', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Aplicar/ })).not.toBeDisabled();
  });

  it('click chama onApply', () => {
    const onApply = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={onApply}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));
    expect(onApply).toHaveBeenCalled();
  });
});

describe('QuestoesActiveFiltersPanel — grupos', () => {
  it('renderiza grupo BANCA quando aplicados.bancas tem itens', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        isDirty={false}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('BANCA')).toBeInTheDocument();
    expect(screen.getByText('CESPE')).toBeInTheDocument();
  });

  it('clique no × do grupo dispara onChange limpando categoria', () => {
    const onChange = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'], anos: [2023] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar grupo BANCA/i }));
    expect(onChange).toHaveBeenCalledWith({ bancas: [] });
  });
});

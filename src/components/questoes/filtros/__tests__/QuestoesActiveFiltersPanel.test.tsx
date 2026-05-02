import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestoesActiveFiltersPanel } from '../QuestoesActiveFiltersPanel';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

const mockDicionario: FiltrosDicionario = {
  bancas: {},
  orgaos: {},
  cargos: {},
  materias: ['Direito Administrativo', 'Contabilidade Geral'],
  assuntos: [
    'Atos administrativos',
    'Licitações',
    'Demonstrações financeiras',
    'Balanços',
  ],
  materia_assuntos: {
    'Direito Administrativo': ['Atos administrativos', 'Licitações'],
    'Contabilidade Geral': ['Demonstrações financeiras', 'Balanços'],
  },
  anos: { min: 2010, max: 2025 },
};

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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
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
        dicionario={mockDicionario}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));
    expect(onApply).toHaveBeenCalled();
  });
});

describe('QuestoesActiveFiltersPanel — grupos flat', () => {
  it('renderiza grupo BANCA quando aplicados.bancas tem itens', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        isDirty={false}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
        dicionario={mockDicionario}
      />,
    );
    expect(screen.getByText('BANCA')).toBeInTheDocument();
    expect(screen.getByText('CESPE')).toBeInTheDocument();
  });

  it('clique no × do grupo BANCA dispara onChange limpando categoria', () => {
    const onChange = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'], anos: [2023] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={onChange}
        dicionario={mockDicionario}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar grupo BANCA/i }));
    expect(onChange).toHaveBeenCalledWith({ bancas: [] });
  });
});

describe('QuestoesActiveFiltersPanel — grupos por matéria', () => {
  it('renderiza MATÉRIA: <nome> com assuntos aninhados', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{
          ...EMPTY_FILTERS,
          materias: ['Direito Administrativo'],
          assuntos: ['Atos administrativos'],
        }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
        dicionario={mockDicionario}
      />,
    );
    expect(screen.getByText('MATÉRIA: Direito Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Atos administrativos')).toBeInTheDocument();
  });

  it('renderiza dois grupos de matérias com assuntos respectivos', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{
          ...EMPTY_FILTERS,
          materias: ['Direito Administrativo', 'Contabilidade Geral'],
          assuntos: ['Atos administrativos', 'Demonstrações financeiras'],
        }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
        dicionario={mockDicionario}
      />,
    );
    expect(screen.getByText('MATÉRIA: Direito Administrativo')).toBeInTheDocument();
    expect(screen.getByText('MATÉRIA: Contabilidade Geral')).toBeInTheDocument();
    expect(screen.getByText('Atos administrativos')).toBeInTheDocument();
    expect(screen.getByText('Demonstrações financeiras')).toBeInTheDocument();
    // Cross-check: Atos administrativos should NOT appear under Contabilidade
    // (sanity — single item per assunto)
    expect(screen.queryByText('Balanços')).not.toBeInTheDocument();
  });

  it('renderiza "todos os assuntos" quando matéria selecionada sem assuntos', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{
          ...EMPTY_FILTERS,
          materias: ['Direito Administrativo'],
          assuntos: [],
        }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
        dicionario={mockDicionario}
      />,
    );
    expect(screen.getByText('MATÉRIA: Direito Administrativo')).toBeInTheDocument();
    expect(screen.getByText('todos os assuntos')).toBeInTheDocument();
  });

  it('clique no × da matéria limpa só sua matéria + seus assuntos', () => {
    const onChange = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{
          ...EMPTY_FILTERS,
          materias: ['Direito Administrativo', 'Contabilidade Geral'],
          assuntos: ['Atos administrativos', 'Demonstrações financeiras'],
        }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={onChange}
        dicionario={mockDicionario}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /limpar matéria Direito Administrativo/i }),
    );
    expect(onChange).toHaveBeenCalledWith({
      materias: ['Contabilidade Geral'],
      assuntos: ['Demonstrações financeiras'],
    });
  });

  it('clique no × de um assunto remove só aquele assunto', () => {
    const onChange = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{
          ...EMPTY_FILTERS,
          materias: ['Direito Administrativo'],
          assuntos: ['Atos administrativos', 'Licitações'],
        }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={onChange}
        dicionario={mockDicionario}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remover Atos administrativos/i }));
    expect(onChange).toHaveBeenCalledWith({ assuntos: ['Licitações'] });
  });
});

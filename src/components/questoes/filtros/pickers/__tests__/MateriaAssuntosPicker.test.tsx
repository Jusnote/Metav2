import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MateriaAssuntosPicker } from '../MateriaAssuntosPicker';

vi.mock('@/hooks/useMaterias', () => ({
  useMaterias: () => ({
    data: [
      { slug: 'direito-adm', nome: 'Direito Administrativo', total_nodes: 499, total_questoes_classificadas: 12345, fontes: ['gran'], last_updated: null },
      { slug: 'direito-civil', nome: 'Direito Civil', total_nodes: 0, total_questoes_classificadas: 5000, fontes: [], last_updated: null },
    ],
    isLoading: false,
  }),
}));
vi.mock('@/components/questoes/TaxonomiaTreePicker', () => ({
  TaxonomiaTreePicker: ({ materiaSlug }: { materiaSlug: string }) => <div data-testid="tree">tree:{materiaSlug}</div>,
}));

const dicionario = {
  bancas: {}, orgaos: {}, cargos: {},
  // Source de verdade da LISTA de matérias = dicionário (todas as matérias do app).
  // useMaterias mock só retorna as que têm taxonomia (subset).
  materias: ['Direito Administrativo', 'Direito Civil', 'Direito Penal'],
  assuntos: [],
  materia_assuntos: { 'Direito Civil': ['Pessoas', 'Obrigações', 'Contratos'] },
  anos: { min: 2010, max: 2024 },
};

const defaultProps = {
  dicionario,
  selectedAssuntos: [],
  selectedNodeIds: [],
  selectedMaterias: [] as string[],
  isUmbrella: false,
  onMateriaChange: vi.fn(),
  onAssuntosChange: vi.fn(),
  onNodeIdsChange: vi.fn(),
  onUmbrellaToggle: vi.fn(),
  onUmbrellaAdd: vi.fn(),
};

describe('MateriaAssuntosPicker', () => {
  it('sem matéria → lista de matérias', () => {
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia={null}
      />,
    );
    expect(screen.getByText('Direito Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Direito Civil')).toBeInTheDocument();
  });

  it('matéria com taxonomia → renderiza TreePicker', () => {
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia="Direito Administrativo"
      />,
    );
    expect(screen.getByTestId('tree')).toHaveTextContent('tree:direito-adm');
  });

  it('matéria sem taxonomia → fallback flat de assuntos', () => {
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia="Direito Civil"
      />,
    );
    expect(screen.getByText('Pessoas')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.queryByTestId('tree')).not.toBeInTheDocument();
  });
});

describe('MateriaAssuntosPicker — Mode 1 (lista) lazy-add', () => {
  it('matéria em umbrella mostra "✓ Todo o conteúdo"; matéria não selecionada não mostra badge', () => {
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia={null}
        selectedMaterias={['Direito Administrativo']}
        selectedAssuntos={[]}
        selectedNodeIds={[]}
      />,
    );
    expect(screen.getByText(/✓ Todo o conteúdo/i)).toBeInTheDocument();
    // Não deve haver mais o link "Todo o conteúdo →"
    expect(screen.queryByText(/Todo o conteúdo →/i)).not.toBeInTheDocument();
  });

  it('matéria com N assuntos específicos mostra "✓ N assuntos"', () => {
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia={null}
        selectedMaterias={['Direito Civil']}
        selectedAssuntos={['Pessoas', 'Contratos']}
      />,
    );
    expect(screen.getByText(/✓ 2 assuntos/i)).toBeInTheDocument();
  });

  it('clicar no nome da matéria chama onMateriaChange (sem onUmbrellaAdd)', () => {
    const onMateriaChange = vi.fn();
    const onUmbrellaAdd = vi.fn();
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia={null}
        selectedMaterias={[]}
        onMateriaChange={onMateriaChange}
        onUmbrellaAdd={onUmbrellaAdd}
      />,
    );
    fireEvent.click(screen.getByText('Direito Administrativo'));
    expect(onMateriaChange).toHaveBeenCalledWith('Direito Administrativo');
    expect(onUmbrellaAdd).not.toHaveBeenCalled();
  });
});

describe('MateriaAssuntosPicker — Mode 2 (taxonomia) umbrella', () => {
  it('mostra botão "Todo o conteúdo de [matéria]"', () => {
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia="Direito Administrativo"
      />,
    );
    expect(
      screen.getByText(/Todo o conteúdo de Direito Administrativo/i),
    ).toBeInTheDocument();
  });

  it('com isUmbrella=true, botão tem aria-pressed=true e tree fica desabilitada', () => {
    const { container } = render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia="Direito Administrativo"
        isUmbrella={true}
      />,
    );
    const btn = screen.getByRole('button', {
      name: /Todo o conteúdo de Direito Administrativo/i,
    });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    // Tree fica em wrapper com pointer-events-none
    const disabled = container.querySelector('.pointer-events-none');
    expect(disabled).not.toBeNull();
  });

  it('clicar no botão dispara onUmbrellaToggle', () => {
    const onUmbrellaToggle = vi.fn();
    render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia="Direito Administrativo"
        onUmbrellaToggle={onUmbrellaToggle}
      />,
    );
    const btn = screen.getByRole('button', {
      name: /Todo o conteúdo de Direito Administrativo/i,
    });
    fireEvent.click(btn);
    expect(onUmbrellaToggle).toHaveBeenCalledTimes(1);
  });
});

describe('MateriaAssuntosPicker — Mode 3 (flat) umbrella', () => {
  it('mostra botão umbrella e desabilita lista quando isUmbrella=true', () => {
    const { container } = render(
      <MateriaAssuntosPicker
        {...defaultProps}
        materia="Direito Civil"
        isUmbrella={true}
      />,
    );
    expect(
      screen.getByText(/Todo o conteúdo de Direito Civil/i),
    ).toBeInTheDocument();
    const disabled = container.querySelector('.pointer-events-none');
    expect(disabled).not.toBeNull();
  });
});

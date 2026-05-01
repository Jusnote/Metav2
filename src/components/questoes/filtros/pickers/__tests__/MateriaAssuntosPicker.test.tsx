import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('MateriaAssuntosPicker', () => {
  it('sem matéria → lista de matérias', () => {
    render(
      <MateriaAssuntosPicker
        dicionario={dicionario}
        materia={null} selectedAssuntos={[]} selectedNodeIds={[]}
        onMateriaChange={vi.fn()} onAssuntosChange={vi.fn()} onNodeIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Direito Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Direito Civil')).toBeInTheDocument();
  });

  it('matéria com taxonomia → renderiza TreePicker', () => {
    render(
      <MateriaAssuntosPicker
        dicionario={dicionario}
        materia="Direito Administrativo" selectedAssuntos={[]} selectedNodeIds={[]}
        onMateriaChange={vi.fn()} onAssuntosChange={vi.fn()} onNodeIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('tree')).toHaveTextContent('tree:direito-adm');
  });

  it('matéria sem taxonomia → fallback flat de assuntos', () => {
    render(
      <MateriaAssuntosPicker
        dicionario={dicionario}
        materia="Direito Civil" selectedAssuntos={[]} selectedNodeIds={[]}
        onMateriaChange={vi.fn()} onAssuntosChange={vi.fn()} onNodeIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Pessoas')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.queryByTestId('tree')).not.toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import {
  filtersToSearchParams,
  searchParamsToFilters,
  EMPTY_FILTERS,
  type AppliedFilters,
  type VisibilityState,
} from '../filter-serialization';

describe('filter-serialization', () => {
  it('serializa filtros multi-valor como query strings repetidas', () => {
    const filters: AppliedFilters = {
      bancas: ['CEBRASPE (CESPE)', 'FGV'],
      anos: [2024, 2023],
      materias: [],
      assuntos: [],
      orgaos: [],
      cargos: [],
      areas_concurso: [],
      especialidades: [],
      tipos: [],
      formatos: [],
    };

    const params = filtersToSearchParams(filters);

    expect(params.getAll('bancas')).toEqual(['CEBRASPE (CESPE)', 'FGV']);
    expect(params.getAll('anos')).toEqual(['2024', '2023']);
    expect(params.getAll('materias')).toEqual([]);
  });

  it('omite campos vazios', () => {
    const filters: AppliedFilters = {
      bancas: ['FGV'],
      anos: [],
      materias: [],
      assuntos: [],
      orgaos: [],
      cargos: [],
      areas_concurso: [],
      especialidades: [],
      tipos: [],
      formatos: [],
    };

    const params = filtersToSearchParams(filters);
    const keys = Array.from(new Set(Array.from(params.keys())));

    expect(keys).toEqual(['bancas']);
  });

  it('parse de URLSearchParams para objeto', () => {
    const params = new URLSearchParams();
    params.append('bancas', 'FGV');
    params.append('bancas', 'CEBRASPE (CESPE)');
    params.append('anos', '2024');

    const filters = searchParamsToFilters(params);

    expect(filters.bancas).toEqual(['FGV', 'CEBRASPE (CESPE)']);
    expect(filters.anos).toEqual([2024]);
    expect(filters.materias).toEqual([]);
  });

  it('round-trip preserva os filtros', () => {
    const original: AppliedFilters = {
      bancas: ['FGV'],
      anos: [2024, 2023],
      materias: ['Direito Administrativo'],
      assuntos: [],
      orgaos: ['INSS'],
      cargos: [],
      areas_concurso: [],
      especialidades: [],
      tipos: [],
      formatos: [],
    };

    const params = filtersToSearchParams(original);
    const roundtrip = searchParamsToFilters(params);

    expect(roundtrip).toEqual(original);
  });

  it('ignora keys desconhecidas no parse', () => {
    const params = new URLSearchParams();
    params.append('bancas', 'FGV');
    params.append('view', 'questoes');
    params.append('xpto', 'foo');

    const filters = searchParamsToFilters(params);

    expect(filters.bancas).toEqual(['FGV']);
    expect(filters.anos).toEqual([]);
  });

  it('parse de ano inválido descarta valor', () => {
    const params = new URLSearchParams();
    params.append('anos', '2024');
    params.append('anos', 'lixo');

    const filters = searchParamsToFilters(params);

    expect(filters.anos).toEqual([2024]);
  });
});

describe('AppliedFilters — visibility toggles', () => {
  it('VisibilityState aceita "mostrar" e "esconder"', () => {
    const a: VisibilityState = 'mostrar';
    const b: VisibilityState = 'esconder';
    expect(a).toBe('mostrar');
    expect(b).toBe('esconder');
  });

  it('EMPTY_FILTERS tem visibility_anuladas e visibility_desatualizadas como undefined', () => {
    expect(EMPTY_FILTERS.visibility_anuladas).toBeUndefined();
    expect(EMPTY_FILTERS.visibility_desatualizadas).toBeUndefined();
  });
});

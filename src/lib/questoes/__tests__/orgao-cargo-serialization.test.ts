import { describe, it, expect } from 'vitest';
import { stateToBackendFilters } from '../orgao-cargo-serialization';
import { EMPTY_STATE } from '@/hooks/useOrgaoCargoState';

describe('stateToBackendFilters', () => {
  it('estado vazio retorna 3 arrays vazios', () => {
    const result = stateToBackendFilters(EMPTY_STATE);
    expect(result).toEqual({ orgaos: [], cargos: [], org_cargo_pairs: [] });
  });

  it('órgão "all" → entra em flat orgaos', () => {
    const state = {
      orgaos: new Map([['TRF1', 'all' as const]]),
      flatCargos: [],
    };
    const result = stateToBackendFilters(state);
    expect(result.orgaos).toEqual(['TRF1']);
    expect(result.org_cargo_pairs).toEqual([]);
    expect(result.cargos).toEqual([]);
  });

  it('órgão com cargos específicos → vira pairs', () => {
    const state = {
      orgaos: new Map([['TRF1', ['Analista', 'Técnico']]]),
      flatCargos: [],
    };
    const result = stateToBackendFilters(state);
    expect(result.orgaos).toEqual([]);
    expect(result.org_cargo_pairs).toEqual(['TRF1:Analista', 'TRF1:Técnico']);
    expect(result.cargos).toEqual([]);
  });

  it('flatCargos → entra em flat cargos', () => {
    const state = {
      orgaos: new Map(),
      flatCargos: ['Auditor', 'Fiscal'],
    };
    const result = stateToBackendFilters(state);
    expect(result.orgaos).toEqual([]);
    expect(result.org_cargo_pairs).toEqual([]);
    expect(result.cargos).toEqual(['Auditor', 'Fiscal']);
  });

  it('combinação: órgão all + órgão com pairs + flat cargos', () => {
    const state = {
      orgaos: new Map<string, 'all' | string[]>([
        ['STJ', 'all'],
        ['TRF2', ['Juiz', 'Assessor']],
      ]),
      flatCargos: ['Procurador'],
    };
    const result = stateToBackendFilters(state);
    expect(result.orgaos).toEqual(['STJ']);
    expect(result.org_cargo_pairs).toEqual(['TRF2:Juiz', 'TRF2:Assessor']);
    expect(result.cargos).toEqual(['Procurador']);
  });

  it('múltiplos órgãos com pairs ordem preservada', () => {
    const state = {
      orgaos: new Map<string, 'all' | string[]>([
        ['AGU', ['Advogado', 'Consultor']],
        ['PGF', ['Procurador']],
      ]),
      flatCargos: [],
    };
    const result = stateToBackendFilters(state);
    expect(result.org_cargo_pairs).toEqual([
      'AGU:Advogado',
      'AGU:Consultor',
      'PGF:Procurador',
    ]);
  });
});

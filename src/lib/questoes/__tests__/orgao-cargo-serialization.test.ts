import { describe, it, expect } from 'vitest';
import { stateToBackendFilters, backendToState } from '../orgao-cargo-serialization';
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

describe('backendToState', () => {
  it('input vazio retorna EMPTY_STATE deep-equal', () => {
    const result = backendToState({});
    expect(result.orgaos.size).toBe(0);
    expect(result.flatCargos).toEqual([]);
    expect(result).toEqual({ orgaos: new Map(), flatCargos: [] });
    // sanity: não compartilha referência com EMPTY_STATE
    expect(result.orgaos).not.toBe(EMPTY_STATE.orgaos);
  });

  it('orgao isolado vira selection "all"', () => {
    const result = backendToState({ orgaos: ['STJ'] });
    expect(result.orgaos.get('STJ')).toBe('all');
    expect(result.flatCargos).toEqual([]);
  });

  it('par único vira array de cargos', () => {
    const result = backendToState({ org_cargo_pairs: ['STJ:Analista'] });
    expect(result.orgaos.get('STJ')).toEqual(['Analista']);
  });

  it('múltiplos pares + flatCargos', () => {
    const result = backendToState({
      org_cargo_pairs: ['STJ:A', 'STJ:B'],
      cargos: ['Foo'],
    });
    expect(result.orgaos.get('STJ')).toEqual(['A', 'B']);
    expect(result.flatCargos).toEqual(['Foo']);
  });

  it('par com cargo contendo ":" preserva o resto após o primeiro ":"', () => {
    const result = backendToState({ org_cargo_pairs: ['STJ:Analista:Judiciário'] });
    expect(result.orgaos.get('STJ')).toEqual(['Analista:Judiciário']);
  });

  it('par mal formado (sem ":") é ignorado', () => {
    const result = backendToState({ org_cargo_pairs: ['STJ-Analista'] });
    expect(result.orgaos.size).toBe(0);
  });

  it('regra defensiva: par vence sobre "all" pro mesmo órgão', () => {
    const result = backendToState({
      orgaos: ['STJ'],
      org_cargo_pairs: ['STJ:Analista'],
    });
    expect(result.orgaos.get('STJ')).toEqual(['Analista']);
  });

  it('round-trip: state → backend → state é deep-equal (mix all/pairs/flatCargos)', () => {
    const original = {
      orgaos: new Map<string, 'all' | string[]>([
        ['STJ', 'all'],
        ['TRF2', ['Juiz', 'Assessor']],
      ]),
      flatCargos: ['Procurador'],
    };
    const backend = stateToBackendFilters(original);
    const roundTrip = backendToState(backend);
    expect(roundTrip.flatCargos).toEqual(original.flatCargos);
    expect(roundTrip.orgaos.get('STJ')).toBe('all');
    expect(roundTrip.orgaos.get('TRF2')).toEqual(['Juiz', 'Assessor']);
    expect(roundTrip.orgaos.size).toBe(original.orgaos.size);
  });
});

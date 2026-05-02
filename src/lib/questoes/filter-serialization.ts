/**
 * Serialização canônica de filtros aplicados ↔ URLSearchParams.
 *
 * Filtros aplicados vivem na URL (search params) — fonte da verdade
 * pra query da listagem. Hooks e componentes leem daqui e escrevem aqui.
 */

export type VisibilityState = 'mostrar' | 'esconder';

export interface AppliedFilters {
  bancas: string[];
  anos: number[];
  materias: string[];
  assuntos: string[];
  orgaos: string[];
  cargos: string[];
  areas_concurso: string[];
  especialidades: string[];
  tipos: string[];
  formatos: string[];
  /** Nós da taxonomia. Aceita 'outros' como sentinela pra questões sem classificação. */
  nodeIds: (number | 'outros')[];
  /** Pares (orgao, cargo) — formato "ORGAO:CARGO". Adicionado no Plano 3b-bonus. */
  org_cargo_pairs?: string[];
  /** Visibilidade de questões anuladas. Default 'mostrar' (omitido na URL). */
  visibility_anuladas?: VisibilityState;
  /** Visibilidade de questões desatualizadas. Default 'mostrar' (omitido na URL). */
  visibility_desatualizadas?: VisibilityState;
}

export const EMPTY_FILTERS: AppliedFilters = {
  bancas: [],
  anos: [],
  materias: [],
  assuntos: [],
  orgaos: [],
  cargos: [],
  areas_concurso: [],
  especialidades: [],
  tipos: [],
  formatos: [],
  nodeIds: [],
  org_cargo_pairs: [],
};

const STRING_KEYS = [
  'bancas',
  'materias',
  'assuntos',
  'orgaos',
  'cargos',
  'areas_concurso',
  'especialidades',
  'tipos',
  'formatos',
] as const;

const INT_KEYS = ['anos'] as const;

export function filtersToSearchParams(filters: AppliedFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of STRING_KEYS) {
    for (const value of filters[key]) {
      params.append(key, value);
    }
  }
  for (const key of INT_KEYS) {
    for (const value of filters[key]) {
      params.append(key, String(value));
    }
  }
  for (const node of (filters.nodeIds ?? [])) {
    params.append('node', String(node));
  }
  if (filters.org_cargo_pairs) {
    for (const pair of filters.org_cargo_pairs) {
      params.append('org_cargo_pairs', pair);
    }
  }
  // visibility toggles → params do backend (anulada / desatualizada bool)
  // 'esconder' = "filtrar fora" → anulada=false / desatualizada=false
  // 'mostrar' / undefined = sem filtro (omitido)
  if (filters.visibility_anuladas === 'esconder') {
    params.set('anulada', 'false');
  }
  if (filters.visibility_desatualizadas === 'esconder') {
    params.set('desatualizada', 'false');
  }
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): AppliedFilters {
  const out: AppliedFilters = {
    bancas: [],
    anos: [],
    materias: [],
    assuntos: [],
    orgaos: [],
    cargos: [],
    areas_concurso: [],
    especialidades: [],
    tipos: [],
    formatos: [],
    nodeIds: [],
  };
  for (const key of STRING_KEYS) {
    out[key] = params.getAll(key);
  }
  for (const key of INT_KEYS) {
    out[key] = params
      .getAll(key)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
  }
  out.nodeIds = params.getAll('node').map(v => {
    if (v === 'outros') return 'outros' as const;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }).filter((v): v is number | 'outros' => v !== null);
  if (params.get('anulada') === 'false') {
    out.visibility_anuladas = 'esconder';
  }
  if (params.get('desatualizada') === 'false') {
    out.visibility_desatualizadas = 'esconder';
  }
  return out;
}

export function hasAnyFilter(filters: AppliedFilters): boolean {
  return (
    filters.bancas.length > 0 ||
    filters.anos.length > 0 ||
    filters.materias.length > 0 ||
    filters.assuntos.length > 0 ||
    filters.orgaos.length > 0 ||
    filters.cargos.length > 0 ||
    filters.areas_concurso.length > 0 ||
    filters.especialidades.length > 0 ||
    filters.tipos.length > 0 ||
    filters.formatos.length > 0 ||
    (filters.nodeIds?.length ?? 0) > 0 ||
    filters.visibility_anuladas === 'esconder' ||
    filters.visibility_desatualizadas === 'esconder'
  );
}

export function countActiveFilters(filters: AppliedFilters): number {
  return (
    filters.bancas.length +
    filters.anos.length +
    filters.materias.length +
    filters.assuntos.length +
    filters.orgaos.length +
    filters.cargos.length +
    filters.areas_concurso.length +
    filters.especialidades.length +
    filters.tipos.length +
    filters.formatos.length +
    (filters.nodeIds?.length ?? 0) +
    (filters.visibility_anuladas === 'esconder' ? 1 : 0) +
    (filters.visibility_desatualizadas === 'esconder' ? 1 : 0)
  );
}

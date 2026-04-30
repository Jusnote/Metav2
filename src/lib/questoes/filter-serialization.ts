/**
 * Serialização canônica de filtros aplicados ↔ URLSearchParams.
 *
 * Filtros aplicados vivem na URL (search params) — fonte da verdade
 * pra query da listagem. Hooks e componentes leem daqui e escrevem aqui.
 */

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
    filters.formatos.length > 0
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
    filters.formatos.length
  );
}

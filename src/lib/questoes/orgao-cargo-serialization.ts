import type { OrgaoCargoState } from '@/hooks/useOrgaoCargoState';

export interface BackendOrgaoCargoFilters {
  orgaos: string[];
  cargos: string[];
  org_cargo_pairs: string[];
}

export function stateToBackendFilters(state: OrgaoCargoState): BackendOrgaoCargoFilters {
  const orgaos: string[] = [];
  const pairs: string[] = [];

  for (const [orgao, selection] of state.orgaos) {
    if (selection === 'all') {
      orgaos.push(orgao);
    } else {
      for (const cargo of selection) {
        pairs.push(`${orgao}:${cargo}`);
      }
    }
  }

  return {
    orgaos,
    cargos: [...state.flatCargos],
    org_cargo_pairs: pairs,
  };
}

/**
 * Inverso de `stateToBackendFilters`. Reconstrói o estado interno do picker
 * a partir dos filtros backend (URL/sessionStorage).
 *
 * Mutex defensivo: se o mesmo órgão aparece em `orgaos` (selection 'all') E
 * em algum `org_cargo_pairs[X:Y]`, o par vence — substitui 'all' por [Y].
 * Isso preserva o invariante do reducer, que nunca produz 'all' + pair pro
 * mesmo órgão simultaneamente.
 */
export function backendToState(filters: {
  orgaos?: string[];
  cargos?: string[];
  org_cargo_pairs?: string[];
}): OrgaoCargoState {
  const orgaos = new Map<string, 'all' | string[]>();

  for (const orgao of filters.orgaos ?? []) {
    orgaos.set(orgao, 'all');
  }

  for (const pair of filters.org_cargo_pairs ?? []) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    const orgao = pair.slice(0, idx);
    const cargo = pair.slice(idx + 1);
    const current = orgaos.get(orgao);
    if (current === 'all') {
      // par vence sobre 'all' pro mesmo órgão
      orgaos.set(orgao, [cargo]);
    } else if (Array.isArray(current)) {
      if (!current.includes(cargo)) orgaos.set(orgao, [...current, cargo]);
    } else {
      orgaos.set(orgao, [cargo]);
    }
  }

  return {
    orgaos,
    flatCargos: [...(filters.cargos ?? [])],
  };
}

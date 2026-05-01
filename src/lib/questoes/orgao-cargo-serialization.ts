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

import { useReducer, useMemo } from 'react';

export type OrgaoSelection = 'all' | string[];

export interface OrgaoCargoState {
  orgaos: Map<string, OrgaoSelection>;
  flatCargos: string[];
}

export const EMPTY_STATE: OrgaoCargoState = {
  orgaos: new Map(),
  flatCargos: [],
};

type Action =
  | { type: 'addOrgaoAll'; orgao: string }
  | { type: 'addPair'; orgao: string; cargo: string }
  | { type: 'removePair'; orgao: string; cargo: string }
  | { type: 'removeOrgao'; orgao: string }
  | { type: 'addFlatCargo'; cargo: string }
  | { type: 'removeFlatCargo'; cargo: string }
  | { type: 'reset' };

function reducer(state: OrgaoCargoState, action: Action): OrgaoCargoState {
  switch (action.type) {
    case 'addOrgaoAll': {
      // Mutex: 'all' substitui pairs do mesmo órgão
      const next = new Map(state.orgaos);
      next.set(action.orgao, 'all');
      return { ...state, orgaos: next };
    }
    case 'addPair': {
      const next = new Map(state.orgaos);
      const current = next.get(action.orgao);
      if (current === 'all') {
        // Mutex: pair substitui 'all', começa com este cargo
        next.set(action.orgao, [action.cargo]);
      } else if (Array.isArray(current)) {
        if (!current.includes(action.cargo)) {
          next.set(action.orgao, [...current, action.cargo]);
        }
      } else {
        next.set(action.orgao, [action.cargo]);
      }
      return { ...state, orgaos: next };
    }
    case 'removePair': {
      const next = new Map(state.orgaos);
      const current = next.get(action.orgao);
      if (Array.isArray(current)) {
        const filtered = current.filter((c) => c !== action.cargo);
        if (filtered.length === 0) {
          next.delete(action.orgao);
        } else {
          next.set(action.orgao, filtered);
        }
      }
      return { ...state, orgaos: next };
    }
    case 'removeOrgao': {
      const next = new Map(state.orgaos);
      next.delete(action.orgao);
      return { ...state, orgaos: next };
    }
    case 'addFlatCargo': {
      if (state.flatCargos.includes(action.cargo)) return state;
      return { ...state, flatCargos: [...state.flatCargos, action.cargo] };
    }
    case 'removeFlatCargo': {
      return {
        ...state,
        flatCargos: state.flatCargos.filter((c) => c !== action.cargo),
      };
    }
    case 'reset':
      return EMPTY_STATE;
  }
}

export interface OrgaoCargoActions {
  addOrgaoAll: (orgao: string) => void;
  addPair: (orgao: string, cargo: string) => void;
  removePair: (orgao: string, cargo: string) => void;
  removeOrgao: (orgao: string) => void;
  addFlatCargo: (cargo: string) => void;
  removeFlatCargo: (cargo: string) => void;
  reset: () => void;
}

export function useOrgaoCargoState() {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);

  const actions = useMemo<OrgaoCargoActions>(
    () => ({
      addOrgaoAll: (orgao) => dispatch({ type: 'addOrgaoAll', orgao }),
      addPair: (orgao, cargo) => dispatch({ type: 'addPair', orgao, cargo }),
      removePair: (orgao, cargo) => dispatch({ type: 'removePair', orgao, cargo }),
      removeOrgao: (orgao) => dispatch({ type: 'removeOrgao', orgao }),
      addFlatCargo: (cargo) => dispatch({ type: 'addFlatCargo', cargo }),
      removeFlatCargo: (cargo) => dispatch({ type: 'removeFlatCargo', cargo }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  );

  return { state, actions };
}

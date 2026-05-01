# Plano 3b-bonus — OrgaoCargoPicker drilldown + flat-search modes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever `OrgaoCargoPicker` substituindo o picker atual de 2 listas planas por um picker master-detail com 3 modos (lista de órgãos, drilldown de cargos por órgão, busca flat de cargos). Consome o backend pair filtering do Plano 3b-pre-2 (`org_cargo_pairs`) pra evitar o cross-product semântico ao misturar flat com pairs.

**Architecture:** Componente com estado interno tipo `{orgaos: Map<string, 'all'|cargos[]>, flatCargos: string[]}` + máquina de estado de "modo de visualização" (`'list' | 'drilldown' | 'flat-search'`). Auto-cleanup com mutual exclusion por órgão (se órgão está em modo "all", não tem pairs; se tem pairs, não está em flat orgaos). Serialização do state pra `{orgaos[], cargos[], org_cargo_pairs[]}` enviado ao backend.

**Tech Stack:** React 19 · TypeScript · Tailwind · Vitest · @testing-library/react

**Repo:** `D:/meta novo/Metav2`

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md`

**Dependências (BLOQUEANTES):**
- ⚠️ Plano 3b-pre-2 mergeado e validado em produção (backend aceita `org_cargo_pairs`) — confirmado em 2026-05-01
- Plano 3b mergeado (Foundation 3a + 4 pickers + hooks)

**Decisões UX (brainstorm 2026-05-01):**
- State model: `Map<orgao, 'all'|cargos[]>` + `flatCargos: string[]`
- "All do órgão" = botão destacado no topo da drilldown ("Marcar todos os cargos do TRF1")
- Auto-cleanup: mutual exclusion por órgão. Adicionar 'all' remove pairs daquele órgão. Adicionar pair remove órgão de 'all' se estava lá.

---

## Pré-flight

- [ ] **Step 0.1: Branch base e estado limpo**

```bash
cd "/d/meta novo/Metav2"
git status
git fetch origin
git checkout main
git pull --ff-only
git checkout -b feat/questoes-orgao-cargo-drilldown
```

Expected: working tree limpo (com WIP em outras áreas OK), branch criada a partir de main atualizado.

- [ ] **Step 0.2: Confirmar dependências em produção**

```bash
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/count?org_cargo_pairs=Marinha:Corpo%20Auxiliar%20de%20Pra%C3%A7as%20%28Marinha%29" | python -c "import json,sys; d=json.load(sys.stdin); print('count:', d.get('count'), 'OK' if d.get('count', 0) > 0 else 'BACKEND NAO RESPONDE PAIR FILTERING')"
```

Expected: `count > 0`. Se 0, backend não está com pair filtering — abortar plano.

- [ ] **Step 0.3: Confirmar arquivos atuais existem**

```bash
ls src/components/questoes/filtros/pickers/OrgaoCargoPicker.tsx
ls src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx
ls src/hooks/useQuestoesFacets.ts
```

Expected: todos presentes (vão ser substituídos/atualizados ao longo do plano).

- [ ] **Step 0.4: Baseline tsc + vitest**

```bash
npx tsc --noEmit 2>&1 | grep -E "OrgaoCargoPicker|useQuestoesFacets" | head
npx vitest run src/hooks/__tests__/useQuestoesFacets.test.ts src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx 2>&1 | tail -10
```

Expected: 0 erros tsc na nossa área, vitest verde.

---

## Task 1: Hook `useOrgaoCargoState` + reducer + selectors

**Files:**
- Create: `D:/meta novo/Metav2/src/hooks/useOrgaoCargoState.ts`
- Test: `D:/meta novo/Metav2/src/hooks/__tests__/useOrgaoCargoState.test.ts`

State e actions centralizadas num hook reducer-style. Garante mutual exclusion por órgão automaticamente.

- [ ] **Step 1.1: Escrever testes primeiro (TDD)**

Criar `src/hooks/__tests__/useOrgaoCargoState.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrgaoCargoState, EMPTY_STATE } from '../useOrgaoCargoState';

describe('useOrgaoCargoState', () => {
  it('inicia vazio', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    expect(result.current.state).toEqual(EMPTY_STATE);
  });

  it('addOrgaoAll marca órgão como "all"', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => result.current.actions.addOrgaoAll('TRF1'));
    expect(result.current.state.orgaos.get('TRF1')).toBe('all');
  });

  it('addPair adiciona cargo específico ao órgão', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => result.current.actions.addPair('TRF1', 'Juiz Federal'));
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Juiz Federal']);
  });

  it('addOrgaoAll remove pairs existentes daquele órgão (mutex)', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.addPair('TRF1', 'Analista');
      result.current.actions.addOrgaoAll('TRF1');
    });
    expect(result.current.state.orgaos.get('TRF1')).toBe('all');
  });

  it('addPair em órgão "all" substitui (mutex)', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addOrgaoAll('TRF1');
      result.current.actions.addPair('TRF1', 'Juiz Federal');
    });
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Juiz Federal']);
  });

  it('addPair acumula múltiplos cargos no mesmo órgão', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.addPair('TRF1', 'Analista');
    });
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Juiz Federal', 'Analista']);
  });

  it('removePair remove um cargo, mantém órgão se outros cargos restam', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.addPair('TRF1', 'Analista');
      result.current.actions.removePair('TRF1', 'Juiz Federal');
    });
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Analista']);
  });

  it('removePair com último cargo remove o órgão do Map', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.removePair('TRF1', 'Juiz Federal');
    });
    expect(result.current.state.orgaos.has('TRF1')).toBe(false);
  });

  it('removeOrgao remove órgão completamente (qualquer modo)', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addOrgaoAll('TRF1');
      result.current.actions.removeOrgao('TRF1');
    });
    expect(result.current.state.orgaos.has('TRF1')).toBe(false);
  });

  it('addFlatCargo adiciona cargo sem órgão', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => result.current.actions.addFlatCargo('Juiz Federal'));
    expect(result.current.state.flatCargos).toEqual(['Juiz Federal']);
  });

  it('addFlatCargo dedup', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addFlatCargo('Juiz Federal');
      result.current.actions.addFlatCargo('Juiz Federal');
    });
    expect(result.current.state.flatCargos).toEqual(['Juiz Federal']);
  });

  it('removeFlatCargo remove o cargo', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addFlatCargo('Juiz Federal');
      result.current.actions.removeFlatCargo('Juiz Federal');
    });
    expect(result.current.state.flatCargos).toEqual([]);
  });

  it('reset zera tudo', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addOrgaoAll('TRF1');
      result.current.actions.addPair('STJ', 'Ministro');
      result.current.actions.addFlatCargo('Juiz Federal');
      result.current.actions.reset();
    });
    expect(result.current.state).toEqual(EMPTY_STATE);
  });
});
```

- [ ] **Step 1.2: Rodar — devem falhar**

```bash
npx vitest run src/hooks/__tests__/useOrgaoCargoState.test.ts 2>&1 | tail -10
```

Expected: 13/13 FAIL com "Cannot find module".

- [ ] **Step 1.3: Implementar hook**

Criar `src/hooks/useOrgaoCargoState.ts`:

```typescript
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
```

- [ ] **Step 1.4: Rodar — todos devem passar**

```bash
npx vitest run src/hooks/__tests__/useOrgaoCargoState.test.ts 2>&1 | tail -10
```

Expected: 13/13 PASS.

- [ ] **Step 1.5: Commit**

```bash
cd "/d/meta novo/Metav2" && git add src/hooks/useOrgaoCargoState.ts src/hooks/__tests__/useOrgaoCargoState.test.ts && git commit -m "feat(hook): useOrgaoCargoState com mutex auto-cleanup por órgão"
```

---

## Task 2: Serialização state → backend query params

**Files:**
- Create: `D:/meta novo/Metav2/src/lib/questoes/orgao-cargo-serialization.ts`
- Test: `D:/meta novo/Metav2/src/lib/questoes/__tests__/orgao-cargo-serialization.test.ts`

Helper que transforma `OrgaoCargoState` em `{orgaos: string[], cargos: string[], org_cargo_pairs: string[]}` pro backend.

- [ ] **Step 2.1: Escrever testes primeiro**

```typescript
import { describe, it, expect } from 'vitest';
import { stateToBackendFilters } from '../orgao-cargo-serialization';
import { EMPTY_STATE } from '@/hooks/useOrgaoCargoState';

describe('stateToBackendFilters', () => {
  it('estado vazio retorna 3 arrays vazios', () => {
    expect(stateToBackendFilters(EMPTY_STATE)).toEqual({
      orgaos: [],
      cargos: [],
      org_cargo_pairs: [],
    });
  });

  it('órgão "all" → entra em flat orgaos', () => {
    const s = {
      orgaos: new Map([['TRF1', 'all' as const]]),
      flatCargos: [],
    };
    expect(stateToBackendFilters(s)).toEqual({
      orgaos: ['TRF1'],
      cargos: [],
      org_cargo_pairs: [],
    });
  });

  it('órgão com cargos específicos → vira pairs', () => {
    const s = {
      orgaos: new Map([['TRF1', ['Juiz Federal', 'Analista']]]),
      flatCargos: [],
    };
    expect(stateToBackendFilters(s)).toEqual({
      orgaos: [],
      cargos: [],
      org_cargo_pairs: ['TRF1:Juiz Federal', 'TRF1:Analista'],
    });
  });

  it('flatCargos → entra em flat cargos', () => {
    const s = {
      orgaos: new Map(),
      flatCargos: ['Juiz Federal', 'Ministro'],
    };
    expect(stateToBackendFilters(s)).toEqual({
      orgaos: [],
      cargos: ['Juiz Federal', 'Ministro'],
      org_cargo_pairs: [],
    });
  });

  it('combinação: órgão all + órgão com pairs + flat cargos', () => {
    const s = {
      orgaos: new Map<string, 'all' | string[]>([
        ['TRF1', 'all'],
        ['STJ', ['Ministro']],
      ]),
      flatCargos: ['Juiz do Trabalho'],
    };
    expect(stateToBackendFilters(s)).toEqual({
      orgaos: ['TRF1'],
      cargos: ['Juiz do Trabalho'],
      org_cargo_pairs: ['STJ:Ministro'],
    });
  });

  it('múltiplos órgãos com pairs ordem preservada', () => {
    const s = {
      orgaos: new Map<string, 'all' | string[]>([
        ['TRF1', ['Juiz Federal']],
        ['TRF2', ['Juiz Federal', 'Analista']],
      ]),
      flatCargos: [],
    };
    const result = stateToBackendFilters(s);
    expect(result.org_cargo_pairs).toEqual([
      'TRF1:Juiz Federal',
      'TRF2:Juiz Federal',
      'TRF2:Analista',
    ]);
  });
});
```

- [ ] **Step 2.2: Rodar — devem falhar**

```bash
npx vitest run src/lib/questoes/__tests__/orgao-cargo-serialization.test.ts 2>&1 | tail -10
```

Expected: 6/6 FAIL.

- [ ] **Step 2.3: Implementar**

Criar `src/lib/questoes/orgao-cargo-serialization.ts`:

```typescript
import type { OrgaoCargoState } from '@/hooks/useOrgaoCargoState';

export interface BackendOrgaoCargoFilters {
  /** Órgãos em modo 'all' — vai pra query param ?orgaos= */
  orgaos: string[];
  /** Cargos sem órgão associado — vai pra query param ?cargos= */
  cargos: string[];
  /** Pares "ORGAO:CARGO" — vai pra query param ?org_cargo_pairs= */
  org_cargo_pairs: string[];
}

/**
 * Transforma o state local do OrgaoCargoPicker em 3 arrays prontos pros
 * query params do backend. Cada órgão do Map vira flat orgao se 'all', ou
 * múltiplos pairs se array de cargos. flatCargos viram flat cargos.
 *
 * Pre-flight: backend (Plano 3b-pre-2) aceita os 3 buckets simultaneamente
 * e combina via OR no nível externo: (flat_orgao AND flat_cargo) OR pair_match.
 */
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
```

- [ ] **Step 2.4: Rodar — todos passam**

```bash
npx vitest run src/lib/questoes/__tests__/orgao-cargo-serialization.test.ts 2>&1 | tail -10
```

Expected: 6/6 PASS.

- [ ] **Step 2.5: Commit**

```bash
cd "/d/meta novo/Metav2" && git add src/lib/questoes/orgao-cargo-serialization.ts src/lib/questoes/__tests__/orgao-cargo-serialization.test.ts && git commit -m "feat(serialization): state OrgaoCargo → backend query params"
```

---

## Task 3: Estender `useQuestoesFacets` pra aceitar `org_cargo_pairs`

**Files:**
- Modify: `D:/meta novo/Metav2/src/hooks/useQuestoesFacets.ts`
- Modify: `D:/meta novo/Metav2/src/hooks/__tests__/useQuestoesFacets.test.ts`
- Modify: `D:/meta novo/Metav2/src/lib/questoes/filter-serialization.ts` (talvez)

O hook atual passa filtros via `filtersToSearchParams` que só conhece os 10 campos atuais. Precisa aceitar também `org_cargo_pairs`.

- [ ] **Step 3.1: Inspecionar `filter-serialization.ts`**

```bash
cd "/d/meta novo/Metav2" && cat src/lib/questoes/filter-serialization.ts | head -80
```

Identificar:
- Como `AppliedFilters` é definido
- Como `filtersToSearchParams` itera sobre os campos

Decisão: estender `AppliedFilters` com `org_cargo_pairs?: string[]` (opcional pra backward compat) e adicionar ao loop de serialização. OU criar wrapper que aceita filtros estendidos.

A estratégia mais simples: estender `AppliedFilters` com o campo opcional. Se vazio/undefined, comportamento atual.

- [ ] **Step 3.2: Estender `AppliedFilters` e `filtersToSearchParams`**

Em `src/lib/questoes/filter-serialization.ts`:

```typescript
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
  /** Pares (orgao, cargo) — formato "ORGAO:CARGO". Adicionado no Plano 3b-bonus. */
  org_cargo_pairs?: string[];
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
  org_cargo_pairs: [],
};
```

E adicionar no `filtersToSearchParams`:

```typescript
// Após o loop de STRING_KEYS e INT_KEYS
if (filters.org_cargo_pairs) {
  for (const pair of filters.org_cargo_pairs) {
    params.append('org_cargo_pairs', pair);
  }
}
```

- [ ] **Step 3.3: Rodar testes existentes — devem continuar verdes**

```bash
npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts src/hooks/__tests__/useQuestoesFacets.test.ts 2>&1 | tail -10
```

Expected: tudo PASS. Se algum quebrar com mudança em `EMPTY_FILTERS` ou `AppliedFilters`, ajustar conforme necessário (provavelmente nenhuma quebra porque o campo é opcional).

- [ ] **Step 3.4: Commit**

```bash
cd "/d/meta novo/Metav2" && git add src/lib/questoes/filter-serialization.ts && git commit -m "feat(serialization): suporte a org_cargo_pairs em AppliedFilters"
```

---

## Task 4: Componente `OrgaoListView` (modo 1 — lista de órgãos)

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/orgao-cargo/OrgaoListView.tsx`
- Test: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/orgao-cargo/__tests__/OrgaoListView.test.tsx`

Lista todos os órgãos do dicionário, com badge de seleção ao lado ("todos" / "3 cargos") quando o órgão está no state.

- [ ] **Step 4.1: Escrever testes primeiro**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgaoListView } from '../OrgaoListView';

const dicionario = {
  bancas: {},
  orgaos: { trf1: 'TRF1', stj: 'STJ', tj: 'TJ' },
  cargos: {},
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('OrgaoListView', () => {
  it('renderiza header e busca', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText(/Órgãos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar órgão/i)).toBeInTheDocument();
  });

  it('renderiza órgãos em ordem alfabética', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.getByText('STJ')).toBeInTheDocument();
  });

  it('badge "todos" quando órgão está em modo all', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map([['TRF1', 'all']])}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText(/todos/i)).toBeInTheDocument();
  });

  it('badge "N cargos" quando órgão tem cargos específicos', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map([['STJ', ['Ministro', 'Analista']]])}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 cargos/i)).toBeInTheDocument();
  });

  it('clicar em órgão chama onSelectOrgao', () => {
    const onSelect = vi.fn();
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={onSelect}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    expect(onSelect).toHaveBeenCalledWith('TRF1');
  });

  it('botão "Buscar cargo direto" chama onOpenFlatSearch', () => {
    const onOpen = vi.fn();
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={onOpen}
      />,
    );
    fireEvent.click(screen.getByText(/buscar cargo direto/i));
    expect(onOpen).toHaveBeenCalled();
  });

  it('search filtra a lista', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar órgão/i), { target: { value: 'TRF' } });
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.queryByText('STJ')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Implementar OrgaoListView**

```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import type { OrgaoSelection } from '@/hooks/useOrgaoCargoState';

export interface OrgaoListViewProps {
  dicionario: FiltrosDicionario | null;
  orgaosSelecionados: Map<string, OrgaoSelection>;
  onSelectOrgao: (orgao: string) => void;
  onOpenFlatSearch: () => void;
}

export function OrgaoListView({
  dicionario,
  orgaosSelecionados,
  onSelectOrgao,
  onOpenFlatSearch,
}: OrgaoListViewProps) {
  const [q, setQ] = useState('');

  const allOrgaos = useMemo(() => {
    if (!dicionario) return [];
    const unique = [...new Set(Object.values(dicionario.orgaos))].sort();
    return unique.map((v) => ({ id: v, label: v }));
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (!q.trim()) return allOrgaos;
    const norm = q.trim().toLowerCase();
    return allOrgaos.filter((i) => i.label.toLowerCase().includes(norm));
  }, [allOrgaos, q]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Órgãos</h2>
          <p className="text-xs text-slate-500">
            {allOrgaos.length} órgãos · clique para escolher cargos
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFlatSearch}
          className="text-xs text-blue-700 hover:underline shrink-0 mt-1"
        >
          Buscar cargo direto →
        </button>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar órgão…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <FilterAlphabeticList
        items={filtered}
        renderItem={(item) => {
          const sel = orgaosSelecionados.get(item.id);
          let badge: string | null = null;
          if (sel === 'all') badge = 'todos';
          else if (Array.isArray(sel)) badge = `${sel.length} cargos`;

          return (
            <button
              type="button"
              onClick={() => onSelectOrgao(item.id)}
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-left"
            >
              <span className="flex-1 text-sm text-blue-700 truncate">{item.label}</span>
              {badge && (
                <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                  {badge}
                </span>
              )}
            </button>
          );
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4.3: Rodar testes**

```bash
npx vitest run src/components/questoes/filtros/pickers/orgao-cargo/__tests__/OrgaoListView.test.tsx 2>&1 | tail -15
```

Expected: 7/7 PASS.

- [ ] **Step 4.4: Commit**

```bash
cd "/d/meta novo/Metav2" && git add src/components/questoes/filtros/pickers/orgao-cargo/OrgaoListView.tsx src/components/questoes/filtros/pickers/orgao-cargo/__tests__/OrgaoListView.test.tsx && git commit -m "feat(picker): OrgaoListView (modo 1 — lista alfabética com badge)"
```

---

## Task 5: Componente `OrgaoDrilldownView` (modo 2 — cargos do órgão)

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/orgao-cargo/OrgaoDrilldownView.tsx`
- Test: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/orgao-cargo/__tests__/OrgaoDrilldownView.test.tsx`

Mostra cargos disponíveis no órgão drilled-in, com botão destacado "Marcar todos os cargos do TRF1" no topo + lista de cargos com checkboxes + botão de voltar.

Os cargos disponíveis vêm de `facetsCargo` (filtrado por órgão via disjunctive faceting do backend) — backend já entrega só os cargos com count > 0 quando este órgão está no filtro. Entrada: `availableCargos: string[]` derivada do facet.

- [ ] **Step 5.1: Testes**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgaoDrilldownView } from '../OrgaoDrilldownView';

describe('OrgaoDrilldownView', () => {
  const baseProps = {
    orgao: 'TRF1',
    availableCargos: { 'Juiz Federal': 1234, 'Analista Judiciário': 567, 'Técnico': 89 },
    selection: 'all' as const,
    onMarkAll: vi.fn(),
    onTogglePair: vi.fn(),
    onRefineToSpecific: vi.fn(),
    onBack: vi.fn(),
    totalCount: 12345,
  };

  it('renderiza header com órgão + back button', () => {
    render(<OrgaoDrilldownView {...baseProps} />);
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.getByText(/voltar/i)).toBeInTheDocument();
  });

  it('botão "Marcar todos" com count', () => {
    render(<OrgaoDrilldownView {...baseProps} selection={undefined} />);
    expect(screen.getByText(/marcar todos/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.345/)).toBeInTheDocument();
  });

  it('botão all chama onMarkAll', () => {
    const onMark = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} selection={undefined} onMarkAll={onMark} />);
    fireEvent.click(screen.getByText(/marcar todos/i));
    expect(onMark).toHaveBeenCalledWith('TRF1');
  });

  it('quando selection é "all" mostra estado ativo + botão pra desfazer', () => {
    render(<OrgaoDrilldownView {...baseProps} selection="all" />);
    expect(screen.getByText(/todos os cargos selecionados/i)).toBeInTheDocument();
  });

  it('link "Refinar cargos individualmente" dispara onRefineToSpecific', () => {
    const onRefine = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} selection="all" onRefineToSpecific={onRefine} />);
    fireEvent.click(screen.getByText(/refinar cargos individualmente/i));
    expect(onRefine).toHaveBeenCalledWith('TRF1');
  });

  it('renderiza lista de cargos com counts', () => {
    render(<OrgaoDrilldownView {...baseProps} selection={[]} />);
    expect(screen.getByText('Juiz Federal')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('toggle de cargo chama onTogglePair', () => {
    const onToggle = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} selection={[]} onTogglePair={onToggle} />);
    fireEvent.click(screen.getByText('Juiz Federal'));
    expect(onToggle).toHaveBeenCalledWith('TRF1', 'Juiz Federal');
  });

  it('back button chama onBack', () => {
    const onBack = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByText(/voltar/i));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Implementar**

```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import type { OrgaoSelection } from '@/hooks/useOrgaoCargoState';

export interface OrgaoDrilldownViewProps {
  orgao: string;
  /** Map cargo→count vindo do facet contextual do backend */
  availableCargos: Record<string, number>;
  /** Estado atual deste órgão no state global */
  selection: OrgaoSelection | undefined;
  /** Total de questões do órgão (count global, sem refinamento de cargo) */
  totalCount?: number;
  onMarkAll: (orgao: string) => void;
  onTogglePair: (orgao: string, cargo: string) => void;
  /** Limpa o estado 'all' do órgão pra permitir seleção individual de cargos */
  onRefineToSpecific: (orgao: string) => void;
  onBack: () => void;
}

export function OrgaoDrilldownView({
  orgao,
  availableCargos,
  selection,
  totalCount,
  onMarkAll,
  onTogglePair,
  onRefineToSpecific,
  onBack,
}: OrgaoDrilldownViewProps) {
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    return Object.entries(availableCargos)
      .map(([cargo, count]) => ({ id: cargo, label: cargo, count }))
      .sort((a, b) => b.count - a.count); // mais frequentes primeiro
  }, [availableCargos]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const norm = q.trim().toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(norm));
  }, [items, q]);

  const isAllSelected = selection === 'all';
  const selectedCargos = Array.isArray(selection) ? new Set(selection) : new Set<string>();

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 self-start"
        >
          ← Voltar para órgãos
        </button>
        <h2 className="text-lg font-semibold text-slate-900">{orgao}</h2>
        <p className="text-xs text-slate-500">{items.length} cargos disponíveis</p>
      </header>

      {/* Botão destacado "Marcar todos" */}
      {isAllSelected ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex flex-col gap-1">
          <span>✓ Todos os cargos selecionados</span>
          <button
            type="button"
            onClick={() => onRefineToSpecific(orgao)}
            className="text-xs text-blue-700 hover:underline self-start"
          >
            ↳ Refinar cargos individualmente →
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onMarkAll(orgao)}
          className="w-full rounded-md bg-blue-900 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-800 transition-colors flex items-center justify-between"
        >
          <span>Marcar todos os cargos do {orgao}</span>
          {typeof totalCount === 'number' && (
            <span className="text-xs opacity-90 tabular-nums">
              {totalCount.toLocaleString('pt-BR')}
            </span>
          )}
        </button>
      )}

      {!isAllSelected && (
        <>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cargo…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => (
              <FilterCheckboxItemWithCount
                label={item.label}
                checked={selectedCargos.has(item.id)}
                onToggle={() => onTogglePair(orgao, item.id)}
                count={item.count}
              />
            )}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5.3: Rodar testes**

```bash
npx vitest run src/components/questoes/filtros/pickers/orgao-cargo/__tests__/OrgaoDrilldownView.test.tsx 2>&1 | tail -10
```

Expected: 7/7 PASS.

- [ ] **Step 5.4: Commit**

```bash
cd "/d/meta novo/Metav2" && git add src/components/questoes/filtros/pickers/orgao-cargo/OrgaoDrilldownView.tsx src/components/questoes/filtros/pickers/orgao-cargo/__tests__/OrgaoDrilldownView.test.tsx && git commit -m "feat(picker): OrgaoDrilldownView (modo 2 — cargos do órgão + botão all)"
```

---

## Task 6: Componente `CargoFlatSearchView` (modo 3 — busca direta)

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/orgao-cargo/CargoFlatSearchView.tsx`
- Test: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/orgao-cargo/__tests__/CargoFlatSearchView.test.tsx`

Lista flat de TODOS os cargos do dicionário com search + checkboxes. Top N (100) sem busca, expansível para "ver todos".

- [ ] **Step 6.1: Testes**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CargoFlatSearchView } from '../CargoFlatSearchView';

const dicionario = {
  bancas: {}, orgaos: {},
  cargos: {
    juiz: 'Juiz Federal',
    analista: 'Analista Judiciário',
    tecnico: 'Técnico Judiciário',
  },
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('CargoFlatSearchView', () => {
  it('renderiza header e back button', () => {
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={[]}
        facetsCargo={{}}
        onToggleFlatCargo={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/buscar cargo/i)).toBeInTheDocument();
    expect(screen.getByText(/voltar/i)).toBeInTheDocument();
  });

  it('search filtra cargos', () => {
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={[]}
        facetsCargo={{}}
        onToggleFlatCargo={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar cargo/i), { target: { value: 'Juiz' } });
    expect(screen.getByText('Juiz Federal')).toBeInTheDocument();
    expect(screen.queryByText('Analista Judiciário')).not.toBeInTheDocument();
  });

  it('toggle chama onToggleFlatCargo', () => {
    const onToggle = vi.fn();
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={[]}
        facetsCargo={{ 'Juiz Federal': 100 }}
        onToggleFlatCargo={onToggle}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Juiz Federal'));
    expect(onToggle).toHaveBeenCalledWith('Juiz Federal');
  });

  it('cargo selecionado aparece checked', () => {
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={['Juiz Federal']}
        facetsCargo={{}}
        onToggleFlatCargo={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const button = screen.getByText('Juiz Federal').closest('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 6.2: Implementar**

```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

const TOP_N_DEFAULT = 100;

export interface CargoFlatSearchViewProps {
  dicionario: FiltrosDicionario | null;
  flatCargosSelecionados: string[];
  facetsCargo: Record<string, number>;
  onToggleFlatCargo: (cargo: string) => void;
  onBack: () => void;
}

export function CargoFlatSearchView({
  dicionario,
  flatCargosSelecionados,
  facetsCargo,
  onToggleFlatCargo,
  onBack,
}: CargoFlatSearchViewProps) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const allCargos = useMemo(() => {
    if (!dicionario) return [];
    const unique = [...new Set(Object.values(dicionario.cargos))].sort();
    return unique;
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (q.trim()) {
      const norm = q.trim().toLowerCase();
      return allCargos.filter((c) => c.toLowerCase().includes(norm));
    }
    if (showAll) return allCargos;
    // Sem busca, mostra Top N por count desc
    return [...allCargos]
      .sort((a, b) => (facetsCargo[b] ?? 0) - (facetsCargo[a] ?? 0))
      .slice(0, TOP_N_DEFAULT);
  }, [allCargos, q, showAll, facetsCargo]);

  const items = filtered.map((c) => ({ id: c, label: c }));
  const selected = new Set(flatCargosSelecionados);

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 self-start"
        >
          ← Voltar para órgãos
        </button>
        <h2 className="text-lg font-semibold text-slate-900">Buscar cargo direto</h2>
        <p className="text-xs text-slate-500">
          {q.trim() || showAll
            ? `${filtered.length} de ${allCargos.length} cargos`
            : `Top ${TOP_N_DEFAULT} mais comuns · ${allCargos.length} no total`}
        </p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar cargo…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <FilterAlphabeticList
        items={items}
        renderItem={(item) => (
          <FilterCheckboxItemWithCount
            label={item.label}
            checked={selected.has(item.id)}
            onToggle={() => onToggleFlatCargo(item.id)}
            count={facetsCargo[item.id]}
          />
        )}
      />

      {!q.trim() && !showAll && allCargos.length > TOP_N_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-blue-700 hover:underline self-start mt-2"
        >
          Ver todos os {allCargos.length.toLocaleString('pt-BR')} cargos →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6.3: Rodar testes**

```bash
npx vitest run src/components/questoes/filtros/pickers/orgao-cargo/__tests__/CargoFlatSearchView.test.tsx 2>&1 | tail -10
```

Expected: 4/4 PASS.

- [ ] **Step 6.4: Commit**

```bash
cd "/d/meta novo/Metav2" && git add src/components/questoes/filtros/pickers/orgao-cargo/CargoFlatSearchView.tsx src/components/questoes/filtros/pickers/orgao-cargo/__tests__/CargoFlatSearchView.test.tsx && git commit -m "feat(picker): CargoFlatSearchView (modo 3 — busca flat de cargo)"
```

---

## Task 7: Refatorar `OrgaoCargoPicker` shell + atualizar dev preview

**Files:**
- Rewrite: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/OrgaoCargoPicker.tsx`
- Update: `D:/meta novo/Metav2/src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx`
- Update: `D:/meta novo/Metav2/src/app/dev/filter-pickers/page.tsx`

`OrgaoCargoPicker` agora é um shell que:
1. Mantém estado de modo (`'list' | 'drilldown' | 'flat-search'`) + qual órgão está aberto
2. Delega render pra um dos 3 view components
3. Recebe `state: OrgaoCargoState` + `actions: OrgaoCargoActions` do pai (via `useOrgaoCargoState`)
4. Recebe `facetsCargo: Record<string, number>` que vem contextual ao órgão drilled (pai filtra)

- [ ] **Step 7.1: Reescrever OrgaoCargoPicker**

Nova interface (totalmente diferente da atual):

```typescript
'use client';
import { useState } from 'react';
import { OrgaoListView } from './orgao-cargo/OrgaoListView';
import { OrgaoDrilldownView } from './orgao-cargo/OrgaoDrilldownView';
import { CargoFlatSearchView } from './orgao-cargo/CargoFlatSearchView';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import type { OrgaoCargoState, OrgaoCargoActions } from '@/hooks/useOrgaoCargoState';

type ViewMode = 'list' | { type: 'drilldown'; orgao: string } | 'flat-search';

export interface OrgaoCargoPickerProps {
  dicionario: FiltrosDicionario | null;
  state: OrgaoCargoState;
  actions: OrgaoCargoActions;
  /** Facets de cargo CONTEXTUAL — quando há órgão drilled, deve refletir só cargos daquele órgão */
  facetsCargo: Record<string, number>;
  /** Total de questões do órgão drilled (vindo de facets.orgao[orgao_atual]) */
  drilldownOrgaoTotalCount?: number;
}

export function OrgaoCargoPicker({
  dicionario,
  state,
  actions,
  facetsCargo,
  drilldownOrgaoTotalCount,
}: OrgaoCargoPickerProps) {
  const [view, setView] = useState<ViewMode>('list');

  if (view === 'list') {
    return (
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={state.orgaos}
        onSelectOrgao={(orgao) => setView({ type: 'drilldown', orgao })}
        onOpenFlatSearch={() => setView('flat-search')}
      />
    );
  }

  if (view === 'flat-search') {
    return (
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={state.flatCargos}
        facetsCargo={facetsCargo}
        onToggleFlatCargo={(cargo) => {
          if (state.flatCargos.includes(cargo)) actions.removeFlatCargo(cargo);
          else actions.addFlatCargo(cargo);
        }}
        onBack={() => setView('list')}
      />
    );
  }

  // Drilldown
  return (
    <OrgaoDrilldownView
      orgao={view.orgao}
      availableCargos={facetsCargo}
      selection={state.orgaos.get(view.orgao)}
      totalCount={drilldownOrgaoTotalCount}
      onMarkAll={(orgao) => actions.addOrgaoAll(orgao)}
      onTogglePair={(orgao, cargo) => {
        const sel = state.orgaos.get(orgao);
        if (Array.isArray(sel) && sel.includes(cargo)) {
          actions.removePair(orgao, cargo);
        } else {
          actions.addPair(orgao, cargo);
        }
      }}
      onRefineToSpecific={(orgao) => actions.removeOrgao(orgao)}
      onBack={() => setView('list')}
    />
  );
}
```

- [ ] **Step 7.2: Reescrever testes do shell**

Apagar testes antigos do OrgaoCargoPicker (test file substituído). Criar testes novos cobrindo:
- Modo inicial = list
- Click em órgão → muda pra drilldown
- Click em "Buscar cargo direto" → muda pra flat-search
- Voltar → retorna pra list
- onMarkAll dispara actions.addOrgaoAll
- onTogglePair dispara addPair/removePair conforme estado

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgaoCargoPicker } from '../OrgaoCargoPicker';
import { EMPTY_STATE } from '@/hooks/useOrgaoCargoState';

const dicionario = {
  bancas: {},
  orgaos: { trf1: 'TRF1', stj: 'STJ' },
  cargos: { juiz: 'Juiz Federal' },
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

const noopActions = {
  addOrgaoAll: vi.fn(), addPair: vi.fn(), removePair: vi.fn(),
  removeOrgao: vi.fn(), addFlatCargo: vi.fn(), removeFlatCargo: vi.fn(),
  reset: vi.fn(),
};

describe('OrgaoCargoPicker shell', () => {
  it('modo inicial = list', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{}}
      />,
    );
    expect(screen.getByText(/Órgãos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar órgão/i)).toBeInTheDocument();
  });

  it('clicar em órgão → drilldown', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{ 'Juiz Federal': 100 }}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    expect(screen.getByText(/marcar todos/i)).toBeInTheDocument();
    expect(screen.getByText('Juiz Federal')).toBeInTheDocument();
  });

  it('clicar "Buscar cargo direto" → flat-search', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{}}
      />,
    );
    fireEvent.click(screen.getByText(/buscar cargo direto/i));
    expect(screen.getByText(/buscar cargo direto/i)).toBeInTheDocument();
  });

  it('voltar do drilldown → list', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{}}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    fireEvent.click(screen.getByText(/voltar/i));
    expect(screen.getByPlaceholderText(/buscar órgão/i)).toBeInTheDocument();
  });

  it('marcar todos chama actions.addOrgaoAll', () => {
    const actions = { ...noopActions, addOrgaoAll: vi.fn() };
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={actions}
        facetsCargo={{}}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    fireEvent.click(screen.getByText(/marcar todos/i));
    expect(actions.addOrgaoAll).toHaveBeenCalledWith('TRF1');
  });
});
```

- [ ] **Step 7.3: Atualizar dev preview page**

Em `src/app/dev/filter-pickers/page.tsx`, substituir o uso atual do `OrgaoCargoPicker` (que recebia `selectedOrgaos`/`onChangeOrgaos`/etc) pela nova API:

```typescript
import { useOrgaoCargoState } from '@/hooks/useOrgaoCargoState';
import { stateToBackendFilters } from '@/lib/questoes/orgao-cargo-serialization';

// ... dentro do FilterPickersContent:
const { state: orgaoCargoState, actions: orgaoCargoActions } = useOrgaoCargoState();
const orgaoCargoBackend = stateToBackendFilters(orgaoCargoState);

// useQuestoesFacets agora recebe os 3 arrays (orgaos, cargos, org_cargo_pairs):
const { facets } = useQuestoesFacets({
  bancas, anos,
  orgaos: orgaoCargoBackend.orgaos,
  cargos: orgaoCargoBackend.cargos,
  org_cargo_pairs: orgaoCargoBackend.org_cargo_pairs,
});

// E ao renderizar OrgaoCargoPicker no caso 'orgao_cargo':
{tab === 'orgao_cargo' && (
  <OrgaoCargoPicker
    dicionario={dicionario ?? null}
    state={orgaoCargoState}
    actions={orgaoCargoActions}
    facetsCargo={facets.cargo ?? {}}
  />
)}
```

Remover os states locais antigos (`orgaos`, `cargos` separados como string[]) — agora vivem dentro de `orgaoCargoState`.

Atualizar o painel JSON de "Estado atual" pra mostrar `Object.fromEntries(orgaoCargoState.orgaos)` (Map não serializa direto).

- [ ] **Step 7.4: Rodar testes do shell + dev page renderiza**

```bash
npx vitest run src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx 2>&1 | tail -10
```

Expected: 5/5 PASS.

```bash
npx tsc --noEmit 2>&1 | grep -E "OrgaoCargo|orgao-cargo|filter-pickers" | head
```

Expected: 0 errors.

- [ ] **Step 7.5: Commit**

```bash
cd "/d/meta novo/Metav2" && git add \
  src/components/questoes/filtros/pickers/OrgaoCargoPicker.tsx \
  src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx \
  src/app/dev/filter-pickers/page.tsx \
  && git commit -m "feat(picker): OrgaoCargoPicker shell com 3 modos (list/drilldown/flat-search)"
```

---

## Task 8: tsc + suite + push + PR

- [ ] **Step 8.1: tsc final**

```bash
npx tsc --noEmit 2>&1 | grep -E "useOrgaoCargoState|orgao-cargo-serialization|OrgaoListView|OrgaoDrilldownView|CargoFlatSearchView|OrgaoCargoPicker|filter-pickers" | head
```

Expected: 0 errors.

- [ ] **Step 8.2: Suite completa dos novos arquivos**

```bash
npx vitest run \
  src/hooks/__tests__/useOrgaoCargoState.test.ts \
  src/lib/questoes/__tests__/orgao-cargo-serialization.test.ts \
  src/components/questoes/filtros/pickers/orgao-cargo/__tests__/ \
  src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx \
  2>&1 | tail -10
```

Expected: ~30+ testes PASS, 0 falhas.

- [ ] **Step 8.3: Validação visual em localhost**

```bash
npm run dev
# Abrir http://localhost:3000/dev/filter-pickers, tab "orgao_cargo"
```

Critérios visuais:
- Modo inicial: lista de órgãos com botão "Buscar cargo direto →" no topo direito
- Click num órgão → drilldown com botão azul destacado "Marcar todos os cargos do TRF1 (count)"
- Click em "Marcar todos" → estado "✓ Todos os cargos selecionados" + lista de cargos some
- Voltar pra lista → órgão aparece com badge amber "todos"
- Reabrir órgão → drilldown mostra estado all, com botão pra desmarcar (clicar no estado ativo deveria voltar pra modo de cargos individuais — opcional, fora do escopo se não trivial)
- Click em "Buscar cargo direto" → mostra Top 100 cargos por count desc + busca
- Selecionar cargo via flat → vira badge "1 cargo flat" (visual a definir, simples)

Anotar bugs visuais como tasks de follow-up se houver.

- [ ] **Step 8.4: Push**

```bash
git push -u origin feat/questoes-orgao-cargo-drilldown
```

- [ ] **Step 8.5: Criar PR**

Título: `feat(picker): OrgaoCargoPicker drilldown master-detail + flat-search modes`

Body:
```markdown
## Summary
Reescreve OrgaoCargoPicker substituindo as 2 listas planas anteriores (órgãos + 41k cargos lado a lado) por um picker master-detail com 3 modos:

1. **Lista de órgãos** (entry point) — alfabética, cada órgão mostra badge de seleção ("todos" / "N cargos")
2. **Drilldown** (clicou num órgão) — botão destacado "Marcar todos do X" + lista de cargos disponíveis NAQUELE órgão (via facet contextual)
3. **Flat search** (clicou "Buscar cargo direto") — Top 100 cargos por count desc + search expansível pra todos

## State model
```ts
{ orgaos: Map<string, 'all' | string[]>, flatCargos: string[] }
```

Auto-cleanup com mutex por órgão: marcar 'all' remove pairs do mesmo órgão, e vice-versa. Garante que painel de filtros ativos nunca mostra estado redundante.

## Backend integration
Consome o `org_cargo_pairs` query param do Plano 3b-pre-2 (já em produção). Serialização:
- Órgãos 'all' → `?orgaos=`
- Cargos com órgão → `?org_cargo_pairs=ORGAO:CARGO`
- flatCargos → `?cargos=`

Combinação no backend: `(flat_orgao AND flat_cargo) OR pair_match` — sem cross-product semântico ao misturar drill com flat-search.

## Files
- Hook: `useOrgaoCargoState` (reducer + actions + selectors)
- Lib: `orgao-cargo-serialization.ts` (state → query params)
- Components: `OrgaoListView`, `OrgaoDrilldownView`, `CargoFlatSearchView` em `pickers/orgao-cargo/`
- Shell: `OrgaoCargoPicker` reescrito (modo router)
- Dev page: atualizada pra novo state model

## Test plan
- [x] useOrgaoCargoState (13 testes — mutex, dedup, reset)
- [x] Serialization (6 testes — empty, all, pairs, combinações)
- [x] OrgaoListView (7 testes — render, badge, search, navegação)
- [x] OrgaoDrilldownView (7 testes — botão all, toggle, voltar)
- [x] CargoFlatSearchView (4 testes — render, search, toggle)
- [x] OrgaoCargoPicker shell (5 testes — modo router)
- [x] Validação visual em /dev/filter-pickers
```

- [ ] **Step 8.6: Coolify auto-deploy + smoke**

Após merge, Coolify deploya. Smoke check: abrir `/questoes` em produção, ir pra tab Filtros, verificar que `OrgaoCargoPicker` (quando wirado no card de Plano 3c — fora do escopo aqui) ainda funciona. Se o card ainda usa o picker antigo, esse PR não toca a UX de produção — apenas o dev preview.

---

## Critérios de aceite

- [ ] 3 modos navegáveis no `/dev/filter-pickers`
- [ ] Botão destacado "Marcar todos" funciona e mostra count
- [ ] Auto-cleanup mutex evita estado redundante
- [ ] Estado JSON na painel direito da dev page reflete state model corretamente (orgaos como dict, flatCargos como array, org_cargo_pairs computado)
- [ ] Backend recebe `org_cargo_pairs` quando há drilldown ativo
- [ ] Sem regressão tsc/vitest

## Fora de escopo

- Wiring do novo OrgaoCargoPicker no card real de filtros da página `/questoes` (Plano 3c)
- Persistência de `OrgaoCargoState` em URL search params (Plano 3c)
- Conversão de `OrgaoCargoState` ↔ `AppliedFilters` da URL (Plano 3c)
- Animações de transição entre modos (Plano 3c)

## Próximo plano

- **Plano 3c** — card + drawer + chip strip wirando os 5 pickers (Banca, Ano, Materia, OrgaoCargo novo, e os 2 dropados se forem retomados)

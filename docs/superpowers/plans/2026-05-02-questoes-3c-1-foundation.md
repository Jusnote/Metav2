# Plano 3c-1 — Foundation (Draft Context + Visibility Toggles na URL)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação de estado pra o novo card de filtros — `QuestoesFilterDraftContext` (pendentes vs aplicados) + extensão de `filter-serialization.ts` com 2 toggles de visibilidade funcionais — sem nenhuma UI nova.

**Architecture:** Context isolado do `QuestoesContext` legacy. Estado pendente em `useState` + persistência em `sessionStorage`. Estado aplicado lido da URL via `useSearchParams`. Hook `useFiltrosPendentes` expõe pendentes, aplicados, isDirty, setPendentes, apply, reset. Toggles de visibilidade entram em `AppliedFilters` como `'mostrar' | 'esconder'` (default `mostrar` omitido na URL).

**Tech Stack:** React 19, TypeScript, react-router-dom (`useSearchParams`), Vitest + happy-dom + @testing-library/react.

**Spec base:** [`docs/superpowers/specs/2026-05-01-questoes-card-drawer-3c-design.md`](../specs/2026-05-01-questoes-card-drawer-3c-design.md) — seções (11) URL serialization estendida e (12) DraftContext.

---

## File Structure

```
src/lib/questoes/
  filter-serialization.ts                    MODIFICAR (extender)
  __tests__/filter-serialization.test.ts     CRIAR
src/contexts/
  QuestoesFilterDraftContext.tsx             CRIAR
  __tests__/QuestoesFilterDraftContext.test.tsx  CRIAR
src/hooks/
  useFiltrosPendentes.ts                     CRIAR (wrapper fino do contexto)
```

**Responsabilidades:**
- `filter-serialization.ts` — fonte canônica de tipos + (de)serialização URLSearchParams. Stateless.
- `QuestoesFilterDraftContext.tsx` — provider + estado pendente + sessionStorage + hidratação URL.
- `useFiltrosPendentes.ts` — wrapper fino que expõe API limpa do contexto.

---

## Pré-requisitos

- Branch: criar `feat/questoes-3c-1-draft-context` a partir de `main` (ou da branch atual após merge de `fix/dev-preview-css-import`).
- Verificar que `npm install` está atualizado: `npm i`
- Verificar que vitest roda: `npx vitest run --reporter=verbose 2>&1 | head -20` (tem que mostrar setup OK)

---

## Task 1: Definir tipo `VisibilityState` e estender `AppliedFilters`

**Files:**
- Modify: `src/lib/questoes/filter-serialization.ts`
- Test: `src/lib/questoes/__tests__/filter-serialization.test.ts` (criar)

- [ ] **Step 1.1: Criar arquivo de teste com primeiro caso (extensão do tipo)**

Cria `src/lib/questoes/__tests__/filter-serialization.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS,
  type AppliedFilters,
  type VisibilityState,
} from '../filter-serialization';

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
```

- [ ] **Step 1.2: Rodar teste, verificar que falha**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: FAIL — "VisibilityState is not exported" ou similar.

- [ ] **Step 1.3: Adicionar tipo `VisibilityState` e campos opcionais em `AppliedFilters`**

Em `src/lib/questoes/filter-serialization.ts`, logo antes de `export interface AppliedFilters`:

```typescript
export type VisibilityState = 'mostrar' | 'esconder';
```

E dentro de `AppliedFilters`, após `org_cargo_pairs?`:

```typescript
  /** Visibilidade de questões anuladas. Default 'mostrar' (omitido na URL). */
  visibility_anuladas?: VisibilityState;
  /** Visibilidade de questões desatualizadas. Default 'mostrar' (omitido na URL). */
  visibility_desatualizadas?: VisibilityState;
```

Em `EMPTY_FILTERS`, **não adicionar campo** — undefined é o default semântico.

- [ ] **Step 1.4: Rodar teste, verificar que passa**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: PASS — 2/2 testes.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/questoes/filter-serialization.ts src/lib/questoes/__tests__/filter-serialization.test.ts
git commit -m "feat(questoes): VisibilityState type + visibility_anuladas/desatualizadas em AppliedFilters"
```

---

## Task 2: Serializar `visibility_anuladas` direto pro formato do backend (`?anulada=false`)

**Decisão arquitetural:** o backend aceita `?anulada=true|false` e `?desatualizada=true|false` (booleans). A URL canônica fala o "idioma" do backend. O state interno mantém semântica `'mostrar' | 'esconder'`. A tradução acontece em `filtersToSearchParams` e `searchParamsToFilters`.

| State interno | URL gerada | Significado |
|---|---|---|
| `visibility_anuladas: undefined` | (omitido) | sem filtro — backend retorna todas |
| `visibility_anuladas: 'mostrar'` | (omitido) | mesmo que undefined |
| `visibility_anuladas: 'esconder'` | `?anulada=false` | backend filtra fora as anuladas |

**Files:**
- Modify: `src/lib/questoes/filter-serialization.ts` (função `filtersToSearchParams`)
- Test: `src/lib/questoes/__tests__/filter-serialization.test.ts`

- [ ] **Step 2.1: Adicionar testes pra serialização (formato backend)**

Adiciona ao `filter-serialization.test.ts`:

```typescript
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  type AppliedFilters,
  type VisibilityState,
} from '../filter-serialization';

describe('filtersToSearchParams — visibility toggles', () => {
  it('default "mostrar" não aparece na URL', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'mostrar',
      visibility_desatualizadas: 'mostrar',
    };
    const params = filtersToSearchParams(filters);
    expect(params.has('anulada')).toBe(false);
    expect(params.has('desatualizada')).toBe(false);
  });

  it('undefined não aparece na URL', () => {
    const filters: AppliedFilters = { ...EMPTY_FILTERS };
    const params = filtersToSearchParams(filters);
    expect(params.has('anulada')).toBe(false);
    expect(params.has('desatualizada')).toBe(false);
  });

  it('"esconder" vira ?anulada=false', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'esconder',
    };
    const params = filtersToSearchParams(filters);
    expect(params.get('anulada')).toBe('false');
    expect(params.has('desatualizada')).toBe(false);
  });

  it('ambos "esconder" produzem anulada=false e desatualizada=false', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'esconder',
      visibility_desatualizadas: 'esconder',
    };
    const params = filtersToSearchParams(filters);
    expect(params.get('anulada')).toBe('false');
    expect(params.get('desatualizada')).toBe('false');
  });
});
```

- [ ] **Step 2.2: Rodar testes, verificar que falham**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: FAIL — `filtersToSearchParams` não emite `anulada` / `desatualizada`.

- [ ] **Step 2.3: Estender `filtersToSearchParams` traduzindo pra formato backend**

Em `src/lib/questoes/filter-serialization.ts`, na função `filtersToSearchParams`, antes de `return params`:

```typescript
  // visibility toggles → params do backend (anulada / desatualizada bool)
  // 'esconder' = "filtrar fora" → anulada=false / desatualizada=false
  // 'mostrar' / undefined = sem filtro (omitido)
  if (filters.visibility_anuladas === 'esconder') {
    params.set('anulada', 'false');
  }
  if (filters.visibility_desatualizadas === 'esconder') {
    params.set('desatualizada', 'false');
  }
```

- [ ] **Step 2.4: Rodar testes, PASS**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/questoes/filter-serialization.ts src/lib/questoes/__tests__/filter-serialization.test.ts
git commit -m "feat(questoes): serializar visibility toggles para formato backend (?anulada=false / ?desatualizada=false)"
```

---

## Task 3: Desserializar `?anulada=false` → `visibility_anuladas='esconder'`

**Files:**
- Modify: `src/lib/questoes/filter-serialization.ts` (função `searchParamsToFilters`)
- Test: `src/lib/questoes/__tests__/filter-serialization.test.ts`

- [ ] **Step 3.1: Adicionar testes pra deserialização**

Adiciona ao `filter-serialization.test.ts`:

```typescript
import { searchParamsToFilters } from '../filter-serialization';

describe('searchParamsToFilters — visibility toggles', () => {
  it('URL sem params → undefined', () => {
    const filters = searchParamsToFilters(new URLSearchParams());
    expect(filters.visibility_anuladas).toBeUndefined();
    expect(filters.visibility_desatualizadas).toBeUndefined();
  });

  it('URL com anulada=false → visibility_anuladas="esconder"', () => {
    const params = new URLSearchParams('anulada=false');
    const filters = searchParamsToFilters(params);
    expect(filters.visibility_anuladas).toBe('esconder');
    expect(filters.visibility_desatualizadas).toBeUndefined();
  });

  it('URL com desatualizada=false → visibility_desatualizadas="esconder"', () => {
    const params = new URLSearchParams('desatualizada=false');
    const filters = searchParamsToFilters(params);
    expect(filters.visibility_desatualizadas).toBe('esconder');
  });

  it('URL com anulada=true → undefined (apenas false significa esconder)', () => {
    // anulada=true semanticamente seria "somente anuladas" — fora do escopo do
    // toggle binário Mostrar/Esconder. Tratado como sem filtro pra evitar
    // estado intermediário desconhecido.
    const params = new URLSearchParams('anulada=true');
    const filters = searchParamsToFilters(params);
    expect(filters.visibility_anuladas).toBeUndefined();
  });

  it('URL com valor inválido → undefined', () => {
    const params = new URLSearchParams('anulada=foo');
    const filters = searchParamsToFilters(params);
    expect(filters.visibility_anuladas).toBeUndefined();
  });
});
```

- [ ] **Step 3.2: Rodar testes, verificar que falham**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: FAIL — parser não extrai visibility.

- [ ] **Step 3.3: Estender `searchParamsToFilters`**

Em `src/lib/questoes/filter-serialization.ts`, dentro de `searchParamsToFilters`, antes do `return out`:

```typescript
  if (params.get('anulada') === 'false') {
    out.visibility_anuladas = 'esconder';
  }
  if (params.get('desatualizada') === 'false') {
    out.visibility_desatualizadas = 'esconder';
  }
```

- [ ] **Step 3.4: Rodar testes, PASS**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: PASS.

- [ ] **Step 3.5: Round-trip test**

Adicionar:

```typescript
describe('round-trip: filters → params → filters', () => {
  it('preserva visibility_anuladas="esconder"', () => {
    const original: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'esconder',
    };
    const params = filtersToSearchParams(original);
    const restored = searchParamsToFilters(params);
    expect(restored.visibility_anuladas).toBe('esconder');
  });

  it('default "mostrar" não survive round-trip (vira undefined)', () => {
    const original: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'mostrar',
    };
    const params = filtersToSearchParams(original);
    const restored = searchParamsToFilters(params);
    expect(restored.visibility_anuladas).toBeUndefined();
  });
});
```

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: PASS.

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/questoes/filter-serialization.ts src/lib/questoes/__tests__/filter-serialization.test.ts
git commit -m "feat(questoes): desserializar ?anulada=false / ?desatualizada=false → visibility state interno"
```

---

## Task 4: Atualizar `hasAnyFilter` e `countActiveFilters`

**Files:**
- Modify: `src/lib/questoes/filter-serialization.ts` (`hasAnyFilter`, `countActiveFilters`)
- Test: `src/lib/questoes/__tests__/filter-serialization.test.ts`

- [ ] **Step 4.1: Testes pra contagem**

Adiciona:

```typescript
import { hasAnyFilter, countActiveFilters } from '../filter-serialization';

describe('hasAnyFilter — visibility toggles', () => {
  it('só visibility_anuladas=esconder conta como filtro', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'esconder',
    };
    expect(hasAnyFilter(filters)).toBe(true);
  });

  it('visibility_anuladas=mostrar não conta', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'mostrar',
    };
    expect(hasAnyFilter(filters)).toBe(false);
  });
});

describe('countActiveFilters — visibility toggles', () => {
  it('visibility_anuladas=esconder conta +1', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'esconder',
    };
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('ambos esconder conta +2', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'esconder',
      visibility_desatualizadas: 'esconder',
    };
    expect(countActiveFilters(filters)).toBe(2);
  });

  it('mostrar não conta', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      visibility_anuladas: 'mostrar',
      visibility_desatualizadas: 'mostrar',
    };
    expect(countActiveFilters(filters)).toBe(0);
  });
});
```

- [ ] **Step 4.2: Rodar, verificar falhas**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: FAIL — countActiveFilters retorna 0 mesmo com esconder.

- [ ] **Step 4.3: Atualizar funções**

Em `hasAnyFilter`, antes do último `||`:

```typescript
    filters.tipos.length > 0 ||
    filters.formatos.length > 0 ||
    filters.visibility_anuladas === 'esconder' ||
    filters.visibility_desatualizadas === 'esconder'
```

Em `countActiveFilters`, antes do último `+`:

```typescript
    filters.tipos.length +
    filters.formatos.length +
    (filters.visibility_anuladas === 'esconder' ? 1 : 0) +
    (filters.visibility_desatualizadas === 'esconder' ? 1 : 0)
```

- [ ] **Step 4.4: Rodar, verificar PASS**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: PASS — todos.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/questoes/filter-serialization.ts src/lib/questoes/__tests__/filter-serialization.test.ts
git commit -m "feat(questoes): hasAnyFilter e countActiveFilters consideram visibility toggles"
```

---

## Task 5: Esqueleto do `QuestoesFilterDraftContext`

**Files:**
- Create: `src/contexts/QuestoesFilterDraftContext.tsx`
- Create: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 5.1: Criar teste do hook lança erro fora do provider**

Cria `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';

describe('useFiltrosPendentes — fora do provider', () => {
  it('lança erro descritivo', () => {
    expect(() => renderHook(() => useFiltrosPendentes())).toThrow(
      /must be used within QuestoesFilterDraftProvider/,
    );
  });
});
```

- [ ] **Step 5.2: Rodar, ver falha (módulo não existe)**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — "Cannot find module '@/hooks/useFiltrosPendentes'".

- [ ] **Step 5.3: Criar contexto + hook**

Cria `src/contexts/QuestoesFilterDraftContext.tsx`:

```tsx
'use client';
import React, { createContext, useContext } from 'react';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

export interface QuestoesFilterDraftValue {
  pendentes: AppliedFilters;
  aplicados: AppliedFilters;
  isDirty: boolean;
  setPendentes: (next: AppliedFilters) => void;
  apply: () => void;
  reset: () => void;
}

const QuestoesFilterDraftContext = createContext<QuestoesFilterDraftValue | null>(
  null,
);

export function useQuestoesFilterDraft(): QuestoesFilterDraftValue {
  const ctx = useContext(QuestoesFilterDraftContext);
  if (!ctx) {
    throw new Error(
      'useQuestoesFilterDraft must be used within QuestoesFilterDraftProvider',
    );
  }
  return ctx;
}

export function QuestoesFilterDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Implementação real virá nas próximas tasks. Stub mínimo:
  const value: QuestoesFilterDraftValue = {
    pendentes: EMPTY_FILTERS,
    aplicados: EMPTY_FILTERS,
    isDirty: false,
    setPendentes: () => {},
    apply: () => {},
    reset: () => {},
  };
  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
```

Cria `src/hooks/useFiltrosPendentes.ts`:

```typescript
import { useQuestoesFilterDraft } from '@/contexts/QuestoesFilterDraftContext';

export function useFiltrosPendentes() {
  return useQuestoesFilterDraft();
}
```

- [ ] **Step 5.4: Rodar, ver PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/hooks/useFiltrosPendentes.ts src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): QuestoesFilterDraftContext esqueleto + useFiltrosPendentes hook"
```

---

## Task 6: Hidratar `aplicados` da URL na montagem

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 6.1: Setup de teste com router**

Adiciona ao top do arquivo de teste:

```tsx
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';

function wrapper(initialEntries: string[] = ['/']) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QuestoesFilterDraftProvider>{children}</QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}
```

- [ ] **Step 6.2: Teste de hidratação básica**

Adiciona:

```tsx
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

describe('aplicados (hidratação da URL)', () => {
  it('URL vazia → aplicados = EMPTY_FILTERS', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });
    expect(result.current.aplicados).toEqual(EMPTY_FILTERS);
  });

  it('URL com bancas=cespe → aplicados.bancas = ["cespe"]', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    expect(result.current.aplicados.bancas).toEqual(['cespe']);
  });

  it('URL com visibility_anuladas=esconder → aplicados reflete', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?visibility_anuladas=esconder']),
    });
    expect(result.current.aplicados.visibility_anuladas).toBe('esconder');
  });
});
```

- [ ] **Step 6.3: Rodar, ver falhas**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — todos retornam EMPTY_FILTERS porque o stub é fixo.

- [ ] **Step 6.4: Implementar hidratação no provider**

Substitui o body de `QuestoesFilterDraftProvider`:

```tsx
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchParamsToFilters } from '@/lib/questoes/filter-serialization';

export function QuestoesFilterDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchParams] = useSearchParams();

  const aplicados = useMemo(
    () => searchParamsToFilters(searchParams),
    [searchParams],
  );

  const value: QuestoesFilterDraftValue = {
    pendentes: aplicados, // ainda sem state — vem na task 7
    aplicados,
    isDirty: false,
    setPendentes: () => {},
    apply: () => {},
    reset: () => {},
  };
  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
```

- [ ] **Step 6.5: Rodar, ver PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS — 4/4 (3 novos + 1 do erro fora de provider).

- [ ] **Step 6.6: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): hidratar aplicados a partir da URL via useSearchParams"
```

---

## Task 7: Estado `pendentes` editável + `setPendentes`

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 7.1: Testes pra setPendentes**

Adiciona:

```tsx
import { act } from '@testing-library/react';

describe('setPendentes', () => {
  it('atualiza pendentes sem afetar aplicados', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.aplicados.bancas).toEqual([]);
  });

  it('pendentes inicia igual a aplicados na montagem', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.aplicados.bancas).toEqual(['cespe']);
  });
});
```

- [ ] **Step 7.2: Rodar, ver falhas**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — setPendentes é no-op, pendentes não muda.

- [ ] **Step 7.3: Adicionar useState pra pendentes + setPendentes real**

No body de `QuestoesFilterDraftProvider`, substituir tudo por:

```tsx
import { useMemo, useState, useCallback } from 'react';

export function QuestoesFilterDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchParams] = useSearchParams();

  const aplicados = useMemo(
    () => searchParamsToFilters(searchParams),
    [searchParams],
  );

  const [pendentes, setPendentesState] = useState<AppliedFilters>(aplicados);

  const setPendentes = useCallback((next: AppliedFilters) => {
    setPendentesState(next);
  }, []);

  const value: QuestoesFilterDraftValue = {
    pendentes,
    aplicados,
    isDirty: false,
    setPendentes,
    apply: () => {},
    reset: () => {},
  };

  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
```

- [ ] **Step 7.4: Rodar, ver PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): pendentes editável via setPendentes (inicia = aplicados)"
```

---

## Task 8: Computar `isDirty` (pendentes ≠ aplicados)

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 8.1: Testes pra isDirty**

Adiciona:

```tsx
describe('isDirty', () => {
  it('false quando pendentes = aplicados na montagem', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('true após setPendentes que muda valor', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('false quando pendentes volta a ser igual a aplicados', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['fgv'],
      });
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.isDirty).toBe(false);
  });
});
```

- [ ] **Step 8.2: Rodar, ver falhas**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — isDirty está hardcoded false.

- [ ] **Step 8.3: Implementar comparação canônica via serialização**

No `QuestoesFilterDraftContext.tsx`, adicionar import e substituir a montagem do `value`:

```tsx
import { filtersToSearchParams } from '@/lib/questoes/filter-serialization';

// ... dentro do provider, antes de `const value`:

const isDirty = useMemo(() => {
  const a = filtersToSearchParams(pendentes).toString();
  const b = filtersToSearchParams(aplicados).toString();
  // Ordenar pra comparação canônica (URLSearchParams não ordena chaves)
  const sortedA = a.split('&').sort().join('&');
  const sortedB = b.split('&').sort().join('&');
  return sortedA !== sortedB;
}, [pendentes, aplicados]);

const value: QuestoesFilterDraftValue = {
  pendentes,
  aplicados,
  isDirty,
  setPendentes,
  apply: () => {},
  reset: () => {},
};
```

- [ ] **Step 8.4: Rodar, ver PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): isDirty via comparação canônica de URL params"
```

---

## Task 9: `apply()` — serializa pendentes pra URL

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 9.1: Testes pra apply**

Adiciona:

```tsx
import { useLocation } from 'react-router-dom';

function useProbeWithLocation() {
  const draft = useFiltrosPendentes();
  const location = useLocation();
  return { draft, location };
}

describe('apply()', () => {
  it('escreve pendentes na URL e zera isDirty', () => {
    const { result } = renderHook(() => useProbeWithLocation(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.draft.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.draft.isDirty).toBe(true);

    act(() => {
      result.current.draft.apply();
    });

    expect(result.current.location.search).toContain('bancas=cespe');
    expect(result.current.draft.isDirty).toBe(false);
    expect(result.current.draft.aplicados.bancas).toEqual(['cespe']);
  });

  it('apply preserva search param `view` se existir', () => {
    const { result } = renderHook(() => useProbeWithLocation(), {
      wrapper: wrapper(['/questoes?view=filtros']),
    });

    act(() => {
      result.current.draft.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
      result.current.draft.apply();
    });

    expect(result.current.location.search).toContain('view=filtros');
    expect(result.current.location.search).toContain('bancas=cespe');
  });
});
```

- [ ] **Step 9.2: Rodar, ver falhas**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — apply é no-op.

- [ ] **Step 9.3: Implementar apply**

No provider, ajustar import e adicionar lógica:

```tsx
const [searchParams, setSearchParams] = useSearchParams();

// ...

const apply = useCallback(() => {
  const next = filtersToSearchParams(pendentes);
  // Preservar view (controlado pelo tab strip)
  const currentView = searchParams.get('view');
  if (currentView) {
    next.set('view', currentView);
  }
  setSearchParams(next, { replace: true });
}, [pendentes, searchParams, setSearchParams]);

// ...

const value: QuestoesFilterDraftValue = {
  pendentes,
  aplicados,
  isDirty,
  setPendentes,
  apply,
  reset: () => {},
};
```

- [ ] **Step 9.4: Rodar, ver PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): apply() escreve pendentes na URL preservando ?view"
```

---

## Task 10: `reset()` — pendentes := aplicados

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 10.1: Testes pra reset**

Adiciona:

```tsx
describe('reset()', () => {
  it('reverte pendentes pra aplicados', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['fgv'],
      });
    });
    expect(result.current.pendentes.bancas).toEqual(['fgv']);
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.isDirty).toBe(false);
  });
});
```

- [ ] **Step 10.2: Rodar, ver falha**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — reset é no-op.

- [ ] **Step 10.3: Implementar reset**

```tsx
const reset = useCallback(() => {
  setPendentesState(aplicados);
}, [aplicados]);

// ...

const value: QuestoesFilterDraftValue = {
  pendentes,
  aplicados,
  isDirty,
  setPendentes,
  apply,
  reset,
};
```

- [ ] **Step 10.4: Rodar, PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS.

- [ ] **Step 10.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): reset() reverte pendentes pra aplicados"
```

---

## Task 11: Persistir `pendentes` no `sessionStorage`

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 11.1: Testes pra sessionStorage**

Adiciona ao top do arquivo de teste:

```tsx
import { beforeEach } from 'vitest';

beforeEach(() => {
  sessionStorage.clear();
});
```

E o describe novo:

```tsx
describe('sessionStorage persistence', () => {
  const STORAGE_KEY = 'questoes_filter_draft';

  it('persiste pendentes em setPendentes', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });

    const stored = sessionStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.bancas).toEqual(['cespe']);
  });

  it('hidrata pendentes do sessionStorage na montagem (URL ainda vazia)', () => {
    const stored = { ...EMPTY_FILTERS, bancas: ['fgv'] };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    expect(result.current.pendentes.bancas).toEqual(['fgv']);
    expect(result.current.aplicados.bancas).toEqual([]);
    expect(result.current.isDirty).toBe(true);
  });

  it('URL params têm prioridade sobre sessionStorage (deep link)', () => {
    const stored = { ...EMPTY_FILTERS, bancas: ['fgv'] };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });

    // Deep link: pendentes = aplicados (URL), drop draft anterior
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.aplicados.bancas).toEqual(['cespe']);
    expect(result.current.isDirty).toBe(false);
  });

  it('limpa sessionStorage após apply()', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    act(() => {
      result.current.apply();
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 11.2: Rodar, ver falhas**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: FAIL — sessionStorage não é tocado.

- [ ] **Step 11.3: Implementar persistência**

No top de `QuestoesFilterDraftContext.tsx`:

```tsx
const STORAGE_KEY = 'questoes_filter_draft';

function loadDraft(): AppliedFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppliedFilters;
  } catch {
    return null;
  }
}

function saveDraft(filters: AppliedFilters): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // sessionStorage cheio — ignora
  }
}

function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}
```

Modificar inicialização do `pendentes` no provider:

```tsx
const [pendentes, setPendentesState] = useState<AppliedFilters>(() => {
  // 1. Se URL tem filtros (deep link), aplicados venceu → pendentes = aplicados
  // 2. Senão, tenta hidratar do sessionStorage
  // 3. Senão, usa aplicados (= EMPTY_FILTERS quando URL vazia)
  const aplicadosInicial = searchParamsToFilters(searchParams);
  const hasUrlFilters = filtersToSearchParams(aplicadosInicial).toString() !== '';
  if (hasUrlFilters) {
    clearDraft();
    return aplicadosInicial;
  }
  const stored = loadDraft();
  return stored ?? aplicadosInicial;
});
```

Modificar `setPendentes`:

```tsx
const setPendentes = useCallback((next: AppliedFilters) => {
  setPendentesState(next);
  saveDraft(next);
}, []);
```

Modificar `apply`:

```tsx
const apply = useCallback(() => {
  const next = filtersToSearchParams(pendentes);
  const currentView = searchParams.get('view');
  if (currentView) {
    next.set('view', currentView);
  }
  setSearchParams(next, { replace: true });
  clearDraft();
}, [pendentes, searchParams, setSearchParams]);
```

- [ ] **Step 11.4: Rodar, ver PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS — todos.

- [ ] **Step 11.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): persistir pendentes em sessionStorage com prioridade URL > storage"
```

---

## Task 12: Re-hidratar quando URL muda externamente (browser back/forward)

**Files:**
- Modify: `src/contexts/QuestoesFilterDraftContext.tsx`
- Modify: `src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`

- [ ] **Step 12.1: Teste pra navegação externa**

Adiciona:

```tsx
import { useNavigate } from 'react-router-dom';

function useProbeWithNav() {
  const draft = useFiltrosPendentes();
  const navigate = useNavigate();
  return { draft, navigate };
}

describe('navegação externa (back/forward)', () => {
  it('aplicados muda quando URL muda; pendentes acompanha se não estiver dirty', () => {
    const { result } = renderHook(() => useProbeWithNav(), {
      wrapper: wrapper(['/questoes']),
    });

    expect(result.current.draft.aplicados.bancas).toEqual([]);

    act(() => {
      result.current.navigate('/questoes?bancas=cespe');
    });

    expect(result.current.draft.aplicados.bancas).toEqual(['cespe']);
    expect(result.current.draft.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.draft.isDirty).toBe(false);
  });
});
```

- [ ] **Step 12.2: Rodar, ver se passa ou falha**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: provável FAIL — pendentes não acompanha mudança de aplicados (state inicializou no mount, não atualiza).

- [ ] **Step 12.3: Adicionar useEffect que sincroniza pendentes com aplicados quando URL muda externamente**

Adicionar import:

```tsx
import { useEffect, useRef } from 'react';
```

E dentro do provider, antes do `value`:

```tsx
const aplicadosRef = useRef(aplicados);

useEffect(() => {
  // Quando aplicados muda (URL externa), sincroniza pendentes E descarta draft
  // (deep-link semantics: URL é fonte da verdade pra estado canônico).
  const aChanged =
    filtersToSearchParams(aplicadosRef.current).toString() !==
    filtersToSearchParams(aplicados).toString();
  if (aChanged) {
    setPendentesState(aplicados);
    clearDraft();
    aplicadosRef.current = aplicados;
  }
}, [aplicados]);
```

- [ ] **Step 12.4: Rodar, PASS**

Run: `npx vitest run src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx`
Expected: PASS.

- [ ] **Step 12.5: Commit**

```bash
git add src/contexts/QuestoesFilterDraftContext.tsx src/contexts/__tests__/QuestoesFilterDraftContext.test.tsx
git commit -m "feat(questoes): sincronizar pendentes com aplicados quando URL muda externamente"
```

---

## Task 13: Smoke test integração URL → backend

**Files:**
- Test: `src/lib/questoes/__tests__/filter-serialization.test.ts`

Como Tasks 2-3 já produzem URL no formato backend, `useQuestoesCount` (que usa `filtersToSearchParams` internamente) automaticamente envia `?anulada=false` quando `visibility_anuladas: 'esconder'`. Sem mudanças em hooks.

- [ ] **Step 13.1: Teste de query string completa pra `/questoes/count`**

Adicionar em `src/lib/questoes/__tests__/filter-serialization.test.ts`:

```typescript
describe('integração: query string pro backend', () => {
  it('com bancas + ano + visibility produz query no formato backend', () => {
    const filters: AppliedFilters = {
      ...EMPTY_FILTERS,
      bancas: ['cespe'],
      anos: [2023],
      visibility_anuladas: 'esconder',
      visibility_desatualizadas: 'esconder',
    };
    const query = filtersToSearchParams(filters).toString();
    expect(query).toContain('bancas=cespe');
    expect(query).toContain('anos=2023');
    expect(query).toContain('anulada=false');
    expect(query).toContain('desatualizada=false');
    // E NÃO deve conter o nome interno
    expect(query).not.toContain('visibility_anuladas');
  });
});
```

- [ ] **Step 13.2: Rodar — passa direto (código já está certo)**

Run: `npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts`
Expected: PASS.

- [ ] **Step 13.3: Commit**

```bash
git add src/lib/questoes/__tests__/filter-serialization.test.ts
git commit -m "test(questoes): smoke test integração URL → backend (visibility toggles)"
```

---

## Task 14: Montar `QuestoesFilterDraftProvider` em volta do bloco da tab Filtros

**Files:**
- Modify: `src/views/QuestoesPage.tsx:154-163` (bloco `{filterView === 'filtros' && ...}`)

> **Nota:** O 3c-3 vai ativar UI atrás da flag. Aqui só montamos o provider pra que `useFiltrosPendentes` esteja disponível em qualquer descendente futuro. `QuestoesFilterBar` legacy não consome esse hook, então é zero-impacto visual.

> **Decisão:** o provider envolve **só** o bloco da tab Filtros principal (linhas 154-163). **NÃO** envolve a `QuestoesFilterBar` dentro do overlay Ctrl+K (linha ~212) — esse overlay continua usando o caminho legacy isoladamente, sem precisar de draft state.

- [ ] **Step 14.1: Adicionar import**

Em `src/views/QuestoesPage.tsx`, adicionar junto aos outros imports:

```tsx
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';
```

- [ ] **Step 14.2: Envolver o bloco `filterView === 'filtros'` com o provider**

**Código atual** (linhas ~154-163):

```tsx
{filterView === 'filtros' && (
  <>
    {/* Seção OBJETIVO — só na aba Filtros */}
    <ObjetivoSection />
    <div className="pt-2 pb-2">
      <QuestoesFilterBar onPopoverChange={setHasOpenPopover} onSearch={handleSearch} />
    </div>
    <FilterChipsBidirectional onSearch={handleSearch} />
  </>
)}
```

**Substituir por:**

```tsx
{filterView === 'filtros' && (
  <QuestoesFilterDraftProvider>
    {/* Seção OBJETIVO — só na aba Filtros */}
    <ObjetivoSection />
    <div className="pt-2 pb-2">
      <QuestoesFilterBar onPopoverChange={setHasOpenPopover} onSearch={handleSearch} />
    </div>
    <FilterChipsBidirectional onSearch={handleSearch} />
  </QuestoesFilterDraftProvider>
)}
```

(Trocar `<>` `</>` por `<QuestoesFilterDraftProvider>` `</QuestoesFilterDraftProvider>` — Fragment não é mais necessário porque o provider já é o wrapper único.)

- [ ] **Step 14.3: TypeCheck**

Run: `npx tsc --noEmit`
Expected: zero erros novos.

- [ ] **Step 14.4: Smoke test no dev server**

Em terminal separado: `npm run dev`
Abrir: `http://localhost:3000/questoes?view=filtros`

Expected:
- Página renderiza idêntica à versão anterior
- OBJETIVO + QuestoesFilterBar legacy funcionam normal
- Console sem warnings novos
- Trocar de tab pra Cadernos/Questões/Semântico e voltar funciona

- [ ] **Step 14.5: Commit**

```bash
git add src/views/QuestoesPage.tsx
git commit -m "feat(questoes): montar QuestoesFilterDraftProvider na tab Filtros (provider inerte; 3c-3 ativa UI)"
```

---

## Task 15: Smoke test final + suite completa

- [ ] **Step 15.1: Rodar suite completa**

Run: `npx vitest run`
Expected: 0 failures.

- [ ] **Step 15.2: Verificar build de produção**

Run: `npm run build:dev`
Expected: build completa sem warnings novos.

- [ ] **Step 15.3: Push da branch**

```bash
git push -u origin feat/questoes-3c-1-draft-context
```

- [ ] **Step 15.4: Abrir PR pro main**

```bash
gh pr create --title "feat(questoes): 3c-1 — Draft Context + Visibility Toggles na URL" --body "$(cat <<'EOF'
## Summary
- `QuestoesFilterDraftContext` + `useFiltrosPendentes` — pendentes vs aplicados, isDirty, sessionStorage, URL hydration
- Extensão de `AppliedFilters` com `visibility_anuladas` e `visibility_desatualizadas`
- Tradução `visibility_*` ↔ `anulada=false / desatualizada=false` no parse/serialize
- Provider montado em `QuestoesPage` (sem consumidor — UI nova vem no 3c-3)

## Plan
docs/superpowers/plans/2026-05-02-questoes-3c-1-foundation.md

## Test plan
- [ ] `npx vitest run src/lib/questoes/__tests__/` passa
- [ ] `npx vitest run src/contexts/__tests__/` passa
- [ ] `npm run build:dev` sem erros
- [ ] `/questoes?view=filtros` renderiza igual a antes (sem regressão visual)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Definition of Done — 3c-1

- ✅ `AppliedFilters` tem `visibility_anuladas?: VisibilityState` e `visibility_desatualizadas?: VisibilityState`
- ✅ `filter-serialization.ts` traduz visibility ↔ `?anulada=false / ?desatualizada=false`
- ✅ `QuestoesFilterDraftContext` expõe `pendentes / aplicados / isDirty / setPendentes / apply / reset`
- ✅ Hidratação prioriza URL > sessionStorage > defaults
- ✅ `apply()` preserva `?view=`
- ✅ Browser back/forward atualiza aplicados E pendentes
- ✅ Provider montado em `QuestoesPage` sem regressão visual
- ✅ Suite completa de testes passa (>=15 novos casos)
- ✅ PR aberto e revisado

## Próximos passos

Após merge do 3c-1, abrir branch `feat/questoes-3c-2-card-drawer-chips` e seguir o plano `2026-05-02-questoes-3c-2-card-drawer-chips.md` (a ser escrito).

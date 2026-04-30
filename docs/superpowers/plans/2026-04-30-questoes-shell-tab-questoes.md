# Plano 2 — Frontend shell + tab Questões (Metav2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refator de `QuestoesPage` para 4 tabs com URL sync (`?view=filtros|semantico|cadernos|questoes`). Tab "Questões" vira destino de "Aplicar filtros" com chips de filtros aplicados + sort + view + lista virtualizada. Tab "Filtros" mantém `QuestoesFilterBar` legacy nessa fase. Adiciona foundation hooks (`useQuestoesCount`, `filter-serialization`) que o Plano 3 usará.

**Architecture:** Mesma página `/questoes`, tab strip URL-synced via search params do react-router-dom. Tab Questões consome filtros aplicados da URL via `useQuestoesV2` (sem mudanças). Botão "Buscar" da `QuestoesFilterBar` agora também navega `?view=questoes` (além de chamar `triggerSearch` do contexto). Botão "Editar filtros" na tab Questões volta `?view=filtros`. Sort/view persistem em `localStorage`.

**Tech Stack:** React 19 · TypeScript · Next.js 15 (mas roteamento client-side via react-router-dom) · Tailwind CSS · shadcn/ui

**Repo alvo:** `D:/meta novo/Metav2` (este repo)

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md` (seções 1, 4, 6)

**Plano anterior:** `docs/superpowers/plans/2026-04-29-questoes-count-endpoint.md` (mergeado em produção via `feat/questoes-count-endpoint`; endpoint live em `https://api.projetopapiro.com.br/api/v1/questoes/count`)

**Fora de escopo (Plano 3 cobre):**
- Card novo de filtros com chip strip + drawer 2 colunas
- Pickers individuais (Banca, Ano, Órgão·Cargo, Escolaridade, Área Carreira, Matéria·Assuntos)
- Mobile bottom sheet do card
- `QuestoesFilterDraftContext` (modelo "pendentes vs aplicados")
- Painel direito "FILTROS ATIVOS · N" com accent amber + Aplicar/Editar qtd

---

## Pré-flight

- [ ] **Step 0.1: Verificar branch e estado limpo do repo**

```bash
git -C "/d/meta novo/Metav2" status --short
git -C "/d/meta novo/Metav2" branch --show-current
```

Expected: branch atual é `feat/taxonomia-tec-dir-adm` ou `main`. Confirme com o usuário antes de criar branch novo se houver mudanças não commitadas relevantes.

- [ ] **Step 0.2: Garantir que está em `main` atualizado**

```bash
git -C "/d/meta novo/Metav2" checkout main
git -C "/d/meta novo/Metav2" pull origin main
```

Expected: working tree atualizado com `main` upstream.

- [ ] **Step 0.3: Criar branch novo**

```bash
git -C "/d/meta novo/Metav2" checkout -b feat/questoes-shell-tab-questoes
```

Expected: `Switched to a new branch 'feat/questoes-shell-tab-questoes'`

- [ ] **Step 0.4: Smoke build da baseline**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -20
```

Expected: build sucesso. Se falhar, parar e reportar.

---

## Task 1: Filter serialization (URL params ↔ objeto)

**Files:**
- Create: `D:/meta novo/Metav2/src/lib/questoes/filter-serialization.ts`
- Test: `D:/meta novo/Metav2/src/lib/questoes/__tests__/filter-serialization.test.ts`

**Por que:** Centraliza a tradução entre objeto de filtros JS e `URLSearchParams`. Atualmente espalhado em `QuestoesContext.tsx` (`searchParamsToFilters` interna). Plano 2 reusa pra hook `useQuestoesCount` e Plano 3 reusa pra cache key.

- [ ] **Step 1.1: Verificar se vitest está configurado**

```bash
cd "/d/meta novo/Metav2" && cat package.json | grep -E '"test"|vitest|jest' | head -5
```

Se nenhum framework de teste estiver configurado, parar e reportar `BLOCKED — sem framework de testes`. (Pular para Task 2 com testes manuais documentados em comentário.)

- [ ] **Step 1.2: Escrever teste falhando**

Criar `D:/meta novo/Metav2/src/lib/questoes/__tests__/filter-serialization.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  filtersToSearchParams,
  searchParamsToFilters,
  type AppliedFilters,
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
    // anos não veio → array vazio
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
```

- [ ] **Step 1.3: Rodar e confirmar que falha**

```bash
cd "/d/meta novo/Metav2" && npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts 2>&1 | tail -10
```

Expected: erro de import (módulo não existe ainda).

- [ ] **Step 1.4: Implementar módulo**

Criar `D:/meta novo/Metav2/src/lib/questoes/filter-serialization.ts`:

```typescript
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
```

- [ ] **Step 1.5: Rodar testes e confirmar que passam**

```bash
cd "/d/meta novo/Metav2" && npx vitest run src/lib/questoes/__tests__/filter-serialization.test.ts 2>&1 | tail -10
```

Expected: 6 passed.

- [ ] **Step 1.6: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/lib/questoes/filter-serialization.ts src/lib/questoes/__tests__/filter-serialization.test.ts
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): filter-serialization (URL params <-> AppliedFilters)"
```

---

## Task 2: Hook `useQuestoesCount`

**Files:**
- Create: `D:/meta novo/Metav2/src/hooks/useQuestoesCount.ts`
- Test: `D:/meta novo/Metav2/src/hooks/__tests__/useQuestoesCount.test.ts` (skip se framework não estiver configurado — comentar nos steps)

**Por que:** Hook consumido no Plano 3 pelo painel direito do drawer. Adicionado no Plano 2 pra:
1. Validar end-to-end que o frontend conversa com `/questoes/count` corretamente
2. Servir como referência pra outros hooks (debounce, AbortController, cache LRU)

- [ ] **Step 2.1: Implementar hook**

Criar `D:/meta novo/Metav2/src/hooks/useQuestoesCount.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { filtersToSearchParams } from '@/lib/questoes/filter-serialization';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.projetopapiro.com.br';

const DEBOUNCE_MS = 300;
const LOCAL_CACHE_MAX = 50;

export interface CountState {
  count: number | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  tookMs: number | null;
}

const initialState: CountState = {
  count: null,
  loading: false,
  error: null,
  cached: false,
  tookMs: null,
};

class LRUCache<K, V> {
  private map: Map<K, V> = new Map();
  constructor(private max: number) {}
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
  }
}

const lruCache = new LRUCache<string, { count: number; tookMs: number }>(LOCAL_CACHE_MAX);

function buildCacheKey(filters: AppliedFilters): string {
  const params = filtersToSearchParams(filters);
  const entries = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

export function useQuestoesCount(filters: AppliedFilters): CountState {
  const [state, setState] = useState<CountState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const cacheKey = buildCacheKey(filters);
    const localHit = lruCache.get(cacheKey);

    if (localHit) {
      setState({
        count: localHit.count,
        loading: false,
        error: null,
        cached: true,
        tookMs: localHit.tookMs,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      const params = filtersToSearchParams(filters);
      const url = `${API_BASE}/api/v1/questoes/count?${params.toString()}`;

      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<{
            count: number;
            took_ms: number;
            cached: boolean;
          }>;
        })
        .then((data) => {
          lruCache.set(cacheKey, { count: data.count, tookMs: data.took_ms });
          setState({
            count: data.count,
            loading: false,
            error: null,
            cached: data.cached,
            tookMs: data.took_ms,
          });
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setState({
            count: null,
            loading: false,
            error: err.message,
            cached: false,
            tookMs: null,
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [filters]);

  return state;
}
```

- [ ] **Step 2.2: Smoke import**

```bash
cd "/d/meta novo/Metav2" && npx tsc --noEmit src/hooks/useQuestoesCount.ts 2>&1 | tail -10
```

Expected: sem erros TS. Se `tsc` falhar com configuração, rodar build incremental:
```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | grep -i "useQuestoesCount\|error" | head -10
```
Sem output relacionado ao novo arquivo = sucesso.

- [ ] **Step 2.3: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/hooks/useQuestoesCount.ts
git -C "/d/meta novo/Metav2" commit -m "feat(hook): useQuestoesCount com debounce 300ms + AbortController + LRU"
```

---

## Task 3: URL sync da tab strip

**Files:**
- Modify: `D:/meta novo/Metav2/src/views/QuestoesPage.tsx`

**Por que:** Hoje a tab strip usa `useState` local. Pra back-button e shareable links, mover pra search param `?view=`. Adicionar 4ª tab "Questões" (afastada à direita) sem conteúdo ainda — Task 5 e 6 plugam.

- [ ] **Step 3.1: Atualizar tipo `FilterView` e adicionar 'questoes'**

Em `src/views/QuestoesPage.tsx`, linha 37:

```typescript
type FilterView = 'filtros' | 'semantico' | 'cadernos' | 'questoes';

const FILTER_VIEW_LABELS: Record<FilterView, string> = {
  filtros: 'Filtros',
  semantico: 'Filtro semântico',
  cadernos: 'Cadernos',
  questoes: 'Questões',
};

const VALID_VIEWS: readonly FilterView[] = ['filtros', 'semantico', 'cadernos', 'questoes'];

function parseViewParam(raw: string | null): FilterView {
  if (raw && (VALID_VIEWS as readonly string[]).includes(raw)) {
    return raw as FilterView;
  }
  return 'filtros';
}
```

- [ ] **Step 3.2: Trocar `useState` por `useSearchParams` pra tab strip**

Localizar a declaração `const [filterView, setFilterView] = useState<FilterView>('filtros');` (linha ~57) e substituir por:

```typescript
import { useSearchParams } from 'react-router-dom';
// (adicionar ao bloco de imports do topo)

// dentro do componente:
const [searchParams, setSearchParams] = useSearchParams();
const filterView = parseViewParam(searchParams.get('view'));

const setFilterView = useCallback((view: FilterView) => {
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (view === 'filtros') {
      next.delete('view'); // default não polui URL
    } else {
      next.set('view', view);
    }
    return next;
  });
}, [setSearchParams]);
```

Verificar se `useSearchParams` já está importado de `react-router-dom`. Caso já exista no contexto (`QuestoesContext`), o import direto aqui é independente — manter.

- [ ] **Step 3.3: Renderizar a tab strip com 4 tabs (Questões afastada)**

Substituir o bloco `<nav aria-label="Modo de filtro">` (linhas ~115-138) por:

```typescript
<nav
  className="inline-flex items-center gap-[8px]"
  aria-label="Modo de filtro"
>
  <div className="inline-flex items-center gap-[2px] rounded-full bg-[#f1f5f9] p-[3px]">
    {(['filtros', 'semantico', 'cadernos'] as FilterView[]).map((view) => {
      const active = filterView === view;
      return (
        <button
          key={view}
          type="button"
          onClick={() => setFilterView(view)}
          className={[
            'rounded-full px-[14px] py-[6px] text-[12px] transition-all',
            active
              ? 'bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)] font-semibold'
              : 'bg-transparent text-[#64748b] font-medium hover:text-[#0f172a]',
          ].join(' ')}
        >
          {FILTER_VIEW_LABELS[view]}
        </button>
      );
    })}
  </div>

  {/* Separador visual */}
  <div className="h-5 w-px bg-[#e2e8f0]" aria-hidden="true" />

  {/* Tab Questões — afastada */}
  <button
    type="button"
    onClick={() => setFilterView('questoes')}
    className={[
      'rounded-full px-[14px] py-[6px] text-[12px] transition-all',
      filterView === 'questoes'
        ? 'bg-[#0f172a] text-white font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.12)]'
        : 'bg-[#f1f5f9] text-[#64748b] font-medium hover:text-[#0f172a]',
    ].join(' ')}
  >
    {FILTER_VIEW_LABELS.questoes}
  </button>
</nav>
```

- [ ] **Step 3.4: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -20
```

Expected: build passa.

- [ ] **Step 3.5: Smoke manual via dev server**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Em outro terminal/aba:
1. Abrir `http://localhost:3000/questoes` — deve cair em Filtros (default)
2. Clicar em "Filtro semântico" — URL vira `?view=semantico`
3. Clicar em "Filtros" — URL volta sem query
4. Clicar em "Questões" — URL vira `?view=questoes` (conteúdo ainda igual ao Filtros, vai ser plugado em Task 6)
5. Botão voltar do navegador — alterna entre tabs corretamente

Se algum desses 5 passos falhar, parar e reportar.

- [ ] **Step 3.6: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/views/QuestoesPage.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): tab strip URL-synced + 4ª tab Questões"
```

---

## Task 4: Component `QuestoesActiveFiltersChips`

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/lista/QuestoesActiveFiltersChips.tsx`

**Por que:** No topo da tab Questões, mostrar resumo do que tá filtrado + botão "Editar filtros" que volta `?view=filtros`.

- [ ] **Step 4.1: Implementar componente**

Criar diretório se não existir e o arquivo:

```bash
mkdir -p "/d/meta novo/Metav2/src/components/questoes/lista"
```

Criar `D:/meta novo/Metav2/src/components/questoes/lista/QuestoesActiveFiltersChips.tsx`:

```typescript
import { ArrowLeft } from 'lucide-react';
import { useQuestoesContext } from '@/contexts/QuestoesContext';
import { Button } from '@/components/ui/button';

interface QuestoesActiveFiltersChipsProps {
  onEditFilters: () => void;
}

interface ChipGroup {
  label: string;
  values: string[];
}

export function QuestoesActiveFiltersChips({ onEditFilters }: QuestoesActiveFiltersChipsProps) {
  const { committedFilters, committedQuery } = useQuestoesContext();

  const groups: ChipGroup[] = [
    { label: 'Banca', values: committedFilters.bancas ?? [] },
    { label: 'Ano', values: (committedFilters.anos ?? []).map(String) },
    { label: 'Matéria', values: committedFilters.materias ?? [] },
    { label: 'Assunto', values: committedFilters.assuntos ?? [] },
    { label: 'Órgão', values: committedFilters.orgaos ?? [] },
    { label: 'Cargo', values: committedFilters.cargos ?? [] },
  ].filter((g) => g.values.length > 0);

  const totalChips = groups.reduce((sum, g) => sum + g.values.length, 0);
  const hasAny = totalChips > 0 || (committedQuery && committedQuery.trim().length > 0);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#f1f5f9]">
      <Button
        variant="outline"
        size="sm"
        onClick={onEditFilters}
        className="shrink-0 h-8 gap-1.5 text-xs"
      >
        <ArrowLeft className="h-3 w-3" />
        Editar filtros
      </Button>

      {hasAny ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 pt-1">
          {committedQuery && committedQuery.trim().length > 0 && (
            <span className="text-xs text-slate-600">
              <span className="text-slate-400 mr-1">Busca:</span>
              <span className="font-medium text-slate-800">"{committedQuery}"</span>
            </span>
          )}
          {groups.map((g) => (
            <span key={g.label} className="text-xs text-slate-600">
              <span className="text-slate-400 mr-1">{g.label}:</span>
              <span className="font-medium text-slate-800">{g.values.join(', ')}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-slate-400 pt-1.5">Nenhum filtro aplicado</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: Verificar tipos do contexto**

```bash
grep -n "committedFilters\|committedQuery" "/d/meta novo/Metav2/src/contexts/QuestoesContext.tsx" | head -10
```

Confirmar que `committedFilters` e `committedQuery` existem no tipo retornado por `useQuestoesContext`. Se algum nome divergir (ex: `appliedFilters`), ajustar imports/usos no componente.

- [ ] **Step 4.3: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -10
```

Expected: sem erros.

- [ ] **Step 4.4: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/components/questoes/lista/QuestoesActiveFiltersChips.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): QuestoesActiveFiltersChips para topo da tab Questões"
```

---

## Task 5: Component `QuestoesListaView`

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/lista/QuestoesListaView.tsx`

**Por que:** Conteúdo da tab Questões — encapsula chips + sort + view + status tabs + lista virtualizada. Será plugado em `QuestoesPage` na Task 6.

- [ ] **Step 5.1: Implementar componente**

Criar `D:/meta novo/Metav2/src/components/questoes/lista/QuestoesListaView.tsx`:

```typescript
import { useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronDown, List, Square } from 'lucide-react';
import { useQuestoesContext } from '@/contexts/QuestoesContext';
import type { StatusTab, SortOption, ViewMode } from '@/contexts/QuestoesContext';
import { QuestoesResultsHeader } from '@/components/questoes/QuestoesResultsHeader';
import { VirtualizedQuestionList } from '@/components/questoes/VirtualizedQuestionList';
import { QuestoesActiveFiltersChips } from './QuestoesActiveFiltersChips';

const SORT_LABELS: Record<SortOption, string> = {
  recentes: 'Mais recentes',
  dificuldade: 'Mais dificeis',
  menos_resolvidas: 'Menos resolvidas',
  relevancia: 'Relevancia IA',
};

const TAB_LABELS: Record<StatusTab, string> = {
  todas: 'Todas',
  nao_resolvidas: 'Nao resolvidas',
  erradas: 'Erradas',
  marcadas: 'Marcadas',
};

const SORT_KEY = 'questoes:sortBy';
const VIEW_KEY = 'questoes:viewMode';

interface QuestoesListaViewProps {
  onEditFilters: () => void;
}

export function QuestoesListaView({ onEditFilters }: QuestoesListaViewProps) {
  const { statusTab, setStatusTab, sortBy, setSortBy, viewMode, setViewMode } = useQuestoesContext();

  // Hidratar sort/view do localStorage na 1ª montagem
  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(SORT_KEY) as SortOption | null;
      if (savedSort && SORT_LABELS[savedSort]) setSortBy(savedSort);
      const savedView = localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (savedView === 'lista' || savedView === 'individual') setViewMode(savedView);
    } catch {
      // localStorage indisponível — ignora
    }
  }, [setSortBy, setViewMode]);

  // Persistir sort/view ao mudar
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sortBy);
    } catch {
      // ignora
    }
  }, [sortBy]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      // ignora
    }
  }, [viewMode]);

  return (
    <div className="flex flex-col gap-2">
      <QuestoesActiveFiltersChips onEditFilters={onEditFilters} />

      <QuestoesResultsHeader />

      <div className="flex items-center justify-between pb-4 pt-2 gap-2">
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatusTab(v as StatusTab)}
          className="w-auto"
        >
          <TabsList className="h-8">
            {(Object.keys(TAB_LABELS) as StatusTab[]).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs px-3 h-7">
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-md border border-border p-0.5 bg-white/60">
            <button
              onClick={() => setViewMode('lista')}
              className={`inline-flex items-center justify-center h-7 w-7 rounded-sm transition-colors ${
                viewMode === 'lista'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('individual')}
              className={`inline-flex items-center justify-center h-7 w-7 rounded-sm transition-colors ${
                viewMode === 'individual'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Individual"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <ArrowUpDown className="h-3 w-3" />
                {SORT_LABELS[sortBy]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <DropdownMenuRadioItem key={opt} value={opt} className="text-sm">
                    {SORT_LABELS[opt]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <VirtualizedQuestionList />
    </div>
  );
}
```

- [ ] **Step 5.2: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -10
```

Expected: sem erros.

- [ ] **Step 5.3: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/components/questoes/lista/QuestoesListaView.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): QuestoesListaView (chips + sort + view + lista) com persist localStorage"
```

---

## Task 6: Plugar Lista na tab Questões + remover lista do bloco antigo

**Files:**
- Modify: `D:/meta novo/Metav2/src/views/QuestoesPage.tsx`

**Por que:** Hoje a lista virtualizada + sort + view + status tabs aparecem SEMPRE abaixo dos 4 tabs (na seção branca). Plano 2 move tudo isso pra dentro da tab Questões só.

- [ ] **Step 6.1: Importar `QuestoesListaView`**

No bloco de imports do topo, adicionar:

```typescript
import { QuestoesListaView } from '@/components/questoes/lista/QuestoesListaView';
```

- [ ] **Step 6.2: Adicionar handler `editFilters`**

Dentro do componente `QuestoesPage`, adicionar:

```typescript
const editFilters = useCallback(() => {
  setFilterView('filtros');
}, [setFilterView]);
```

- [ ] **Step 6.3: Renderizar conteúdo da tab Questões**

Localizar o bloco `{filterView === 'cadernos' && (...)` (linha ~164) e adicionar logo após:

```typescript
{filterView === 'questoes' && (
  <div className="pt-2 pb-2">
    <QuestoesListaView onEditFilters={editFilters} />
  </div>
)}
```

- [ ] **Step 6.4: Esconder QuestoesResultsHeader, status tabs, sort/view e lista quando não for tab Questões**

Localizar o bloco a partir de `<QuestoesResultsHeader />` (linha ~171) até o fechamento da `<section>` que envolve a `<VirtualizedQuestionList />` (linha ~274).

Esses elementos hoje aparecem SEMPRE. Envolver tudo em condicional `filterView === 'questoes' ? null : ...` **NÃO** — o objetivo é mostrar SÓ na tab Questões. Como agora estão dentro de `QuestoesListaView` (que é renderizada via Step 6.3), os elementos antigos viram **redundantes** e devem ser **removidos** do shell.

Substituir o bloco antigo por nada (deletar):

```typescript
// REMOVER ESSE BLOCO (linhas ~170-235 originais):
//   <QuestoesResultsHeader />
//   <div className="flex items-center justify-between pb-4 pt-2 gap-2">
//     ...status tabs + view mode + sort dropdown...
//   </div>
```

E o bloco da seção branca:

```typescript
// REMOVER esse bloco (linhas ~267-274):
//   <section className="flex-1 min-h-0 bg-white">
//     <div className="max-w-5xl mx-auto w-full h-full px-2 pt-4">
//       <QuestoesFilterOverlay visible={hasOpenPopover && !ctrlKOpen}>
//         <VirtualizedQuestionList />
//       </QuestoesFilterOverlay>
//     </div>
//   </section>
```

**Atenção ao `QuestoesFilterOverlay`** — ele protegia a lista contra clicks quando popover de filtro estava aberto. Como agora a lista só aparece em outra tab (`view=questoes`), e popovers só abrem na tab `filtros`, o overlay não é mais necessário no shell. Pode remover.

Resultado: o shell de `QuestoesPage` fica enxuto — só renderiza header (título + tabs), o conteúdo da tab ativa, e o Ctrl+K overlay. A lista vive dentro de `QuestoesListaView` (tab Questões).

- [ ] **Step 6.5: Verificar imports não usados**

Após remoções, alguns imports ficam órfãos. Conferir e remover de QuestoesPage.tsx:

- `QuestoesResultsHeader`
- `VirtualizedQuestionList`
- `QuestoesFilterOverlay`
- `Tabs, TabsList, TabsTrigger`
- `DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger`
- `Button`
- `ChevronDown, ArrowUpDown, List, Square`
- `SORT_LABELS` (constante local, agora em ListaView)
- `TAB_LABELS` (idem)
- Hook destructured: `sortBy, setSortBy, viewMode, setViewMode, statusTab, setStatusTab` — agora vivem em ListaView

Manter no QuestoesPage:
- `useQuestoesContext` (pra `triggerSearch`)
- `QuestoesSearchBar` (usado em semantico + Ctrl+K)
- `QuestoesFilterBar` (tab filtros)
- `QuestoesFilterOverlay` (Ctrl+K) — VERIFICAR se ainda é usado; se sim, manter
- `FilterChipsBidirectional` (tab filtros)
- `ObjetivoSection` (tab filtros)
- `SemanticScopeToggle` (tab semantico)
- `useSearchParams` de react-router-dom

- [ ] **Step 6.6: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -20
```

Expected: build passa. Se houver "unused import" warnings de TypeScript strict, limpar.

- [ ] **Step 6.7: Smoke manual**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Em outra aba:
1. `http://localhost:3000/questoes` → tab Filtros ativa, ObjetivoSection + QuestoesFilterBar visíveis, **lista NÃO aparece embaixo**
2. Clicar em "Questões" → URL `?view=questoes`, mostra `QuestoesListaView` com chips de filtros + sort + view + lista virtualizada
3. Clicar "Editar filtros" → URL volta sem query, tab Filtros ativa
4. F5 em `?view=questoes` → recarrega na tab Questões (URL persiste)

Se algum desses 4 cenários falhar, parar e reportar.

- [ ] **Step 6.8: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/views/QuestoesPage.tsx
git -C "/d/meta novo/Metav2" commit -m "refactor(questoes): mover lista virtualizada + sort + view pra tab Questões"
```

---

## Task 7: "Buscar" da QuestoesFilterBar navega pra tab Questões

**Files:**
- Modify: `D:/meta novo/Metav2/src/views/QuestoesPage.tsx`

**Por que:** Hoje quando o aluno clica "Buscar" na QuestoesFilterBar, `triggerSearch()` commita o draft mas o usuário não vê resultado (lista agora tá em outra tab). Solução: handler navega `?view=questoes` AO MESMO TEMPO que dispara o `triggerSearch`.

- [ ] **Step 7.1: Atualizar `handleSearch`**

Localizar `handleSearch` (linha ~71):

```typescript
const handleSearch = useCallback(() => {
  triggerSearch();
}, [triggerSearch]);
```

Substituir por:

```typescript
const handleSearch = useCallback(() => {
  triggerSearch();
  setFilterView('questoes');
}, [triggerSearch, setFilterView]);
```

- [ ] **Step 7.2: Smoke manual E2E**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Cenário completo:
1. Abrir `http://localhost:3000/questoes` (tab Filtros default)
2. No QuestoesFilterBar legado, abrir popover "Banca", marcar "CEBRASPE (CESPE)"
3. Clicar "Buscar" — deve trocar pra tab Questões automaticamente, lista atualiza com banca filtrada
4. Clicar "Editar filtros" no topo da tab Questões — volta pra Filtros, banca CESPE ainda marcada
5. Abrir uma nova aba do navegador, ir em `http://localhost:3000/questoes?view=questoes&bancas=CEBRASPE%20(CESPE)` — link compartilhável carrega direto na tab Questões com filtro aplicado

Se algum desses falhar, debugar antes de commitar.

- [ ] **Step 7.3: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/views/QuestoesPage.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): Buscar na filter bar navega para tab Questões"
```

---

## Task 8: Suíte completa de smoke tests + auditoria final

- [ ] **Step 8.1: Build production**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -30
```

Expected: build sem erros nem warnings TypeScript críticos.

- [ ] **Step 8.2: Lint**

```bash
cd "/d/meta novo/Metav2" && npm run lint 2>&1 | tail -20
```

Expected: sem novos erros nos arquivos tocados.

- [ ] **Step 8.3: Smoke E2E manual completo**

Subir dev server e validar:

| # | Cenário | Esperado |
|---|---|---|
| 1 | `/questoes` (sem query) | Tab Filtros ativa, ObjetivoSection + QuestoesFilterBar, **sem lista** abaixo |
| 2 | Clicar tab Semântico | URL `?view=semantico`, search bar semântica, lista oculta |
| 3 | Clicar tab Cadernos | URL `?view=cadernos`, "Cadernos em breve", lista oculta |
| 4 | Clicar tab Questões | URL `?view=questoes`, mostra chips ("Nenhum filtro aplicado") + sort/view + lista |
| 5 | Voltar pra Filtros, marcar Banca CESPE, clicar Buscar | Vai pra tab Questões automaticamente, lista filtrada por CESPE |
| 6 | Tab Questões: clicar "Editar filtros" | Volta tab Filtros, CESPE ainda marcado |
| 7 | Browser back de Questões → Filtros (cenário 5→6 via back) | Funciona |
| 8 | URL direta `/questoes?view=questoes&bancas=FGV&anos=2024` | Carrega direto na tab Questões com FGV/2024 aplicados |
| 9 | F5 em `?view=questoes` | Mantém na tab Questões |
| 10 | Persist sort/view: trocar pra "Mais recentes" + view individual, F5 | Continua "Mais recentes" + individual |

Reportar qualquer cenário que falhar.

- [ ] **Step 8.4: Auditoria de regressão de funcionalidades existentes**

| Funcionalidade | Como testar | Esperado |
|---|---|---|
| Status tabs (Todas/Não resolvidas/Erradas/Marcadas) | Trocar entre tabs dentro de Questões | Lista filtra corretamente |
| QuestionCard interactions | Clicar em uma questão | Modal/navegação normal |
| QuestoesFilterBar slash inline (`/banca cespe`) | Trocar pra tab Semântico, digitar | Slash autocomplete funciona |
| Ctrl+K overlay | Pressionar Ctrl+K | Abre overlay com search + filter bar |
| OBJETIVO section | Tab Filtros → seleção de carreira | Cards renderizam, seleção funciona |

Se alguma regressão, parar e investigar.

- [ ] **Step 8.5: Commit final (se houver ajustes)**

Se Steps 8.3 ou 8.4 revelarem problemas que precisaram correção, commitar:

```bash
git -C "/d/meta novo/Metav2" add -A
git -C "/d/meta novo/Metav2" commit -m "fix(questoes): ajustes pós smoke E2E"
```

Se não houve problemas, pular este step.

---

## Task 9: Push e PR

- [ ] **Step 9.1: Verificar histórico do branch**

```bash
git -C "/d/meta novo/Metav2" log --oneline main..HEAD
```

Expected: ~7 commits (Tasks 1-7 + eventual fix da Task 8).

- [ ] **Step 9.2: Push**

```bash
git -C "/d/meta novo/Metav2" push -u origin feat/questoes-shell-tab-questoes
```

- [ ] **Step 9.3: Abrir PR**

Se `gh` CLI estiver disponível:

```bash
cd "/d/meta novo/Metav2" && gh pr create --title "feat(questoes): Plano 2 — shell + tab Questões com URL sync" --body "$(cat <<'EOF'
## Summary
- Tab strip URL-synced via `?view=filtros|semantico|cadernos|questoes`
- 4ª tab "Questões" (afastada à direita) com chips de filtros aplicados + sort + view + lista virtualizada
- Tab "Filtros" mantém `QuestoesFilterBar` legacy (Plano 3 substitui)
- Botão "Buscar" navega automaticamente pra tab Questões
- Sort/view persistem em localStorage entre sessões
- Foundation hooks (`useQuestoesCount`, `filter-serialization`) prontos pro Plano 3

## Spec
`docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md`

## Plano anterior (mergeado)
`feat/questoes-count-endpoint` na verus-api — endpoint `/questoes/count` rodando em prod

## Test plan
- [x] Smoke build production
- [x] Lint
- [x] 10 cenários E2E manuais (URL sync, back button, link compartilhável, persistência localStorage)
- [x] Auditoria de regressão (status tabs, slash autocomplete, Ctrl+K, OBJETIVO)
- [ ] Validação visual em produção/staging após merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Se `gh` não estiver disponível, push deve gerar a URL `https://github.com/<owner>/<repo>/pull/new/feat/questoes-shell-tab-questoes` — colar título e body manualmente.

---

## Definition of done

- ✅ Tab strip URL-synced funciona pros 4 modos
- ✅ Tab "Questões" mostra chips + sort + view + lista
- ✅ "Buscar" navega pra tab Questões
- ✅ "Editar filtros" volta pra tab Filtros sem perder estado
- ✅ Link `?view=questoes&bancas=...` reproduz estado completo
- ✅ Browser back/forward funciona entre tabs
- ✅ Sort/view persistem em localStorage
- ✅ Sem regressões de funcionalidades existentes
- ✅ Build verde e lint limpo
- ✅ PR aberto

## Decisões deliberadamente fora deste plano

- **Card novo de filtros** (chip strip + drawer 2 colunas) — Plano 3
- **Pickers individuais** (Banca, Ano, etc.) — Plano 3
- **Mobile bottom sheet do card** — Plano 3
- **`QuestoesFilterDraftContext` ("pendentes vs aplicados")** — Plano 3 (Plano 2 mantém o `committedFilters` atual do `QuestoesContext`)
- **Painel direito "FILTROS ATIVOS · N"** com accent amber, count, Aplicar/Editar qtd — Plano 3
- **Aposentar arquivos antigos** (`QuestoesFilterBar`, `FilterChipsBidirectional`, etc.) — Plano 3
- **Acessibilidade keyboard nav** completa do card novo — Plano 3
- **Animação fade 150ms** entre chips — Plano 3
- **Telemetria** (eventos de tab change, Aplicar) — separado, não bloqueante

## Riscos conhecidos

1. **`QuestoesContext` espera `useSearchParams` do react-router-dom em uma rota `/questoes/*`.** Tab strip usa o mesmo hook — confirmar que adicionar `?view=` ao search param não quebra a inicialização do contexto (que parsa filtros de search params). Mitigação: como `?view` não é uma chave de filtro reconhecida, o `searchParamsToFilters` interno do contexto vai ignorar (já testado por design).

2. **Persistência sort/view via localStorage pode brigar com o estado do contexto na 1ª montagem.** Mitigação: hidratação roda 1x via `useEffect` com `setSortBy`/`setViewMode` — se o contexto inicializar com defaults, esses defaults são imediatamente sobrescritos pelos valores salvos. Latência de 1 render — aceitável.

3. **Build com Next.js 15 + React 19**: o uso de `useSearchParams` de `react-router-dom` (não `next/navigation`) pode dar warning em SSR. O CLAUDE.md já documenta a arquitetura híbrida — checar `typeof window !== 'undefined'` se necessário em pontos críticos. `QuestoesPage` já é client-side via `BrowserRouter` no `App.tsx`.

4. **Smoke tests manuais ao invés de E2E automatizados**: o repo não tem Playwright/Cypress configurado pra rodar localmente sem custo de tempo. Tasks 8.3 e 8.4 são manuais — risco de regressão silenciosa em flows que não foram testados. Mitigação: a auditoria de Task 8.4 cobre os caminhos críticos.

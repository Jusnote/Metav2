# Plano 3b — Pickers do drawer de filtros (frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir os 4 pickers principais do drawer (Banca, Ano, Órgão+Cargo, Matéria+Assuntos) consumindo a Foundation do Plano 3a, o endpoint `/questoes/facets` do Plano 3b-pre, e adicionar 2 hooks de suporte (`useFiltroRecentes`, `useQuestoesFacets`). Pickers ficam em isolamento visual (página de preview dev) — wiring no card real é Plano 3c.

**Architecture:** Cada picker é componente presentacional puro consumindo: (a) lista de valores do `useFiltrosDicionario`, (b) counts contextuais do `useQuestoesFacets`, (c) recentes do `useFiltroRecentes(field)`, (d) seleção do contexto de filtros pendentes. Renderiza header padrão + search + Recentes + lista alfabética via Foundation. `MateriaAssuntosPicker` é especial: delega `TaxonomiaTreePicker` quando há taxonomia (via `total_nodes > 0`), fallback `FilterAlphabeticList` plano via `useFiltrosDicionario.materia_assuntos`.

**Tech Stack:** React 19 · TypeScript · Tailwind · React Query · React Router DOM (search params) · Vitest

**Repo:** `D:/meta novo/Metav2`

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md`

**Dependências (BLOQUEANTES — não começar sem):**
- ⚠️ **Plano 2 mergeado a main** (filter-serialization, useQuestoesCount, tab Questões) — hoje na branch `feat/questoes-shell-tab-questoes`, **ainda não em main**. Mergear antes de iniciar este plano. As Tasks 2 (useQuestoesFacets) e 7 (preview page) importam `filtersToSearchParams` e `AppliedFilters` de `src/lib/questoes/filter-serialization.ts` — sem isso o plano não compila.
- Plano 3a mergeado (Foundation: FilterCheckboxItem, FilterAlphabeticList, FilterRecentesBlock) — branch `feat/questoes-filter-shared-foundation`
- Plano 3b-pre mergeado e validado em prod (`/api/v1/questoes/facets`)

**Fora do escopo deste plano:**
- `EscolaridadePicker` e `AreaCarreiraPicker` — sem fonte de dados clara hoje (Escolaridade não mapeia diretamente em `QuestaoSearchFilters`; Carreira é conceito frontend que precisa traduzir pra banca/órgão/cargo). Adiar pra plano dedicado quando schema for confirmado.
- Card visual + drawer 2 colunas (Plano 3c)
- Mobile sheet (Plano 3d)

---

## Pré-flight

- [ ] **Step 0.1: Branch base e estado limpo**

```bash
cd "/d/meta novo/Metav2"
git status
git fetch origin
git checkout -b feat/questoes-filter-pickers feat/questoes-filter-shared-foundation
```

Expected: working tree limpo (com WIP de lei-seca v2 OK), branch criado a partir do `feat/questoes-filter-shared-foundation` (Foundation 3a).

> **Importante:** este plano depende de Plano 2 mergeado também. Se `feat/questoes-shell-tab-questoes` ainda não foi mergeado a main e a Foundation, fazer `git merge feat/questoes-shell-tab-questoes` antes de seguir.

- [ ] **Step 0.2: Confirmar dependências existem**

```bash
ls src/components/questoes/filtros/shared/  # FilterCheckboxItem, FilterAlphabeticList, FilterRecentesBlock
ls src/lib/questoes/                          # filter-serialization.ts
ls src/hooks/ | grep -E "useQuestoesCount|useFiltrosDicionario|useMaterias|useTaxonomia"
```

Expected: todos os arquivos presentes. Se não, parar e mergear deps primeiro.

- [ ] **Step 0.3: Baseline TypeScript verde**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 0.4: Verificar API real de dependências externas (CRÍTICO)**

Antes de codar, abrir os 2 arquivos abaixo e confirmar as assinaturas exatas. Os snippets de código nas Tasks 2, 6 e 7 assumem APIs específicas — se a real diferir, ajustar os imports/calls ANTES de seguir (pra não corromper testes/typecheck depois):

**a) `src/lib/questoes/filter-serialization.ts`** — usado em Task 2 e Task 7:

```bash
grep -n "export\|filtersToSearchParams\|AppliedFilters\|EMPTY_FILTERS" src/lib/questoes/filter-serialization.ts | head -20
```

Confirmar:
- Nome exato do export (`filtersToSearchParams` vs outro)
- Assinatura: aceita 2º arg `{plural?: boolean}` ou só 1 arg?
- Tipo `AppliedFilters` exporta os 10 campos esperados? (`bancas, anos, materias, assuntos, orgaos, cargos, areas_concurso, especialidades, tipos, formatos`)

**Se assinatura diferir do que está na Task 2 (`{plural: true}`)**: simplificar `useQuestoesFacets.buildKey` removendo o 2º arg, ou ajustar pra match. Documentar a diferença num comentário no PR.

**b) `src/components/questoes/TaxonomiaTreePicker.tsx`** — usado em Task 6:

```bash
grep -n "interface.*Props\|export function\|export const" src/components/questoes/TaxonomiaTreePicker.tsx | head -10
```

Confirmar a interface de props. Plano assume `{materia: string, selectedNodeIds, onChange}`. Se for diferente (ex.: `{materiaSlug, value, onChange}` ou usa contexto interno), ajustar o wrapper na Task 6 para mapear corretamente — ou abrir mini-PR no TreePicker pra alinhar interface antes de seguir.

Expected: ambos arquivos lidos, divergências (se houver) anotadas. Sem divergência → seguir; com divergência → ajustar Tasks 2 e/ou 6 antes do TDD.

---

## Task 1: Hook `useFiltroRecentes(field)`

**Files:**
- Create: `src/hooks/useFiltroRecentes.ts`
- Test: `src/hooks/__tests__/useFiltroRecentes.test.ts`

- [ ] **Step 1.1: Escrever teste primeiro (TDD)**

Criar `src/hooks/__tests__/useFiltroRecentes.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltroRecentes } from '../useFiltroRecentes';

describe('useFiltroRecentes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('inicia vazio quando não há histórico', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    expect(result.current.items).toEqual([]);
  });

  it('push adiciona item no topo', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    act(() => result.current.push({ value: 'Cespe', label: 'Cespe' }));
    expect(result.current.items[0]).toMatchObject({ value: 'Cespe', label: 'Cespe' });
  });

  it('dedup: mesmo valor sobe pro topo, não duplica', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    act(() => {
      result.current.push({ value: 'Cespe', label: 'Cespe' });
      result.current.push({ value: 'FCC', label: 'FCC' });
      result.current.push({ value: 'Cespe', label: 'Cespe' });
    });
    expect(result.current.items.map(i => i.value)).toEqual(['Cespe', 'FCC']);
  });

  it('limita a 5 itens (top mais recentes)', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.push({ value: `B${i}`, label: `Banca ${i}` });
      }
    });
    expect(result.current.items.length).toBe(5);
    expect(result.current.items[0].value).toBe('B9');
    expect(result.current.items[4].value).toBe('B5');
  });

  it('persiste em localStorage com chave por field', () => {
    const { result } = renderHook(() => useFiltroRecentes('ano'));
    act(() => result.current.push({ value: '2024', label: '2024' }));
    const stored = localStorage.getItem('filtros_recentes_ano');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)[0].value).toBe('2024');
  });

  it('isolamento entre fields: banca não vaza pra ano', () => {
    const { result: bancaHook } = renderHook(() => useFiltroRecentes('banca'));
    const { result: anoHook } = renderHook(() => useFiltroRecentes('ano'));
    act(() => bancaHook.current.push({ value: 'Cespe', label: 'Cespe' }));
    expect(anoHook.current.items).toEqual([]);
  });
});
```

- [ ] **Step 1.2: Rodar teste (deve falhar — hook não existe)**

```bash
npx vitest run src/hooks/__tests__/useFiltroRecentes.test.ts
```

Expected: 6/6 FAIL com "Cannot find module".

- [ ] **Step 1.3: Implementar hook**

Criar `src/hooks/useFiltroRecentes.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';

const MAX_ITEMS = 5;

export interface FiltroRecenteItem {
  value: string;
  label: string;
  ts?: number;
}

function storageKey(field: string): string {
  return `filtros_recentes_${field}`;
}

function safeRead(field: string): FiltroRecenteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(field));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeWrite(field: string, items: FiltroRecenteItem[]): void {
  try {
    localStorage.setItem(storageKey(field), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage cheio → drop metade
    try {
      localStorage.setItem(
        storageKey(field),
        JSON.stringify(items.slice(0, Math.floor(MAX_ITEMS / 2))),
      );
    } catch {
      /* desiste */
    }
  }
}

export function useFiltroRecentes(field: string) {
  const [items, setItems] = useState<FiltroRecenteItem[]>(() => safeRead(field));

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === storageKey(field)) setItems(safeRead(field));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [field]);

  const push = useCallback(
    (item: { value: string; label: string }) => {
      setItems((prev) => {
        const dedup = prev.filter((x) => x.value !== item.value);
        const next = [{ ...item, ts: Date.now() }, ...dedup].slice(0, MAX_ITEMS);
        safeWrite(field, next);
        return next;
      });
    },
    [field],
  );

  return { items, push };
}
```

- [ ] **Step 1.4: Rodar testes (devem passar)**

```bash
npx vitest run src/hooks/__tests__/useFiltroRecentes.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/hooks/useFiltroRecentes.ts src/hooks/__tests__/useFiltroRecentes.test.ts
git commit -m "feat(hook): useFiltroRecentes(field) — localStorage genérico por campo"
```

---

## Task 2: Hook `useQuestoesFacets`

**Files:**
- Create: `src/hooks/useQuestoesFacets.ts`
- Test: `src/hooks/__tests__/useQuestoesFacets.test.ts`

- [ ] **Step 2.1: Escrever teste primeiro**

Criar `src/hooks/__tests__/useQuestoesFacets.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuestoesFacets } from '../useQuestoesFacets';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
});

const fakeResponse = {
  facets: {
    banca: { Cespe: 100, FCC: 50 },
    ano: { '2024': 80, '2023': 70 },
    orgao: {},
    cargo: {},
    area_concurso: {},
    especialidade: {},
    tipo: {},
    formato: {},
  },
  took_ms: 12,
  cached: false,
};

describe('useQuestoesFacets', () => {
  it('retorna facets vazios e loading=false quando filtros vazios', () => {
    const { result } = renderHook(() => useQuestoesFacets({}));
    expect(result.current.loading).toBe(false);
    expect(result.current.facets).toEqual({});
  });

  it('faz fetch após debounce e popula facets', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeResponse,
    });
    const { result } = renderHook(() => useQuestoesFacets({ bancas: ['Cespe'] }));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 1000 });
    expect(result.current.facets.banca).toEqual({ Cespe: 100, FCC: 50 });
  });

  it('expõe error quando fetch falha', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useQuestoesFacets({ bancas: ['Cespe'] }));
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 1000 });
    expect(result.current.facets).toEqual({});
  });
});
```

- [ ] **Step 2.2: Rodar teste (deve falhar)**

```bash
npx vitest run src/hooks/__tests__/useQuestoesFacets.test.ts
```

Expected: FAIL com "Cannot find module".

- [ ] **Step 2.3: Implementar hook (espelha useQuestoesCount)**

Criar `src/hooks/useQuestoesFacets.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { filtersToSearchParams, type AppliedFilters } from '@/lib/questoes/filter-serialization';

const DEBOUNCE_MS = 300;
const LOCAL_CACHE_MAX = 30;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type FacetField =
  | 'banca'
  | 'ano'
  | 'orgao'
  | 'cargo'
  | 'area_concurso'
  | 'especialidade'
  | 'tipo'
  | 'formato';

export type FacetsByField = Partial<Record<FacetField, Record<string, number>>>;

export interface FacetsState {
  facets: FacetsByField;
  loading: boolean;
  error: string | null;
  cached: boolean;
  tookMs: number | null;
}

class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number) {}
  get(k: K): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: K, v: V): void {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
  }
}

const cache = new LRU<string, FacetsByField>(LOCAL_CACHE_MAX);

function buildKey(filters: Partial<AppliedFilters>): string {
  return filtersToSearchParams(filters as AppliedFilters, { plural: true }).toString();
}

function isEmpty(filters: Partial<AppliedFilters>): boolean {
  return Object.values(filters).every(
    (v) => v === undefined || v === null || (Array.isArray(v) && v.length === 0),
  );
}

export function useQuestoesFacets(filters: Partial<AppliedFilters>): FacetsState {
  const [state, setState] = useState<FacetsState>({
    facets: {},
    loading: false,
    error: null,
    cached: false,
    tookMs: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isEmpty(filters)) {
      setState({ facets: {}, loading: false, error: null, cached: false, tookMs: null });
      return;
    }

    const key = buildKey(filters);
    const hit = cache.get(key);
    if (hit) {
      setState({ facets: hit, loading: false, error: null, cached: true, tookMs: 0 });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const params = filtersToSearchParams(filters as AppliedFilters, { plural: true });
        const res = await fetch(`${API_BASE}/api/v1/questoes/facets?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cache.set(key, data.facets);
        setState({
          facets: data.facets,
          loading: false,
          error: null,
          cached: data.cached ?? false,
          tookMs: data.took_ms ?? null,
        });
      } catch (e: unknown) {
        if ((e as Error)?.name === 'AbortError') return;
        setState({
          facets: {},
          loading: false,
          error: (e as Error)?.message || 'Erro ao buscar facets',
          cached: false,
          tookMs: null,
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return state;
}
```

- [ ] **Step 2.4: Rodar testes (devem passar)**

```bash
npx vitest run src/hooks/__tests__/useQuestoesFacets.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/hooks/useQuestoesFacets.ts src/hooks/__tests__/useQuestoesFacets.test.ts
git commit -m "feat(hook): useQuestoesFacets — debounce 300ms + LRU + AbortController"
```

---

## Task 3: `BancaPicker`

**Files:**
- Create: `src/components/questoes/filtros/pickers/BancaPicker.tsx`
- Test: `src/components/questoes/filtros/pickers/__tests__/BancaPicker.test.tsx`

- [ ] **Step 3.1: Escrever teste primeiro**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BancaPicker } from '../BancaPicker';

const dicionario = {
  bancas: { cespe: 'Cespe', fcc: 'FCC', fgv: 'FGV', cesgranrio: 'Cesgranrio' },
  orgaos: {}, cargos: {},
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};
const facets = { Cespe: 1234, FCC: 567, FGV: 89 };

describe('BancaPicker', () => {
  it('renderiza header e search', () => {
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Bancas/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('renderiza lista alfabética com counts', () => {
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Cespe')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('chama onChange ao marcar item', () => {
    const onChange = vi.fn();
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Cespe'));
    expect(onChange).toHaveBeenCalledWith(['Cespe']);
  });

  it('search filtra a lista', () => {
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/buscar/i);
    fireEvent.change(input, { target: { value: 'cesp' } });
    expect(screen.queryByText('FCC')).not.toBeInTheDocument();
    expect(screen.getByText('Cespe')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2: Rodar teste (deve falhar)**

```bash
npx vitest run src/components/questoes/filtros/pickers/__tests__/BancaPicker.test.tsx
```

Expected: FAIL.

- [ ] **Step 3.3: Implementar BancaPicker**

```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterRecentesBlock } from '@/components/questoes/filtros/shared';
import { useFiltroRecentes } from '@/hooks/useFiltroRecentes';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface BancaPickerProps {
  dicionario: FiltrosDicionario | null;
  facets?: Record<string, number>;
  selected: string[];
  onChange: (next: string[]) => void;
}

export function BancaPicker({ dicionario, facets, selected, onChange }: BancaPickerProps) {
  const [q, setQ] = useState('');
  const { items: recentes, push } = useFiltroRecentes('banca');

  const allItems = useMemo(() => {
    if (!dicionario) return [];
    const unique = [...new Set(Object.values(dicionario.bancas))].sort();
    return unique.map((v) => ({ id: v, label: v }));
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (!q.trim()) return allItems;
    const norm = q.trim().toLowerCase();
    return allItems.filter((i) => i.label.toLowerCase().includes(norm));
  }, [allItems, q]);

  const toggle = (value: string) => {
    const isSel = selected.includes(value);
    const next = isSel ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
    if (!isSel) push({ value, label: value });
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Bancas</h2>
        <p className="text-xs text-slate-500">
          {allItems.length} bancas · marque para filtrar
        </p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar banca…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      {!q && recentes.length > 0 && (
        <FilterRecentesBlock
          items={recentes}
          renderItem={(r) => (
            <button
              key={r.value}
              onClick={() => toggle(r.value)}
              className="text-left text-sm text-blue-700 hover:underline"
              type="button"
            >
              {r.label}
            </button>
          )}
        />
      )}

      <FilterAlphabeticList
        items={filtered}
        renderItem={(item) => (
          <FilterCheckboxItemWithCount
            label={item.label}
            checked={selected.includes(item.id)}
            onToggle={() => toggle(item.id)}
            count={facets?.[item.id]}
          />
        )}
      />
    </div>
  );
}

function FilterCheckboxItemWithCount({
  label,
  checked,
  onToggle,
  count,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded text-left"
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-400"
      />
      <span className="flex-1 text-sm text-slate-800">{label}</span>
      {typeof count === 'number' && (
        <span className="text-xs text-slate-400 tabular-nums">{count.toLocaleString('pt-BR')}</span>
      )}
    </button>
  );
}
```

> **Nota:** o `FilterCheckboxItemWithCount` local é um wrapper temporário. Se outro picker repetir o padrão (e vai), extrair para `shared/FilterCheckboxItemWithCount.tsx` na próxima task.

- [ ] **Step 3.4: Rodar testes (devem passar)**

```bash
npx vitest run src/components/questoes/filtros/pickers/__tests__/BancaPicker.test.tsx
```

Expected: 4/4 PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/questoes/filtros/pickers/BancaPicker.tsx src/components/questoes/filtros/pickers/__tests__/BancaPicker.test.tsx
git commit -m "feat(picker): BancaPicker — alfabética + recentes + facets counts"
```

---

## Task 4: `AnoPicker`

**Files:**
- Create: `src/components/questoes/filtros/pickers/AnoPicker.tsx`
- Test: `src/components/questoes/filtros/pickers/__tests__/AnoPicker.test.tsx`

Comportamento específico: agrupa por **década** (não letra) — `getGroupKey={(ano) => Math.floor(ano/10)*10`}, header `2020s`, `2010s`. Ordem decrescente. Itens são `number` mas ID/label string.

- [ ] **Step 4.1: Extrair `FilterCheckboxItemWithCount` para shared**

Criar `src/components/questoes/filtros/shared/FilterCheckboxItemWithCount.tsx` movendo o wrapper criado em Task 3 + atualizar `BancaPicker` para importar do shared. Atualizar `shared/index.ts` para exportar.

```typescript
import { FilterCheckboxItem } from './FilterCheckboxItem';

export interface FilterCheckboxItemWithCountProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
  disabled?: boolean;
}

export function FilterCheckboxItemWithCount(props: FilterCheckboxItemWithCountProps) {
  // Reusa FilterCheckboxItem da Foundation, adiciona count à direita
  return (
    <div className="flex items-center w-full">
      <div className="flex-1">
        <FilterCheckboxItem
          label={props.label}
          checked={props.checked}
          onToggle={props.onToggle}
          disabled={props.disabled}
        />
      </div>
      {typeof props.count === 'number' && (
        <span className="text-xs text-slate-400 tabular-nums pr-2">
          {props.count.toLocaleString('pt-BR')}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: Escrever teste do AnoPicker**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnoPicker } from '../AnoPicker';

const dicionario = {
  bancas: {}, orgaos: {}, cargos: {},
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('AnoPicker', () => {
  it('renderiza anos descendentes', () => {
    render(<AnoPicker dicionario={dicionario} facets={{}} selected={[]} onChange={vi.fn()} />);
    const items = screen.getAllByRole('button').filter(b => /^\d{4}$/.test(b.textContent || ''));
    expect(items.map(i => i.textContent)).toEqual(
      Array.from({ length: 15 }, (_, i) => String(2024 - i))
    );
  });

  it('agrupa por década', () => {
    render(<AnoPicker dicionario={dicionario} facets={{}} selected={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/2020s/i)).toBeInTheDocument();
    expect(screen.getByText(/2010s/i)).toBeInTheDocument();
  });

  it('toggle envia number array', () => {
    const onChange = vi.fn();
    render(<AnoPicker dicionario={dicionario} facets={{}} selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('2024'));
    expect(onChange).toHaveBeenCalledWith([2024]);
  });
});
```

- [ ] **Step 4.3: Implementar AnoPicker**

```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import { FilterRecentesBlock } from '@/components/questoes/filtros/shared';
import { useFiltroRecentes } from '@/hooks/useFiltroRecentes';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface AnoPickerProps {
  dicionario: FiltrosDicionario | null;
  facets?: Record<string, number>;
  selected: number[];
  onChange: (next: number[]) => void;
}

export function AnoPicker({ dicionario, facets, selected, onChange }: AnoPickerProps) {
  const [q, setQ] = useState('');
  const { items: recentes, push } = useFiltroRecentes('ano');

  const allItems = useMemo(() => {
    if (!dicionario) return [];
    const { min, max } = dicionario.anos;
    const years: { id: string; label: string; ano: number }[] = [];
    for (let y = max; y >= min; y--) {
      years.push({ id: String(y), label: String(y), ano: y });
    }
    return years;
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (!q.trim()) return allItems;
    return allItems.filter((i) => i.label.includes(q.trim()));
  }, [allItems, q]);

  const toggle = (ano: number) => {
    const isSel = selected.includes(ano);
    const next = isSel ? selected.filter((v) => v !== ano) : [...selected, ano];
    onChange(next);
    if (!isSel) push({ value: String(ano), label: String(ano) });
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Anos</h2>
        <p className="text-xs text-slate-500">
          {allItems.length} anos · agrupados por década
        </p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar ano…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      {!q && recentes.length > 0 && (
        <FilterRecentesBlock
          items={recentes}
          renderItem={(r) => (
            <button
              key={r.value}
              onClick={() => toggle(Number(r.value))}
              className="text-left text-sm text-blue-700 hover:underline"
              type="button"
            >
              {r.label}
            </button>
          )}
        />
      )}

      <FilterAlphabeticList
        items={filtered}
        getGroupKey={(item) => `${Math.floor(item.ano / 10) * 10}s`}
        renderItem={(item) => (
          <FilterCheckboxItemWithCount
            label={item.label}
            checked={selected.includes(item.ano)}
            onToggle={() => toggle(item.ano)}
            count={facets?.[item.id]}
          />
        )}
      />
    </div>
  );
}
```

> **Atenção:** `FilterAlphabeticList` precisa aceitar `getGroupKey` (já documentado na Foundation 3a — verificar se está exposto). Se não, abrir mini-PR na Foundation antes de seguir.

- [ ] **Step 4.4: Refatorar BancaPicker pra usar `FilterCheckboxItemWithCount` shared**

Substituir o wrapper local `FilterCheckboxItemWithCount` em `BancaPicker.tsx` pelo import do shared. Rodar testes do BancaPicker — devem continuar passando.

- [ ] **Step 4.5: Rodar testes**

```bash
npx vitest run src/components/questoes/filtros/pickers/__tests__/
```

Expected: BancaPicker (4) + AnoPicker (3) PASS.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/questoes/filtros/shared/FilterCheckboxItemWithCount.tsx \
        src/components/questoes/filtros/shared/index.ts \
        src/components/questoes/filtros/pickers/AnoPicker.tsx \
        src/components/questoes/filtros/pickers/__tests__/AnoPicker.test.tsx \
        src/components/questoes/filtros/pickers/BancaPicker.tsx
git commit -m "feat(picker): AnoPicker (década) + extrai FilterCheckboxItemWithCount"
```

---

## Task 5: `OrgaoCargoPicker`

**Files:**
- Create: `src/components/questoes/filtros/pickers/OrgaoCargoPicker.tsx`
- Test: `src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx`

Picker composto: 2 campos (`orgaos`, `cargos`) num único componente, com toggle no header (segmented control "Órgãos | Cargos") ou stack vertical. Decisão de UX: **stack vertical** (sem toggle) — usuário vê os dois ao mesmo tempo, com headers internos. Decisão fácil de reverter se mockup pedir toggle.

- [ ] **Step 5.1: Teste**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgaoCargoPicker } from '../OrgaoCargoPicker';

const dicionario = {
  bancas: {},
  orgaos: { trf1: 'TRF1', stj: 'STJ', tj: 'TJ' },
  cargos: { juiz: 'Juiz', analista: 'Analista' },
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('OrgaoCargoPicker', () => {
  it('mostra 2 seções com counts próprios', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        facetsOrgao={{ TRF1: 100 }}
        facetsCargo={{ Juiz: 50 }}
        selectedOrgaos={[]} selectedCargos={[]}
        onChangeOrgaos={vi.fn()} onChangeCargos={vi.fn()}
      />,
    );
    expect(screen.getByText(/Órgãos/i)).toBeInTheDocument();
    expect(screen.getByText(/Cargos/i)).toBeInTheDocument();
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.getByText('Juiz')).toBeInTheDocument();
  });

  it('toggle órgão chama callback de órgãos', () => {
    const onO = vi.fn();
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        selectedOrgaos={[]} selectedCargos={[]}
        onChangeOrgaos={onO} onChangeCargos={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    expect(onO).toHaveBeenCalledWith(['TRF1']);
  });
});
```

- [ ] **Step 5.2: Implementar OrgaoCargoPicker**

Estrutura:
```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterRecentesBlock } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import { useFiltroRecentes } from '@/hooks/useFiltroRecentes';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface OrgaoCargoPickerProps {
  dicionario: FiltrosDicionario | null;
  facetsOrgao?: Record<string, number>;
  facetsCargo?: Record<string, number>;
  selectedOrgaos: string[];
  selectedCargos: string[];
  onChangeOrgaos: (next: string[]) => void;
  onChangeCargos: (next: string[]) => void;
}

export function OrgaoCargoPicker(props: OrgaoCargoPickerProps) {
  const [q, setQ] = useState('');
  const recOrgao = useFiltroRecentes('orgao');
  const recCargo = useFiltroRecentes('cargo');

  const orgaos = useMemo(() => {
    if (!props.dicionario) return [];
    const u = [...new Set(Object.values(props.dicionario.orgaos))].sort();
    return u.map((v) => ({ id: v, label: v }));
  }, [props.dicionario]);

  const cargos = useMemo(() => {
    if (!props.dicionario) return [];
    const u = [...new Set(Object.values(props.dicionario.cargos))].sort();
    return u.map((v) => ({ id: v, label: v }));
  }, [props.dicionario]);

  const filterFn = (list: { id: string; label: string }[]) =>
    !q.trim() ? list : list.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  const toggleOrgao = (v: string) => {
    const isSel = props.selectedOrgaos.includes(v);
    const next = isSel ? props.selectedOrgaos.filter((x) => x !== v) : [...props.selectedOrgaos, v];
    props.onChangeOrgaos(next);
    if (!isSel) recOrgao.push({ value: v, label: v });
  };
  const toggleCargo = (v: string) => {
    const isSel = props.selectedCargos.includes(v);
    const next = isSel ? props.selectedCargos.filter((x) => x !== v) : [...props.selectedCargos, v];
    props.onChangeCargos(next);
    if (!isSel) recCargo.push({ value: v, label: v });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Órgãos e cargos</h2>
        <p className="text-xs text-slate-500">
          {orgaos.length} órgãos · {cargos.length} cargos
        </p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar órgão ou cargo…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Órgãos
        </h3>
        <FilterAlphabeticList
          items={filterFn(orgaos)}
          renderItem={(i) => (
            <FilterCheckboxItemWithCount
              label={i.label}
              checked={props.selectedOrgaos.includes(i.id)}
              onToggle={() => toggleOrgao(i.id)}
              count={props.facetsOrgao?.[i.id]}
            />
          )}
        />
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Cargos
        </h3>
        <FilterAlphabeticList
          items={filterFn(cargos)}
          renderItem={(i) => (
            <FilterCheckboxItemWithCount
              label={i.label}
              checked={props.selectedCargos.includes(i.id)}
              onToggle={() => toggleCargo(i.id)}
              count={props.facetsCargo?.[i.id]}
            />
          )}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 5.3: Rodar testes**

```bash
npx vitest run src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx
```

Expected: 2/2 PASS.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/questoes/filtros/pickers/OrgaoCargoPicker.tsx \
        src/components/questoes/filtros/pickers/__tests__/OrgaoCargoPicker.test.tsx
git commit -m "feat(picker): OrgaoCargoPicker — 2 seções stack vertical"
```

---

## Task 6: `MateriaAssuntosPicker` (TreePicker wrapper + flat fallback)

**Files:**
- Create: `src/components/questoes/filtros/pickers/MateriaAssuntosPicker.tsx`
- Test: `src/components/questoes/filtros/pickers/__tests__/MateriaAssuntosPicker.test.tsx`

Estrutura: 2 modos baseados em `materia` selecionada e `total_nodes` da matéria:
1. **Sem matéria selecionada** → lista de matérias (alfabética, com counts via `total_questoes_classificadas`)
2. **Matéria com `total_nodes > 0`** → wrapper coeso renderizando `<TaxonomiaTreePicker materia={slug} />` com header consistente
3. **Matéria com `total_nodes === 0`** → fallback flat usando `useFiltrosDicionario.materia_assuntos[materia]` via `FilterAlphabeticList`

> **Decisão de UX a fazer durante implementação — navegação vs filtro:**
>
> Hoje o picker mistura dois conceitos no mesmo prop `materia`: estado de **navegação** (qual matéria está expandida no picker) e estado de **filtro** (qual matéria entra na query). Se o pai (Plano 3c) wirea `materia` direto no draft de filtros, clicar numa matéria pra "ver os assuntos" automaticamente filtra por ela.
>
> Duas opções:
> - **(a) Aceitar acoplamento (mais simples):** clicar matéria = abrir + filtrar. Usuário que quer só explorar tem que desmarcar depois. UX direto, menos estado.
> - **(b) Separar estados (mais limpo):** picker tem estado interno `expandedMateria` (não é prop), e `materias` filtro só muda quando usuário marca explicitamente um checkbox de matéria na lista. Mais código, mais flexível.
>
> **Recomendação:** começar com (a) na implementação atual (matches o spec mockup que mostra 1 matéria selecionada) e revisar no Plano 3c se a UX ficar confusa. Não bloqueia este plano, mas anotar no PR pra discutir antes do 3c.

- [ ] **Step 6.1: Teste**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MateriaAssuntosPicker } from '../MateriaAssuntosPicker';

vi.mock('@/hooks/useMaterias', () => ({
  useMaterias: () => ({
    data: [
      { slug: 'direito-adm', nome: 'Direito Administrativo', total_nodes: 499, total_questoes_classificadas: 12345, fontes: ['gran'], last_updated: null },
      { slug: 'direito-civil', nome: 'Direito Civil', total_nodes: 0, total_questoes_classificadas: 5000, fontes: [], last_updated: null },
    ],
    isLoading: false,
  }),
}));
vi.mock('@/components/questoes/TaxonomiaTreePicker', () => ({
  TaxonomiaTreePicker: ({ materia }: { materia: string }) => <div data-testid="tree">tree:{materia}</div>,
}));

const dicionario = {
  bancas: {}, orgaos: {}, cargos: {},
  materias: [],
  assuntos: [],
  materia_assuntos: { 'Direito Civil': ['Pessoas', 'Obrigações', 'Contratos'] },
  anos: { min: 2010, max: 2024 },
};

describe('MateriaAssuntosPicker', () => {
  it('sem matéria → lista de matérias', () => {
    render(
      <MateriaAssuntosPicker
        dicionario={dicionario}
        materia={null} selectedAssuntos={[]} selectedNodeIds={[]}
        onMateriaChange={vi.fn()} onAssuntosChange={vi.fn()} onNodeIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Direito Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Direito Civil')).toBeInTheDocument();
  });

  it('matéria com taxonomia → renderiza TreePicker', () => {
    render(
      <MateriaAssuntosPicker
        dicionario={dicionario}
        materia="Direito Administrativo" selectedAssuntos={[]} selectedNodeIds={[]}
        onMateriaChange={vi.fn()} onAssuntosChange={vi.fn()} onNodeIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('tree')).toHaveTextContent('tree:direito-adm');
  });

  it('matéria sem taxonomia → fallback flat de assuntos', () => {
    render(
      <MateriaAssuntosPicker
        dicionario={dicionario}
        materia="Direito Civil" selectedAssuntos={[]} selectedNodeIds={[]}
        onMateriaChange={vi.fn()} onAssuntosChange={vi.fn()} onNodeIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Pessoas')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.queryByTestId('tree')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Implementar MateriaAssuntosPicker**

```typescript
'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import { TaxonomiaTreePicker } from '@/components/questoes/TaxonomiaTreePicker';
import { useMaterias } from '@/hooks/useMaterias';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface MateriaAssuntosPickerProps {
  dicionario: FiltrosDicionario | null;
  materia: string | null;
  selectedAssuntos: string[];
  selectedNodeIds: (number | string)[];
  onMateriaChange: (materia: string | null) => void;
  onAssuntosChange: (next: string[]) => void;
  onNodeIdsChange: (next: (number | string)[]) => void;
}

export function MateriaAssuntosPicker(props: MateriaAssuntosPickerProps) {
  const { data: materias, isLoading } = useMaterias();
  const [q, setQ] = useState('');

  const materiaInfo = useMemo(
    () => materias?.find((m) => m.nome === props.materia),
    [materias, props.materia],
  );

  // Modo 1: sem matéria → lista de matérias
  if (!props.materia) {
    const items = (materias || []).map((m) => ({
      id: m.nome,
      label: m.nome,
      count: m.total_questoes_classificadas,
    }));
    const filtered = !q.trim()
      ? items
      : items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

    return (
      <div className="flex flex-col gap-3 p-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">Matérias e assuntos</h2>
          <p className="text-xs text-slate-500">
            {items.length} matérias · clique para abrir
          </p>
        </header>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar matéria…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        {isLoading ? (
          <div className="text-sm text-slate-400 px-2 py-4">Carregando matérias…</div>
        ) : (
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => (
              <button
                type="button"
                onClick={() => props.onMateriaChange(item.id)}
                className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded text-left"
              >
                <span className="text-sm text-blue-700">{item.label}</span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {item.count?.toLocaleString('pt-BR') ?? ''}
                </span>
              </button>
            )}
          />
        )}
      </div>
    );
  }

  // Modo 2: matéria com taxonomia → wrapper TreePicker
  if (materiaInfo && materiaInfo.total_nodes > 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <header className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => props.onMateriaChange(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              ← Voltar para matérias
            </button>
            <h2 className="text-lg font-semibold text-slate-900 mt-1">{materiaInfo.nome}</h2>
            <p className="text-xs text-slate-500">
              {materiaInfo.total_nodes} tópicos · taxonomia GRAN
            </p>
          </div>
        </header>
        <TaxonomiaTreePicker
          materia={materiaInfo.slug}
          selectedNodeIds={props.selectedNodeIds}
          onChange={props.onNodeIdsChange}
        />
      </div>
    );
  }

  // Modo 3: matéria sem taxonomia → fallback flat
  const assuntos = props.dicionario?.materia_assuntos[props.materia] || [];
  const items = assuntos.map((a) => ({ id: a, label: a }));
  const filtered = !q.trim()
    ? items
    : items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (assunto: string) => {
    const isSel = props.selectedAssuntos.includes(assunto);
    const next = isSel
      ? props.selectedAssuntos.filter((v) => v !== assunto)
      : [...props.selectedAssuntos, assunto];
    props.onAssuntosChange(next);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <header>
        <button
          type="button"
          onClick={() => props.onMateriaChange(null)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Voltar para matérias
        </button>
        <h2 className="text-lg font-semibold text-slate-900 mt-1">{props.materia}</h2>
        <p className="text-xs text-slate-500">{items.length} assuntos · lista plana</p>
      </header>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar assunto…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
      <FilterAlphabeticList
        items={filtered}
        renderItem={(item) => (
          <FilterCheckboxItemWithCount
            label={item.label}
            checked={props.selectedAssuntos.includes(item.id)}
            onToggle={() => toggle(item.id)}
          />
        )}
      />
    </div>
  );
}
```

> **Nota:** assume que `TaxonomiaTreePicker` aceita props `{materia, selectedNodeIds, onChange}`. Se a API atual diferir, ajustar o wrapper aqui (ou abrir mini-PR no TreePicker pra alinhar interface). Verificar `src/components/questoes/TaxonomiaTreePicker.tsx` antes de implementar.

- [ ] **Step 6.3: Rodar testes**

```bash
npx vitest run src/components/questoes/filtros/pickers/__tests__/MateriaAssuntosPicker.test.tsx
```

Expected: 3/3 PASS.

- [ ] **Step 6.4: Commit**

```bash
git add src/components/questoes/filtros/pickers/MateriaAssuntosPicker.tsx \
        src/components/questoes/filtros/pickers/__tests__/MateriaAssuntosPicker.test.tsx
git commit -m "feat(picker): MateriaAssuntosPicker — TreePicker wrapper + flat fallback"
```

---

## Task 7: Página de preview dev `/dev/filter-pickers`

**Files:**
- Create: `src/app/dev/filter-pickers/page.tsx`

Página dev-only para validação visual antes de Plano 3c. Renderiza os 4 pickers lado a lado com state local + fetch real do dicionário e facets.

- [ ] **Step 7.1: Implementar página**

```typescript
'use client';
import { useState } from 'react';
import { BancaPicker } from '@/components/questoes/filtros/pickers/BancaPicker';
import { AnoPicker } from '@/components/questoes/filtros/pickers/AnoPicker';
import { OrgaoCargoPicker } from '@/components/questoes/filtros/pickers/OrgaoCargoPicker';
import { MateriaAssuntosPicker } from '@/components/questoes/filtros/pickers/MateriaAssuntosPicker';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';

type Tab = 'banca' | 'ano' | 'orgao_cargo' | 'materia';

export default function FilterPickersPreview() {
  const [tab, setTab] = useState<Tab>('banca');
  const [bancas, setBancas] = useState<string[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [orgaos, setOrgaos] = useState<string[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [materia, setMateria] = useState<string | null>(null);
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [nodeIds, setNodeIds] = useState<(number | string)[]>([]);

  const { data: dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets({ bancas, anos, orgaos, cargos });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Filter Pickers — Dev Preview</h1>
      <p className="text-sm text-slate-500 mb-6">
        Validação visual dos 4 pickers do drawer (Plano 3b). Não acessível em produção.
      </p>

      <nav className="flex gap-2 mb-4">
        {(['banca', 'ano', 'orgao_cargo', 'materia'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-slate-200">
          {tab === 'banca' && (
            <BancaPicker dicionario={dicionario ?? null} facets={facets.banca} selected={bancas} onChange={setBancas} />
          )}
          {tab === 'ano' && (
            <AnoPicker dicionario={dicionario ?? null} facets={facets.ano} selected={anos} onChange={setAnos} />
          )}
          {tab === 'orgao_cargo' && (
            <OrgaoCargoPicker
              dicionario={dicionario ?? null}
              facetsOrgao={facets.orgao} facetsCargo={facets.cargo}
              selectedOrgaos={orgaos} selectedCargos={cargos}
              onChangeOrgaos={setOrgaos} onChangeCargos={setCargos}
            />
          )}
          {tab === 'materia' && (
            <MateriaAssuntosPicker
              dicionario={dicionario ?? null}
              materia={materia} selectedAssuntos={assuntos} selectedNodeIds={nodeIds}
              onMateriaChange={setMateria} onAssuntosChange={setAssuntos} onNodeIdsChange={setNodeIds}
            />
          )}
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Estado atual</h2>
          <pre className="text-xs text-slate-700 overflow-auto">
            {JSON.stringify(
              { bancas, anos, orgaos, cargos, materia, assuntos, nodeIds },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2: Validação visual em localhost**

```bash
npm run dev
# Abrir http://localhost:3000/dev/filter-pickers
```

Expected: cada picker renderiza, marca/desmarca funciona, counts aparecem nos pickers Banca/Ano/Órgão/Cargo, MateriaAssuntosPicker navega entre lista → tree (Direito Adm) e lista → flat (Direito Civil).

> **Critérios visuais:** spec mockup. Tipografia, espaçamento, cores devem refletir Foundation 3a. Anotar divergências no PR pra discutir antes de Plano 3c.

- [ ] **Step 7.3: Commit**

```bash
git add src/app/dev/filter-pickers/page.tsx
git commit -m "chore(dev): preview /dev/filter-pickers para validação visual dos pickers"
```

---

## Task 8: TS check final + push + PR

- [ ] **Step 8.1: TypeScript verde**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Se erros, corrigir antes de seguir.

- [ ] **Step 8.2: Suite de testes completa dos novos arquivos**

```bash
npx vitest run \
  src/hooks/__tests__/useFiltroRecentes.test.ts \
  src/hooks/__tests__/useQuestoesFacets.test.ts \
  src/components/questoes/filtros/pickers/__tests__/
```

Expected: todos PASS.

- [ ] **Step 8.3: Push**

```bash
git push -u origin feat/questoes-filter-pickers
```

- [ ] **Step 8.4: Criar PR**

Título: `feat(questoes): pickers do drawer (Banca, Ano, Órgão+Cargo, Matéria) + hooks`

Body:
```markdown
## Summary
- 2 hooks novos: `useFiltroRecentes(field)` (localStorage por campo, top 5) e `useQuestoesFacets` (debounce 300ms + LRU + AbortController, consome `/api/v1/questoes/facets`)
- 4 pickers presentacionais consumindo Foundation 3a + facets + recentes
- `MateriaAssuntosPicker` delega `TaxonomiaTreePicker` quando matéria tem taxonomia, fallback flat via dicionário
- Página dev `/dev/filter-pickers` para validação visual isolada
- Wiring no card real é Plano 3c

## Out of scope
- EscolaridadePicker e AreaCarreiraPicker (sem fonte de dados clara — adiar pra plano dedicado)
- Card visual + drawer (Plano 3c)

## Test plan
- [ ] `useFiltroRecentes` (6 testes — dedup, limit 5, isolamento entre fields)
- [ ] `useQuestoesFacets` (3 testes — empty, fetch, error)
- [ ] BancaPicker (4 testes — render, counts, toggle, search)
- [ ] AnoPicker (3 testes — descendente, década, toggle number)
- [ ] OrgaoCargoPicker (2 testes — 2 seções, toggle)
- [ ] MateriaAssuntosPicker (3 testes — lista, tree, flat fallback)
- [ ] Validação visual em `/dev/filter-pickers` (localhost)
```

---

## Critérios de aceite

- [ ] Os 2 hooks têm testes verdes (vitest)
- [ ] Os 4 pickers têm testes verdes
- [ ] `tsc --noEmit` 0 errors
- [ ] Validação visual em `/dev/filter-pickers` cobrindo: marcação/desmarcação, counts, recentes (após push), search, MateriaAssuntosPicker nos 3 modos
- [ ] Counts contextuais funcionam (marcar Cespe → Ano mostra só anos com Cespe)

## Dependências bloqueantes

- Plano 2 mergeado (filter-serialization, useQuestoesCount)
- Plano 3a mergeado (Foundation)
- Plano 3b-pre mergeado e validado em prod (`/api/v1/questoes/facets`)

## Próximo plano

- Plano 3c: card de filtros + drawer 2 colunas + chip strip + ActiveFiltersPanel, atrás de feature flag `NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD`. Substitui `QuestoesFilterBar` legacy.

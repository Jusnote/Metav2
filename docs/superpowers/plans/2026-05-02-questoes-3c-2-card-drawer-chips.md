# Plano 3c-2 — Card + Drawer + Chip Strip + Picker Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o shell visual do card novo — chip strip de 4 chips, drawer 2 colunas, wrapper que mapeia chip ativa → sub-picker — e fazer wiring dos 4 pickers existentes (Banca, Ano, Órgão+Cargo, Matéria+Assuntos) consumindo o `QuestoesFilterDraftContext` do 3c-1.

**Architecture:** `QuestoesFilterCard` é o container. Dentro: `QuestoesFilterChipStrip` (chips clicáveis) + `QuestoesFilterDrawer` (layout 60/40). Drawer hospeda `QuestoesFilterPicker` (wrapper dispatch por chip ativa) na coluna esquerda; coluna direita fica vazia neste plano (vem em 3c-3). Cada picker recebe slice relevante de `pendentes` e propaga mudanças via `setPendentes`. Animação de troca de chip via Framer Motion `AnimatePresence mode="wait"` com fade 150ms.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Framer Motion (já dependência do app), Vitest + happy-dom + @testing-library/react.

**Spec base:** [`docs/superpowers/specs/2026-05-01-questoes-card-drawer-3c-design.md`](../specs/2026-05-01-questoes-card-drawer-3c-design.md) — seções (1) Chip strip, (2) Drawer, (10) Performance.

**Pré-requisito:** Plano 3c-1 mergeado em main (provê `useFiltrosPendentes` + `QuestoesFilterDraftProvider`).

---

## File Structure

```
src/components/questoes/filtros/
  QuestoesFilterCard.tsx                          CRIAR — container
  QuestoesFilterChipStrip.tsx                     CRIAR — 4 chips
  QuestoesFilterDrawer.tsx                        CRIAR — layout 60/40
  QuestoesFilterPicker.tsx                        CRIAR — wrapper dispatch
  __tests__/
    QuestoesFilterChipStrip.test.tsx              CRIAR
    QuestoesFilterDrawer.test.tsx                 CRIAR
    QuestoesFilterPicker.test.tsx                 CRIAR
    QuestoesFilterCard.test.tsx                   CRIAR
  shared/
    PickerSkeleton.tsx                            CRIAR — placeholder loading state
src/hooks/
  useQuestoesFacets.ts                            MODIFICAR — adicionar enabled prop
  __tests__/useQuestoesFacets.test.ts             CRIAR (se não existir)
src/app/dev/filter-pickers/
  page.tsx                                        MODIFICAR — renderizar Card completo
```

**Tipos canônicos compartilhados:**

```ts
export type ChipKey = 'materia_assuntos' | 'banca' | 'orgao_cargo' | 'ano';

export interface ChipDef {
  key: ChipKey;
  label: string;
  icon: '📚' | '🏛' | '🏢' | '📅';
}
```

(Ícones como string Unicode pra manter alinhamento com a foto referência. Se mudar pra Lucide/SVG depois, é troca local na ChipStrip.)

---

## Pré-requisitos

- Branch: `feat/questoes-3c-2-card-drawer-chips` a partir de main (após 3c-1 mergeado)
- Verificar Framer Motion instalado: `grep '"framer-motion"' package.json` deve retornar versão
- Verificar import de `useFiltrosPendentes` funciona: `npx tsc --noEmit` sem erros

---

## Task 1: Adicionar prop `enabled` em `useQuestoesFacets`

**Files:**
- Modify: `src/hooks/useQuestoesFacets.ts`
- Test: `src/hooks/__tests__/useQuestoesFacets.test.ts` (criar se não existir)

**Decisão:** mudar a API de `useQuestoesFacets(filters)` para `useQuestoesFacets(filters, options?)` onde `options.enabled` default `true` (backward-compat). Quando `enabled: false`, retorna estado neutro e não dispara fetch.

- [ ] **Step 1.1: Criar arquivo de teste**

Cria `src/hooks/__tests__/useQuestoesFacets.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuestoesFacets } from '../useQuestoesFacets';

describe('useQuestoesFacets — enabled prop', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enabled: false → não dispara fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderHook(() => useQuestoesFacets({}, { enabled: false }));
    // Esperar tempo suficiente pra debounce não disparar
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('enabled: false → retorna facets vazios e loading false', () => {
    const { result } = renderHook(() =>
      useQuestoesFacets({}, { enabled: false }),
    );
    expect(result.current.facets).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('default (sem options) → enabled implícito = true (backward compat)', () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ facets: {}, cached: false, took_ms: 0 })),
      );
    renderHook(() => useQuestoesFacets({}));
    // fetch é debounced — só verificamos que NÃO desliga (sem assert imediato)
    return waitFor(() => expect(fetchSpy).toHaveBeenCalled(), {
      timeout: 1000,
    });
  });
});
```

- [ ] **Step 1.2: Rodar teste, ver falha**

Run: `npx vitest run src/hooks/__tests__/useQuestoesFacets.test.ts`
Expected: FAIL — assinatura `useQuestoesFacets({}, {...})` rejeitada pelo TS.

- [ ] **Step 1.3: Adicionar prop opcional**

Em `src/hooks/useQuestoesFacets.ts`, modificar a assinatura:

```typescript
export interface UseQuestoesFacetsOptions {
  /** Quando false, não dispara fetch e retorna facets vazios. Default true. */
  enabled?: boolean;
}

export function useQuestoesFacets(
  filters: Partial<AppliedFilters>,
  options: UseQuestoesFacetsOptions = {},
): FacetsState {
  const { enabled = true } = options;

  const [state, setState] = useState<FacetsState>({
    facets: {},
    loading: false,
    error: null,
    cached: false,
    tookMs: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Limpa estado se acabou de desabilitar
      setState({
        facets: {},
        loading: false,
        error: null,
        cached: false,
        tookMs: null,
      });
      abortRef.current?.abort();
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
        const params = filtersToSearchParams(mergeWithEmpty(filters));
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
  }, [JSON.stringify(filters), enabled]);

  return state;
}
```

- [ ] **Step 1.4: Rodar testes — PASS**

Run: `npx vitest run src/hooks/__tests__/useQuestoesFacets.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 1.5: Verificar que callers existentes ainda compilam**

Run: `npx tsc --noEmit`
Expected: zero erros (chamadas antigas `useQuestoesFacets(filters)` continuam válidas porque options é opcional).

- [ ] **Step 1.6: Commit**

```bash
git add src/hooks/useQuestoesFacets.ts src/hooks/__tests__/useQuestoesFacets.test.ts
git commit -m "feat(questoes): adicionar prop enabled em useQuestoesFacets (default true, backward-compat)"
```

---

## Task 2: Componente `PickerSkeleton`

**Files:**
- Create: `src/components/questoes/filtros/shared/PickerSkeleton.tsx`
- Test: `src/components/questoes/filtros/__tests__/PickerSkeleton.test.tsx`

Componente compartilhado pra exibir placeholder enquanto o picker está em loading (`facets` ainda undefined). Usa pulse animation do Tailwind.

- [ ] **Step 2.1: Criar teste**

Cria `src/components/questoes/filtros/__tests__/PickerSkeleton.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PickerSkeleton } from '../shared/PickerSkeleton';

describe('PickerSkeleton', () => {
  it('renderiza N linhas placeholders por padrão', () => {
    const { container } = render(<PickerSkeleton />);
    const rows = container.querySelectorAll('[data-testid="skeleton-row"]');
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('aceita prop rows pra controlar quantidade', () => {
    const { container } = render(<PickerSkeleton rows={3} />);
    const rows = container.querySelectorAll('[data-testid="skeleton-row"]');
    expect(rows.length).toBe(3);
  });

  it('cada linha tem classes de animação pulse', () => {
    const { container } = render(<PickerSkeleton rows={1} />);
    const row = container.querySelector('[data-testid="skeleton-row"]');
    expect(row?.className).toMatch(/animate-pulse/);
  });
});
```

- [ ] **Step 2.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/PickerSkeleton.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2.3: Criar componente**

Cria `src/components/questoes/filtros/shared/PickerSkeleton.tsx`:

```tsx
'use client';
import React from 'react';

export interface PickerSkeletonProps {
  /** Número de linhas placeholder. Default 8. */
  rows?: number;
}

export function PickerSkeleton({ rows = 8 }: PickerSkeletonProps) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          data-testid="skeleton-row"
          className="h-6 rounded bg-slate-200 animate-pulse"
          style={{ width: `${60 + ((i * 7) % 35)}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/PickerSkeleton.test.tsx`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/questoes/filtros/shared/PickerSkeleton.tsx src/components/questoes/filtros/__tests__/PickerSkeleton.test.tsx
git commit -m "feat(questoes): PickerSkeleton — placeholder pulse pra loading state dos pickers"
```

---

## Task 3: `QuestoesFilterChipStrip` — render estático de 4 chips

**Files:**
- Create: `src/components/questoes/filtros/QuestoesFilterChipStrip.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesFilterChipStrip.test.tsx`

- [ ] **Step 3.1: Criar testes pra render**

Cria `src/components/questoes/filtros/__tests__/QuestoesFilterChipStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  QuestoesFilterChipStrip,
  type ChipKey,
} from '../QuestoesFilterChipStrip';

describe('QuestoesFilterChipStrip — render', () => {
  it('renderiza 4 chips na ordem canônica', () => {
    render(
      <QuestoesFilterChipStrip activeChip="materia_assuntos" onChange={() => {}} />,
    );
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(4);
    expect(chips[0]).toHaveTextContent(/Matéria/i);
    expect(chips[1]).toHaveTextContent(/Banca/i);
    expect(chips[2]).toHaveTextContent(/Órgão/i);
    expect(chips[3]).toHaveTextContent(/Ano/i);
  });

  it('chip ativa tem aria-pressed=true; outras false', () => {
    render(
      <QuestoesFilterChipStrip activeChip="banca" onChange={() => {}} />,
    );
    const chips = screen.getAllByRole('button');
    expect(chips[0]).toHaveAttribute('aria-pressed', 'false'); // materia
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true');  // banca
    expect(chips[2]).toHaveAttribute('aria-pressed', 'false'); // orgao
    expect(chips[3]).toHaveAttribute('aria-pressed', 'false'); // ano
  });

  it('click em chip dispara onChange com a key correta', () => {
    const onChange = vi.fn();
    render(<QuestoesFilterChipStrip activeChip="materia_assuntos" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Banca/i }));
    expect(onChange).toHaveBeenCalledWith('banca');
  });
});
```

- [ ] **Step 3.2: Rodar — FAIL (módulo inexistente)**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterChipStrip.test.tsx`
Expected: FAIL.

- [ ] **Step 3.3: Criar componente**

Cria `src/components/questoes/filtros/QuestoesFilterChipStrip.tsx`:

```tsx
'use client';
import React from 'react';

export type ChipKey = 'materia_assuntos' | 'banca' | 'orgao_cargo' | 'ano';

export interface ChipDef {
  key: ChipKey;
  label: string;
  icon: string;
}

export const CHIPS: ChipDef[] = [
  { key: 'materia_assuntos', label: 'Matéria · Assuntos', icon: '📚' },
  { key: 'banca', label: 'Banca', icon: '🏛' },
  { key: 'orgao_cargo', label: 'Órgão · Cargo', icon: '🏢' },
  { key: 'ano', label: 'Ano', icon: '📅' },
];

export interface QuestoesFilterChipStripProps {
  activeChip: ChipKey;
  onChange: (next: ChipKey) => void;
}

export function QuestoesFilterChipStrip({
  activeChip,
  onChange,
}: QuestoesFilterChipStripProps) {
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {CHIPS.map((chip) => {
        const isActive = chip.key === activeChip;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm transition-colors',
              'border-b-2',
              isActive
                ? 'border-[#1f2937] text-[#1f2937] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <span aria-hidden>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterChipStrip.test.tsx`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterChipStrip.tsx src/components/questoes/filtros/__tests__/QuestoesFilterChipStrip.test.tsx
git commit -m "feat(questoes): QuestoesFilterChipStrip com 4 chips, underline 2px na ativa"
```

---

## Task 4: `QuestoesFilterDrawer` — layout 60/40

**Files:**
- Create: `src/components/questoes/filtros/QuestoesFilterDrawer.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesFilterDrawer.test.tsx`

- [ ] **Step 4.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/QuestoesFilterDrawer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestoesFilterDrawer } from '../QuestoesFilterDrawer';

describe('QuestoesFilterDrawer', () => {
  it('renderiza children left e right', () => {
    render(
      <QuestoesFilterDrawer
        left={<div data-testid="picker">picker</div>}
        right={<div data-testid="painel">painel</div>}
      />,
    );
    expect(screen.getByTestId('picker')).toBeInTheDocument();
    expect(screen.getByTestId('painel')).toBeInTheDocument();
  });

  it('coluna esquerda tem grid-area definida (ratio 60/40 via grid)', () => {
    const { container } = render(
      <QuestoesFilterDrawer left={<div>L</div>} right={<div>R</div>} />,
    );
    const grid = container.querySelector('[data-testid="drawer-grid"]');
    expect(grid).toBeInTheDocument();
    // Confirmar que tem grid-template-columns refletindo 60/40
    const computed = (grid as HTMLElement).style.gridTemplateColumns;
    // Ratio "3fr 2fr" = 60/40
    expect(computed).toBe('3fr 2fr');
  });
});
```

- [ ] **Step 4.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterDrawer.test.tsx`
Expected: FAIL.

- [ ] **Step 4.3: Criar componente**

Cria `src/components/questoes/filtros/QuestoesFilterDrawer.tsx`:

```tsx
'use client';
import React from 'react';

export interface QuestoesFilterDrawerProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function QuestoesFilterDrawer({
  left,
  right,
}: QuestoesFilterDrawerProps) {
  return (
    <div
      data-testid="drawer-grid"
      className="grid gap-4 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      style={{ gridTemplateColumns: '3fr 2fr' }}
    >
      <div className="border-r border-slate-200">{left}</div>
      <div>{right}</div>
    </div>
  );
}
```

- [ ] **Step 4.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterDrawer.tsx src/components/questoes/filtros/__tests__/QuestoesFilterDrawer.test.tsx
git commit -m "feat(questoes): QuestoesFilterDrawer com layout grid 60/40 (3fr 2fr)"
```

---

## Task 5: `QuestoesFilterPicker` — wrapper dispatch (sem pickers reais ainda)

**Files:**
- Create: `src/components/questoes/filtros/QuestoesFilterPicker.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`

> Wrapper recebe `activeChip` e renderiza o picker correspondente. Nesta task usa **stubs** — wiring real dos pickers vem em Tasks 7-10.

- [ ] **Step 5.1: Criar testes com placeholders**

Cria `src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestoesFilterPicker } from '../QuestoesFilterPicker';
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';

function withProviders(node: React.ReactNode, route = '/questoes') {
  return (
    <MemoryRouter initialEntries={[route]}>
      <QuestoesFilterDraftProvider>{node}</QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}

describe('QuestoesFilterPicker — dispatch por chip', () => {
  it('activeChip="materia_assuntos" → renderiza MateriaAssuntos', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="materia_assuntos" />));
    expect(screen.getByTestId('picker-materia-assuntos')).toBeInTheDocument();
  });

  it('activeChip="banca" → renderiza Banca', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="banca" />));
    expect(screen.getByTestId('picker-banca')).toBeInTheDocument();
  });

  it('activeChip="orgao_cargo" → renderiza OrgaoCargo', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="orgao_cargo" />));
    expect(screen.getByTestId('picker-orgao-cargo')).toBeInTheDocument();
  });

  it('activeChip="ano" → renderiza Ano', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="ano" />));
    expect(screen.getByTestId('picker-ano')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`
Expected: FAIL.

- [ ] **Step 5.3: Criar wrapper com stubs**

Cria `src/components/questoes/filtros/QuestoesFilterPicker.tsx`:

```tsx
'use client';
import React from 'react';
import type { ChipKey } from './QuestoesFilterChipStrip';

export interface QuestoesFilterPickerProps {
  activeChip: ChipKey;
}

// Stubs — substituídos pelos pickers reais em tasks 7-10.
function StubMateriaAssuntos() {
  return <div data-testid="picker-materia-assuntos" className="p-4">Matéria · Assuntos (stub)</div>;
}
function StubBanca() {
  return <div data-testid="picker-banca" className="p-4">Banca (stub)</div>;
}
function StubOrgaoCargo() {
  return <div data-testid="picker-orgao-cargo" className="p-4">Órgão · Cargo (stub)</div>;
}
function StubAno() {
  return <div data-testid="picker-ano" className="p-4">Ano (stub)</div>;
}

export function QuestoesFilterPicker({ activeChip }: QuestoesFilterPickerProps) {
  switch (activeChip) {
    case 'materia_assuntos':
      return <StubMateriaAssuntos />;
    case 'banca':
      return <StubBanca />;
    case 'orgao_cargo':
      return <StubOrgaoCargo />;
    case 'ano':
      return <StubAno />;
  }
}
```

- [ ] **Step 5.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterPicker.tsx src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx
git commit -m "feat(questoes): QuestoesFilterPicker dispatch por chip (stubs — wiring real em tasks 7-10)"
```

---

## Task 6: Animação Framer Motion — fade 150ms entre pickers

**Files:**
- Modify: `src/components/questoes/filtros/QuestoesFilterPicker.tsx`
- Modify: `src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`

- [ ] **Step 6.1: Adicionar teste de transição (smoke — só verifica que motion wrappa)**

Adicionar ao `QuestoesFilterPicker.test.tsx`:

```tsx
describe('animação fade entre chips', () => {
  it('renderiza sob AnimatePresence (motion.div presente)', () => {
    const { container } = render(
      withProviders(<QuestoesFilterPicker activeChip="banca" />),
    );
    // Framer Motion gera divs com style inline pra opacity
    // Aqui só verificamos que o picker está dentro de algum elemento
    // que pode receber animação. Smoke test, sem snapshot de visual.
    const wrapper = container.querySelector('[data-testid="picker-fade-wrapper"]');
    expect(wrapper).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`
Expected: FAIL — wrapper data-testid não existe.

- [ ] **Step 6.3: Adicionar AnimatePresence + motion.div**

Substituir o body de `QuestoesFilterPicker`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';

// ... stubs ficam iguais ...

export function QuestoesFilterPicker({ activeChip }: QuestoesFilterPickerProps) {
  let content: React.ReactNode;
  switch (activeChip) {
    case 'materia_assuntos':
      content = <StubMateriaAssuntos />;
      break;
    case 'banca':
      content = <StubBanca />;
      break;
    case 'orgao_cargo':
      content = <StubOrgaoCargo />;
      break;
    case 'ano':
      content = <StubAno />;
      break;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeChip}
        data-testid="picker-fade-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 6.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterPicker.tsx src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx
git commit -m "feat(questoes): fade 150ms entre pickers via AnimatePresence mode='wait'"
```

---

## Task 7: Wiring `BancaPicker` (substitui StubBanca)

**Files:**
- Modify: `src/components/questoes/filtros/QuestoesFilterPicker.tsx`
- Modify: `src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`

> `BancaPicker` existente (já mergeado) recebe `bancas: string[]`, `onToggle: (banca: string) => void`, e facets opcional. Wiring lê de `pendentes.bancas` e escreve via `setPendentes`.

- [ ] **Step 7.1: Olhar a interface do BancaPicker existente**

Run: `head -50 src/components/questoes/filtros/pickers/BancaPicker.tsx`

Anotar:
- Quais props ele aceita
- Como ele recebe seleções
- Como ele dispara mudanças

(Implementação assume interface canônica — se diferir, ajustar o adaptador no Step 7.3.)

- [ ] **Step 7.2: Teste de wiring — verifica que click em banca atualiza pendentes**

Adicionar ao `QuestoesFilterPicker.test.tsx`:

```tsx
import { act } from '@testing-library/react';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';

function ProbedPicker({ activeChip }: { activeChip: ChipKey }) {
  const draft = useFiltrosPendentes();
  return (
    <>
      <QuestoesFilterPicker activeChip={activeChip} />
      <div data-testid="probe-bancas">{draft.pendentes.bancas.join(',')}</div>
    </>
  );
}

describe('Banca wiring', () => {
  it('seleção via picker reflete em pendentes.bancas', async () => {
    render(withProviders(<ProbedPicker activeChip="banca" />));

    // Esperar dicionário/facets carregarem (mock fetch ou waitFor)
    // Como fetch é mockável, vamos simular checkbox direto:
    const checkbox = await screen.findByRole('checkbox', { name: /CESPE/i });
    fireEvent.click(checkbox);

    expect(screen.getByTestId('probe-bancas')).toHaveTextContent('CESPE');
  });
});
```

> **Nota:** este teste depende de `useFiltrosDicionario` retornar dados. Se for inviável sem mock, simplificar pra teste mais focado na lógica do adaptador (Step 7.3) sem render completo.

- [ ] **Step 7.3: Substituir StubBanca por wiring real**

Em `QuestoesFilterPicker.tsx`, importar e adicionar adaptador:

```tsx
import { BancaPicker } from './pickers/BancaPicker';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';

function BancaPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets(pendentes);

  const handleToggle = (banca: string) => {
    const has = pendentes.bancas.includes(banca);
    setPendentes({
      ...pendentes,
      bancas: has
        ? pendentes.bancas.filter((b) => b !== banca)
        : [...pendentes.bancas, banca],
    });
  };

  return (
    <div data-testid="picker-banca">
      <BancaPicker
        dicionario={dicionario ?? null}
        bancasSelecionadas={pendentes.bancas}
        facetsBanca={facets.banca ?? {}}
        onToggle={handleToggle}
      />
    </div>
  );
}
```

E no switch principal, trocar `<StubBanca />` por `<BancaPickerAdapter />`.

> **Atenção:** se a interface real de `BancaPicker` diferir, ajustar nomes de props no JSX (mas não a lógica do adaptador).

- [ ] **Step 7.4: Rodar testes**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`
Expected: PASS — caso o teste 7.2 demande mock de fetch, ajustar (ver nota no Step 7.2).

- [ ] **Step 7.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterPicker.tsx src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx
git commit -m "feat(questoes): wiring de BancaPicker no FilterPicker — lê/escreve pendentes.bancas"
```

---

## Task 8: Wiring `AnoPicker` (substitui StubAno)

**Files:**
- Modify: `src/components/questoes/filtros/QuestoesFilterPicker.tsx`

Mesmo pattern do BancaPicker, mas com `pendentes.anos: number[]`.

- [ ] **Step 8.1: Adicionar adaptador**

Em `QuestoesFilterPicker.tsx`, antes do switch:

```tsx
import { AnoPicker } from './pickers/AnoPicker';

function AnoPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets(pendentes);

  const handleToggle = (ano: number) => {
    const has = pendentes.anos.includes(ano);
    setPendentes({
      ...pendentes,
      anos: has ? pendentes.anos.filter((a) => a !== ano) : [...pendentes.anos, ano],
    });
  };

  return (
    <div data-testid="picker-ano">
      <AnoPicker
        dicionario={dicionario ?? null}
        anosSelecionados={pendentes.anos}
        facetsAno={facets.ano ?? {}}
        onToggle={handleToggle}
      />
    </div>
  );
}
```

E no switch, `<StubAno />` → `<AnoPickerAdapter />`.

- [ ] **Step 8.2: Rodar suite**

Run: `npx vitest run src/components/questoes/filtros/__tests__/`
Expected: PASS.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterPicker.tsx
git commit -m "feat(questoes): wiring de AnoPicker — lê/escreve pendentes.anos"
```

---

## Task 9: Wiring `MateriaAssuntosPicker` (substitui StubMateriaAssuntos)

**Files:**
- Modify: `src/components/questoes/filtros/QuestoesFilterPicker.tsx`

> `MateriaAssuntosPicker` é mais complexo: pode usar TaxonomiaTreePicker (com nodeIds) ou lista flat de assuntos. Wiring precisa lidar com `pendentes.materias`, `pendentes.assuntos` e potencialmente nodeIds.

- [ ] **Step 9.1: Olhar interface real**

Run: `head -80 src/components/questoes/filtros/pickers/MateriaAssuntosPicker.tsx`

Anotar:
- Props que recebe
- Como expressa seleção (única matéria? múltiplas? nodeIds?)

> Se a interface for muito divergente, **escrever uma interface adapter explícita** com tipos canônicos antes de fazer o wiring. Não inventar campos.

- [ ] **Step 9.2: Adicionar adaptador**

Pattern (assumindo interface canônica — ajustar nomes pelo que viu no Step 9.1):

```tsx
import { MateriaAssuntosPicker } from './pickers/MateriaAssuntosPicker';

function MateriaAssuntosPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets(pendentes);

  return (
    <div data-testid="picker-materia-assuntos">
      <MateriaAssuntosPicker
        dicionario={dicionario ?? null}
        materiasSelecionadas={pendentes.materias}
        assuntosSelecionados={pendentes.assuntos}
        // facets pra contagens
        facets={facets}
        onMateriasChange={(materias) =>
          setPendentes({ ...pendentes, materias })
        }
        onAssuntosChange={(assuntos) =>
          setPendentes({ ...pendentes, assuntos })
        }
      />
    </div>
  );
}
```

E `<StubMateriaAssuntos />` → `<MateriaAssuntosPickerAdapter />`.

- [ ] **Step 9.3: Rodar suite**

Run: `npx vitest run src/components/questoes/filtros/__tests__/`
Expected: PASS.

- [ ] **Step 9.4: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterPicker.tsx
git commit -m "feat(questoes): wiring de MateriaAssuntosPicker — lê/escreve materias e assuntos"
```

---

## Task 10: Wiring `OrgaoCargoPicker` (substitui StubOrgaoCargo)

**Files:**
- Modify: `src/components/questoes/filtros/QuestoesFilterPicker.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesFilterPicker.test.tsx`

> **Note (post-review):** O adapter precisa hidratar o `state` local a partir de `pendentes` no mount via `backendToState`, senão o `useEffect` de mount sobrescreve seleções pré-existentes de órgão/cargo (B1). O `useEffect([orgaoCargoBackend])` pula a primeira execução via `useRef`. Mutações externas a `pendentes.orgaos/cargos/org_cargo_pairs` após o mount não são reativas — re-keying causa write-loop; deferido pra follow-up.

> Picker mais complexo. Já existe `useOrgaoCargoState` (interno) e `stateToBackendFilters`. Adapter mantém estado local do picker E sincroniza com `pendentes.orgaos / cargos / org_cargo_pairs`.

> **Estratégia:** picker mantém seu state local (Map<orgao, sel>); adapter ESCREVE pra pendentes via `stateToBackendFilters` toda vez que state local muda. **Não tenta sincronizar de volta** — quando usuário edita pendentes externamente (× no painel direito), o adapter re-monta do zero (key forçada quando `pendentes.org_cargo_pairs` muda externamente).

- [ ] **Step 10.1: Construir adapter**

Em `QuestoesFilterPicker.tsx`:

```tsx
import { OrgaoCargoPicker } from './pickers/OrgaoCargoPicker';
import { useOrgaoCargoState } from '@/hooks/useOrgaoCargoState';
import { stateToBackendFilters } from '@/lib/questoes/orgao-cargo-serialization';
import { useEffect, useState } from 'react';

function OrgaoCargoPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { state, actions } = useOrgaoCargoState();
  const [drilldownOrgao, setDrilldownOrgao] = useState<string | null>(null);

  // Override: durante drilldown, força o orgao pra que facets de cargo
  // venham filtrados àquele órgão
  const orgaoCargoBackend = stateToBackendFilters(state);
  const filtersForFacets = {
    ...pendentes,
    orgaos: drilldownOrgao ? [drilldownOrgao] : orgaoCargoBackend.orgaos,
    cargos: orgaoCargoBackend.cargos,
    org_cargo_pairs: orgaoCargoBackend.org_cargo_pairs,
  };

  const { facets } = useQuestoesFacets(filtersForFacets);

  // Sincroniza state local → pendentes (apenas saída)
  useEffect(() => {
    const backend = stateToBackendFilters(state);
    setPendentes({
      ...pendentes,
      orgaos: backend.orgaos,
      cargos: backend.cargos,
      org_cargo_pairs: backend.org_cargo_pairs,
    });
    // pendentes intencionalmente fora das deps — set baseado em state interno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div data-testid="picker-orgao-cargo">
      <OrgaoCargoPicker
        dicionario={dicionario ?? null}
        state={state}
        actions={actions}
        facetsCargo={facets.cargo ?? {}}
        drilldownOrgaoTotalCount={
          drilldownOrgao ? facets.orgao?.[drilldownOrgao] : undefined
        }
        onDrilldownChange={setDrilldownOrgao}
      />
    </div>
  );
}
```

- [ ] **Step 10.2: Trocar stub por adapter**

No switch, `<StubOrgaoCargo />` → `<OrgaoCargoPickerAdapter />`.

- [ ] **Step 10.3: Rodar suite**

Run: `npx vitest run src/components/questoes/filtros/__tests__/`
Expected: PASS.

- [ ] **Step 10.4: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterPicker.tsx
git commit -m "feat(questoes): wiring de OrgaoCargoPicker com drilldown e contextual facets"
```

---

## Task 11: `QuestoesFilterCard` — container top-level

**Files:**
- Create: `src/components/questoes/filtros/QuestoesFilterCard.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`

> Composer: ChipStrip no topo, Drawer abaixo com Picker à esquerda e placeholder à direita (painel direito vem em 3c-3).

- [ ] **Step 11.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';
import { QuestoesFilterCard } from '../QuestoesFilterCard';

function withProviders(node: React.ReactNode) {
  return (
    <MemoryRouter initialEntries={['/questoes?view=filtros']}>
      <QuestoesFilterDraftProvider>{node}</QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}

describe('QuestoesFilterCard', () => {
  it('renderiza chip strip + drawer + picker default (matéria)', () => {
    render(withProviders(<QuestoesFilterCard />));
    expect(screen.getByRole('button', { name: /Matéria/i })).toBeInTheDocument();
    expect(screen.getByTestId('drawer-grid')).toBeInTheDocument();
    expect(screen.getByTestId('picker-materia-assuntos')).toBeInTheDocument();
  });

  it('click em chip Banca troca picker', () => {
    render(withProviders(<QuestoesFilterCard />));
    fireEvent.click(screen.getByRole('button', { name: /Banca/i }));
    expect(screen.getByTestId('picker-banca')).toBeInTheDocument();
  });

  it('renderiza placeholder na coluna direita (painel vem em 3c-3)', () => {
    render(withProviders(<QuestoesFilterCard />));
    expect(screen.getByTestId('painel-direito-placeholder')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`
Expected: FAIL.

- [ ] **Step 11.3: Criar QuestoesFilterCard**

Cria `src/components/questoes/filtros/QuestoesFilterCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { QuestoesFilterChipStrip, type ChipKey } from './QuestoesFilterChipStrip';
import { QuestoesFilterDrawer } from './QuestoesFilterDrawer';
import { QuestoesFilterPicker } from './QuestoesFilterPicker';

export function QuestoesFilterCard() {
  const [activeChip, setActiveChip] = useState<ChipKey>('materia_assuntos');

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <QuestoesFilterChipStrip activeChip={activeChip} onChange={setActiveChip} />
      <QuestoesFilterDrawer
        left={<QuestoesFilterPicker activeChip={activeChip} />}
        right={
          <div
            data-testid="painel-direito-placeholder"
            className="p-4 text-sm text-slate-400"
          >
            Painel direito (3c-3)
          </div>
        }
      />
    </div>
  );
}
```

- [ ] **Step 11.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`
Expected: PASS.

- [ ] **Step 11.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterCard.tsx src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx
git commit -m "feat(questoes): QuestoesFilterCard compõe ChipStrip + Drawer + Picker (painel direito stub)"
```

---

## Task 12: Atualizar `/dev/filter-pickers` pra renderizar o card completo

**Files:**
- Modify: `src/app/dev/filter-pickers/page.tsx`

> Substituir o conteúdo atual (que renderiza pickers individuais) pela renderização do `QuestoesFilterCard`. Mantém o painel "Estado atual" pra debug.

- [ ] **Step 12.1: Reescrever o page.tsx**

Substituir o conteúdo de `src/app/dev/filter-pickers/page.tsx`:

```tsx
'use client';
import '../../../index.css';
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';
import { QuestoesFilterCard } from '@/components/questoes/filtros/QuestoesFilterCard';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';

function DebugPanel() {
  const { pendentes, aplicados, isDirty } = useFiltrosPendentes();
  return (
    <div className="mt-6 bg-white rounded-lg shadow border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        Debug — Estado do contexto
      </h2>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-semibold text-slate-700 mb-1">pendentes</div>
          <pre className="overflow-auto text-slate-600">
            {JSON.stringify(pendentes, null, 2)}
          </pre>
        </div>
        <div>
          <div className="font-semibold text-slate-700 mb-1">
            aplicados {isDirty && <span className="text-amber-600">(dirty!)</span>}
          </div>
          <pre className="overflow-auto text-slate-600">
            {JSON.stringify(aplicados, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function FilterPickersPreview() {
  return (
    <MemoryRouter initialEntries={['/dev/filter-pickers?view=filtros']}>
      <QuestoesFilterDraftProvider>
        <div className="min-h-screen bg-slate-50 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            QuestoesFilterCard — Dev Preview
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Validação visual do card completo (3c-2). Painel direito vem no 3c-3.
          </p>

          <QuestoesFilterCard />
          <DebugPanel />
        </div>
      </QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}
```

- [ ] **Step 12.2: Smoke test no dev server**

Em terminal separado:

```bash
npm run dev
```

Abrir: `http://localhost:3000/dev/filter-pickers`

**Conferir manualmente:**
- Card renderiza com 4 chips (Matéria · Banca · Órgão · Ano)
- Chip ativa tem underline preto
- Click em chip troca picker com fade 150ms
- Banca: lista de bancas + checkboxes + counts
- Ano: lista de anos
- Órgão · Cargo: lista de órgãos → drilldown ao clicar
- Matéria · Assuntos: lista de matérias
- Painel direito mostra "Painel direito (3c-3)" placeholder
- DebugPanel embaixo reflete pendentes ao selecionar opções
- isDirty fica `(dirty!)` em vermelho ao mudar pendentes

- [ ] **Step 12.3: Commit**

```bash
git add src/app/dev/filter-pickers/page.tsx
git commit -m "feat(questoes): /dev/filter-pickers renderiza QuestoesFilterCard completo + DebugPanel"
```

---

## Task 13: Suite final + push + PR

- [ ] **Step 13.1: Rodar suite completa**

Run: `npx vitest run`
Expected: 0 failures.

- [ ] **Step 13.2: TypeCheck**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 13.3: Build**

Run: `npm run build:dev`
Expected: build succeeds.

- [ ] **Step 13.4: Push**

```bash
git push -u origin feat/questoes-3c-2-card-drawer-chips
```

- [ ] **Step 13.5: Abrir PR**

```bash
gh pr create --title "feat(questoes): 3c-2 — Card + Drawer + ChipStrip + Picker wiring" --body "$(cat <<'EOF'
## Summary
- `QuestoesFilterChipStrip` — 4 chips com underline na ativa
- `QuestoesFilterDrawer` — layout 60/40
- `QuestoesFilterPicker` — wrapper dispatch com fade 150ms (Framer Motion)
- Wiring dos 4 pickers existentes (Banca, Ano, Órgão+Cargo, Matéria+Assuntos)
- `useQuestoesFacets` ganha prop `enabled`
- `PickerSkeleton` shared component
- `/dev/filter-pickers` mostra card completo

## Plan
docs/superpowers/plans/2026-05-02-questoes-3c-2-card-drawer-chips.md

## Test plan
- [ ] `npx vitest run` passa
- [ ] `npx tsc --noEmit` sem erros
- [ ] `/dev/filter-pickers` renderiza card completo, troca de chip funciona com fade
- [ ] DebugPanel reflete pendentes ao interagir
- [ ] Drilldown do OrgãoCargo funciona

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Definition of Done — 3c-2

- ✅ `useQuestoesFacets` aceita prop `enabled` (default true)
- ✅ `PickerSkeleton` disponível pra reuso
- ✅ `QuestoesFilterChipStrip` renderiza 4 chips com underline ativa
- ✅ `QuestoesFilterDrawer` layout 60/40 estável
- ✅ `QuestoesFilterPicker` dispatch + fade 150ms
- ✅ 4 pickers existentes wired (Banca, Ano, Órgão+Cargo, Matéria+Assuntos)
- ✅ `QuestoesFilterCard` compõe tudo
- ✅ `/dev/filter-pickers` renderiza card completo + DebugPanel
- ✅ Suite passa, TypeCheck zero, build sucede
- ✅ PR aberto

## Próximos passos

Após merge do 3c-2, abrir branch `feat/questoes-3c-3-painel-direito-flag` e seguir o plano `2026-05-02-questoes-3c-3-painel-direito-flag.md` (a ser escrito).

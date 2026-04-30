# Plano 3a — Foundation shared do card novo de filtros (Metav2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar 3 componentes presentacionais compartilhados (`FilterCheckboxItem`, `FilterAlphabeticList`, `FilterRecentesBlock`) que serão consumidos pelos 6 pickers do Plano 3b. Estes blocos não renderizam em prod ainda — só preparam o terreno.

**Architecture:** Componentes "burros" (sem estado, sem fetch) com props bem definidas. Cada um tem responsabilidade única e API mínima. Compõem-se livremente em pickers especializados (`BancaPicker`, `AnoPicker`, etc.) na próxima Leva.

**Tech Stack:** React 19 · TypeScript · Tailwind CSS · shadcn/ui (`Checkbox` se aplicável)

**Repo alvo:** `D:/meta novo/Metav2`

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md` (seção 3 — Drawer 2 colunas, coluna esquerda)

**Plano anterior (mergeado):** `feat/questoes-shell-tab-questoes` na main.

**Sem unit tests neste plano.** Componentes presentacionais simples (~30-50 linhas cada) sem state nem business logic. Validação via smoke build (TypeScript + Next.js) + visual smoke quando plugados em Plano 3b.

---

## Pré-flight

- [ ] **Step 0.1: Confirmar estado do repo**

```bash
git -C "/d/meta novo/Metav2" status --short | head -10
git -C "/d/meta novo/Metav2" branch --show-current
```

Expected: tem WIP de lei-seca não-commitado (esperado, não tocar). Branch atual provável: `feat/taxonomia-tec-dir-adm` ou `main`.

- [ ] **Step 0.2: Garantir que main está atualizada com Plano 2 mergeado**

```bash
git -C "/d/meta novo/Metav2" fetch origin main
git -C "/d/meta novo/Metav2" log --oneline origin/main -5
```

Expected: ver commits do Plano 2 (`2cad8d8 feat(questoes): Buscar...`, `ac41e93 fix(questoes): preservar...`, etc.) na origin/main.

- [ ] **Step 0.3: Criar branch novo**

Branchando do current state (mesma estratégia do Plano 2 — preserva WIP de lei-seca):

```bash
git -C "/d/meta novo/Metav2" checkout -b feat/questoes-filter-shared-foundation
git -C "/d/meta novo/Metav2" branch --show-current
```

Expected: `feat/questoes-filter-shared-foundation`.

- [ ] **Step 0.4: Smoke build baseline**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -10
```

Expected: build sucesso (verde da branch atual).

---

## Task 1: `FilterCheckboxItem`

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/shared/FilterCheckboxItem.tsx`

**Por que:** Linha checkable padronizada usada por `BancaPicker`, `AnoPicker`, `OrgaoCargoPicker`, `EscolaridadePicker`, `AreaCarreiraPicker` no Plano 3b. Layout: checkbox quadrado + label + count opcional à direita. Hover suave. Click no item inteiro toggla o checkbox.

- [ ] **Step 1.1: Implementar componente**

Criar diretório se não existir:

```bash
mkdir -p "/d/meta novo/Metav2/src/components/questoes/filtros/shared"
```

Criar `D:/meta novo/Metav2/src/components/questoes/filtros/shared/FilterCheckboxItem.tsx`:

```typescript
import { Check } from 'lucide-react';

export interface FilterCheckboxItemProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
  disabled?: boolean;
}

/**
 * Linha checkable padronizada pra pickers (Banca, Ano, Órgão, etc).
 *
 * Layout: checkbox quadrado à esquerda (24px) + label + count opcional à direita.
 * Click em qualquer ponto do item toggla. Hover destaca o fundo.
 *
 * Componente puro — sem estado interno. Pai controla `checked` e responde ao `onToggle`.
 */
export function FilterCheckboxItem({
  label,
  checked,
  onToggle,
  count,
  disabled = false,
}: FilterCheckboxItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={[
        'group flex items-center gap-3 w-full px-2 py-1.5 rounded-md text-left transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-slate-50 cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0',
          checked
            ? 'bg-[#1e3a8a] border-[#1e3a8a] text-white'
            : 'bg-white border-slate-300 group-hover:border-slate-400',
        ].join(' ')}
        aria-hidden="true"
      >
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>

      <span className="flex-1 text-sm text-slate-800 truncate">{label}</span>

      {count !== undefined && (
        <span className="text-xs text-slate-400 tabular-nums shrink-0">
          {count.toLocaleString('pt-BR')}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 1.2: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | grep -i "FilterCheckboxItem\|error" | head -10
```

Expected: sem output relacionado ao novo arquivo (sucesso). Se aparecerem erros, debugar.

Build geral:

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -5
```

Expected: build verde.

- [ ] **Step 1.3: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/components/questoes/filtros/shared/FilterCheckboxItem.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): FilterCheckboxItem (linha checkable padronizada)"
```

Verificar:

```bash
git -C "/d/meta novo/Metav2" status --short
git -C "/d/meta novo/Metav2" show --stat HEAD
```

Expected: commit só inclui o novo arquivo. Working tree continua tendo WIP de lei-seca.

---

## Task 2: `FilterAlphabeticList`

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/shared/FilterAlphabeticList.tsx`

**Por que:** Agrupa items por inicial (A, B, C…) com divisor de letra cinza acima de cada grupo. Mockup mostra esse padrão na coluna esquerda do drawer.

API genérica: recebe `items` (array com `id`, `label`, e qualquer payload extra) + `renderItem` (função que recebe um item e retorna JSX). Lib não impõe que os items sejam checkbox — pode ser folder, link, qualquer coisa.

- [ ] **Step 2.1: Implementar componente**

Criar `D:/meta novo/Metav2/src/components/questoes/filtros/shared/FilterAlphabeticList.tsx`:

```typescript
import React, { useMemo } from 'react';

export interface AlphabeticItem {
  id: string;
  label: string;
}

export interface FilterAlphabeticListProps<T extends AlphabeticItem> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  /** Retorna a chave do grupo. Default: primeira letra maiúscula do label. */
  getGroupKey?: (item: T) => string;
  /** Mostrado quando items está vazio. Default: nada. */
  emptyState?: React.ReactNode;
}

/**
 * Lista agrupada alfabeticamente com divisores de letra.
 *
 * Recebe items genéricos e função de render. Agrupa por inicial do label
 * (override via `getGroupKey`). Render do item fica a critério do consumidor —
 * pode ser FilterCheckboxItem, link de pasta, ou qualquer outro elemento.
 *
 * Exemplo:
 * ```tsx
 * <FilterAlphabeticList
 *   items={bancas}
 *   renderItem={(b) => (
 *     <FilterCheckboxItem
 *       label={b.label}
 *       checked={selected.has(b.id)}
 *       onToggle={() => toggle(b.id)}
 *       count={b.count}
 *     />
 *   )}
 * />
 * ```
 */
export function FilterAlphabeticList<T extends AlphabeticItem>({
  items,
  renderItem,
  getGroupKey,
  emptyState,
}: FilterAlphabeticListProps<T>) {
  const groups = useMemo(() => {
    const keyOf = getGroupKey ?? ((item: T) => firstLetter(item.label));
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyOf(item);
      const arr = map.get(key);
      if (arr) {
        arr.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, getGroupKey]);

  if (items.length === 0) {
    return <div className="py-4">{emptyState}</div>;
  }

  return (
    <div className="flex flex-col">
      {groups.map(([key, group]) => (
        <div key={key} className="flex flex-col">
          <div className="px-2 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {key}
          </div>
          {group.map((item) => (
            <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function firstLetter(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) return '#';
  const first = trimmed[0].toUpperCase();
  // Não-letra (número, símbolo) cai num bucket "#"
  return /[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÄËÏÖÜ]/.test(first) ? first : '#';
}
```

- [ ] **Step 2.2: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | grep -i "FilterAlphabeticList\|error" | head -10
```

Expected: sem output do novo arquivo.

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -5
```

Expected: build verde.

- [ ] **Step 2.3: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/components/questoes/filtros/shared/FilterAlphabeticList.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): FilterAlphabeticList (lista agrupada por inicial com divisor de letra)"
```

---

## Task 3: `FilterRecentesBlock`

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/shared/FilterRecentesBlock.tsx`

**Por que:** Bloco "RECENTES" no topo do picker quando há histórico. Header em uppercase cinza (mesmo estilo do divisor alfabético) + lista de items recentes renderizados via prop function. Diferencial UX do app — preserva no Plano 3.

- [ ] **Step 3.1: Implementar componente**

Criar `D:/meta novo/Metav2/src/components/questoes/filtros/shared/FilterRecentesBlock.tsx`:

```typescript
import React from 'react';

export interface FilterRecentesBlockProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  /** Quantidade máxima exibida. Default: 5. */
  max?: number;
}

/**
 * Bloco "Recentes" no topo do picker.
 *
 * Renderiza nada quando `items` está vazio (não polui UI). Limita a `max` items
 * (default 5). Mesmo padrão visual do divisor alfabético do `FilterAlphabeticList`.
 *
 * O caller decide quais items são "recentes" (via `useRecentFilters` ou outra fonte)
 * e como cada um é renderizado.
 */
export function FilterRecentesBlock<T>({
  items,
  renderItem,
  max = 5,
}: FilterRecentesBlockProps<T>) {
  if (items.length === 0) return null;

  const visible = items.slice(0, max);

  return (
    <div className="flex flex-col">
      <div className="px-2 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        Recentes
      </div>
      {visible.map((item, index) => (
        <React.Fragment key={index}>{renderItem(item)}</React.Fragment>
      ))}
    </div>
  );
}
```

- [ ] **Step 3.2: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | grep -i "FilterRecentesBlock\|error" | head -10
```

Expected: sem output do novo arquivo.

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -5
```

Expected: build verde.

- [ ] **Step 3.3: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/components/questoes/filtros/shared/FilterRecentesBlock.tsx
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): FilterRecentesBlock (header 'Recentes' + items limitados)"
```

---

## Task 4: Index barrel

**Files:**
- Create: `D:/meta novo/Metav2/src/components/questoes/filtros/shared/index.ts`

**Por que:** Centralizar imports do diretório `shared/`. Pickers do Plano 3b importam tudo de um path único.

- [ ] **Step 4.1: Criar barrel**

Criar `D:/meta novo/Metav2/src/components/questoes/filtros/shared/index.ts`:

```typescript
export { FilterCheckboxItem } from './FilterCheckboxItem';
export type { FilterCheckboxItemProps } from './FilterCheckboxItem';

export { FilterAlphabeticList } from './FilterAlphabeticList';
export type {
  FilterAlphabeticListProps,
  AlphabeticItem,
} from './FilterAlphabeticList';

export { FilterRecentesBlock } from './FilterRecentesBlock';
export type { FilterRecentesBlockProps } from './FilterRecentesBlock';
```

- [ ] **Step 4.2: Smoke build**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -5
```

Expected: build verde.

- [ ] **Step 4.3: Smoke import (verifica que barrel resolve)**

```bash
cd "/d/meta novo/Metav2" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "filtros/shared|FilterCheckbox|FilterAlphabetic|FilterRecentes" | head -5
```

Expected: nenhum erro relacionado ao barrel.

- [ ] **Step 4.4: Commit**

```bash
git -C "/d/meta novo/Metav2" add src/components/questoes/filtros/shared/index.ts
git -C "/d/meta novo/Metav2" commit -m "feat(questoes): barrel export de filtros/shared"
```

---

## Task 5: Visual smoke via página descartável

**Files:**
- Create (temporário, NÃO commitar): `D:/meta novo/Metav2/src/views/_dev/FilterSharedSmoke.tsx`

**Por que:** Validar visualmente que os 3 componentes renderizam corretamente antes de plugar em pickers reais (Plano 3b). Depois de validar, deletar.

- [ ] **Step 5.1: Criar página descartável de smoke**

Criar diretório temporário se não existir:

```bash
mkdir -p "/d/meta novo/Metav2/src/views/_dev"
```

Criar `D:/meta novo/Metav2/src/views/_dev/FilterSharedSmoke.tsx`:

```typescript
"use client";

import { useState } from 'react';
import {
  FilterCheckboxItem,
  FilterAlphabeticList,
  FilterRecentesBlock,
  type AlphabeticItem,
} from '@/components/questoes/filtros/shared';

interface BancaItem extends AlphabeticItem {
  count: number;
}

const BANCAS: BancaItem[] = [
  { id: 'cespe', label: 'CEBRASPE (CESPE)', count: 445451 },
  { id: 'fgv', label: 'FGV', count: 234123 },
  { id: 'fcc', label: 'FCC', count: 178234 },
  { id: 'acafe', label: 'ACAFE', count: 12453 },
  { id: 'idecan', label: 'IDECAN', count: 8231 },
  { id: 'idib', label: 'IDIB', count: 4123 },
  { id: 'vunesp', label: 'VUNESP', count: 89231 },
];

const RECENTES: BancaItem[] = [
  { id: 'cespe', label: 'CEBRASPE (CESPE)', count: 445451 },
  { id: 'fgv', label: 'FGV', count: 234123 },
];

export default function FilterSharedSmoke() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderBanca = (b: BancaItem) => (
    <FilterCheckboxItem
      label={b.label}
      checked={selected.has(b.id)}
      onToggle={() => toggle(b.id)}
      count={b.count}
    />
  );

  return (
    <div className="max-w-md mx-auto p-6 bg-white">
      <h1 className="text-lg font-semibold mb-4">Smoke — Filtros shared</h1>

      <div className="border border-slate-200 rounded-lg p-3">
        <FilterRecentesBlock items={RECENTES} renderItem={renderBanca} />
        <FilterAlphabeticList items={BANCAS} renderItem={renderBanca} />
      </div>

      <pre className="mt-4 text-xs text-slate-500">
        Selected: {JSON.stringify(Array.from(selected))}
      </pre>
    </div>
  );
}
```

- [ ] **Step 5.2: Plugar provisoriamente em uma rota**

Editar `D:/meta novo/Metav2/src/App.tsx` e adicionar uma rota descartável `/dev/filter-shared`:

Localizar o bloco `<Routes>` (ou `<BrowserRouter>` com `<Route>`s). Adicionar uma nova `<Route>`:

```typescript
import FilterSharedSmoke from './views/_dev/FilterSharedSmoke';

// dentro de <Routes>:
<Route path="/dev/filter-shared" element={<FilterSharedSmoke />} />
```

- [ ] **Step 5.3: Subir dev server e validar**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Em outro terminal/aba:

1. Abrir `http://localhost:3000/dev/filter-shared`
2. Verificar:
   - Header "RECENTES" cinza uppercase
   - 2 items na seção Recentes (CESPE e FGV)
   - Divisores alfabéticos (A, C, F, I, V) cinza uppercase
   - Items checkbox: clicar muda o `Selected: [...]` no rodapé
   - Hover suave nos items
   - Counts à direita formatados com separador de milhar
3. Se algo quebrar visualmente, parar e reportar.

Após validar, parar o dev server (Ctrl+C).

- [ ] **Step 5.4: Reverter o smoke (deletar página + remover rota)**

Deletar página descartável:

```bash
rm "/d/meta novo/Metav2/src/views/_dev/FilterSharedSmoke.tsx"
rmdir "/d/meta novo/Metav2/src/views/_dev" 2>/dev/null || true
```

Em `D:/meta novo/Metav2/src/App.tsx`, remover:
- O `import FilterSharedSmoke from './views/_dev/FilterSharedSmoke';`
- A linha `<Route path="/dev/filter-shared" element={<FilterSharedSmoke />} />`

- [ ] **Step 5.5: Verificar que working tree não tem nada do smoke**

```bash
git -C "/d/meta novo/Metav2" status --short | grep -E "_dev|FilterSharedSmoke|App.tsx" | head -5
```

Expected: nenhuma linha (App.tsx voltou ao estado original, _dev/ deletado). Se aparecer App.tsx modificado, conferir o diff e reverter o que sobrou:

```bash
git -C "/d/meta novo/Metav2" diff src/App.tsx
```

Se houver linhas de import/Route órfãs, remover manualmente.

- [ ] **Step 5.6: Smoke build final (após cleanup)**

```bash
cd "/d/meta novo/Metav2" && npm run build 2>&1 | tail -5
```

Expected: build verde sem warning de unused import / dead route.

---

## Task 6: Push e PR

- [ ] **Step 6.1: Verificar histórico do branch**

```bash
git -C "/d/meta novo/Metav2" log --oneline main..HEAD
```

Expected: 4 commits (Task 1-4). Smoke da Task 5 não foi commitado.

- [ ] **Step 6.2: Push**

```bash
git -C "/d/meta novo/Metav2" push -u origin feat/questoes-filter-shared-foundation
```

- [ ] **Step 6.3: Abrir PR**

`gh` provavelmente indisponível. URL gerada pelo push: `https://github.com/Jusnote/Metav2/pull/new/feat/questoes-filter-shared-foundation`.

Title sugerido:
```
feat(questoes): Plano 3a — foundation shared do card novo
```

Body sugerido:
```markdown
## Summary
- 3 componentes presentacionais compartilhados pra o card novo de filtros (Plano 3b vai consumir):
  - `FilterCheckboxItem` — linha checkable padronizada com checkbox + label + count opcional
  - `FilterAlphabeticList` — lista agrupada por inicial com divisor de letra
  - `FilterRecentesBlock` — bloco "Recentes" no topo do picker
- Barrel export em `src/components/questoes/filtros/shared/index.ts`
- **Não muda UI em prod** — componentes existem mas não estão renderizados ainda

## Spec
`docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md`

## Plano anterior (mergeado)
`feat/questoes-shell-tab-questoes` — shell + tab Questões com URL sync

## Test plan
- [x] Smoke build production (verde)
- [x] Smoke visual via página `/dev/filter-shared` descartável (validada e revertida antes do commit)
- [ ] Validação real quando plugados em pickers do Plano 3b

## Próximo (Plano 3b)
6 pickers individuais: BancaPicker, AnoPicker, OrgaoCargoPicker, EscolaridadePicker, AreaCarreiraPicker, MateriaAssuntosPicker.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- ✅ 3 componentes shared criados em `src/components/questoes/filtros/shared/`
- ✅ Barrel export funciona
- ✅ Smoke visual via página descartável validou layout
- ✅ Página descartável + rota provisória deletadas antes de commitar
- ✅ Build verde, sem warnings
- ✅ 4 commits limpos (1 por componente + barrel), nada de WIP de lei-seca
- ✅ PR aberto

## Decisões deliberadamente fora deste plano

- **Pickers individuais** (Banca, Ano, etc.) — Plano 3b
- **Card + drawer + chip strip** — Plano 3c
- **Mobile sheet** — Plano 3d
- **Animação Framer Motion** — Plano 3c (onde acontece a troca de chip)
- **Tests automatizados** dos shared — sem `@testing-library/react` no projeto, validação via smoke quando integrados
- **Acessibilidade keyboard nav** completa — Plano 3c
- **`FilterFolderItem`** (item de pasta com chevron pra Matéria com taxonomia) — `MateriaAssuntosPicker` no Plano 3b vai delegar pro `TaxonomiaTreePicker` existente, que já tem seu próprio padrão de item

## Riscos conhecidos

1. **API genérica do `FilterAlphabeticList` pode precisar evoluir.** Hoje aceita qualquer item com `id` + `label` + render function. Se algum picker do Plano 3b precisar de comportamento especial (ex: items hierárquicos, drag-drop), pode ser necessário estender a API. Mitigação: começar simples, evoluir baseado em uso real no Plano 3b.

2. **Smoke só visual.** Sem testes unitários, regressões só aparecem na integração. Aceitável pra componentes presentacionais com ~30-60 linhas e zero lógica de negócio. Plano 3b vai exercitar via uso real.

3. **Bucket "#" pra labels não-letra.** `firstLetter` retorna "#" pra labels que começam com número/símbolo. Mockup não cobre esse caso explicitamente, mas é o padrão razoável (anos seriam ordenados por número, não pela inicial textual — `AnoPicker` provavelmente usa `getGroupKey` custom retornando faixa de década ou decade).

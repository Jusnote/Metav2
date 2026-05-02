# Plano 3c-3 — Painel Direito + Toggles + Aplicar + Feature Flag

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o painel direito completo (header com Carregar↑ disabled, grupos amber clicáveis, count grande de `useQuestoesCount`, 4 toggles ternárias com 2 disabled, botão Aplicar com label dirty), substituir o placeholder do `QuestoesFilterCard` (3c-2) pelo painel real, e ativar feature flag `NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD` no `QuestoesPage.tsx` swap legacy ↔ novo card. Encerra Leva 2 (mobile e cleanup vão pra 3d/3e).

**Architecture:** `QuestoesActiveFiltersPanel` é o composer da coluna direita: header + (grupos OR empty state) + count + toggles + Aplicar. Cada subcomponente é puro/local. `ApplyFiltersButton` lê `isDirty` e `count` do contexto pra computar disabled e label. Toggles binárias (Anuladas, Desatualizadas) escrevem em `pendentes.visibility_*`; toggles disabled (Já respondidas, Errei antes) renderizam mas não mudam state. Feature flag isolada em `QuestoesPage.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + happy-dom + @testing-library/react.

**Spec base:** [`docs/superpowers/specs/2026-05-01-questoes-card-drawer-3c-design.md`](../specs/2026-05-01-questoes-card-drawer-3c-design.md) — seções (3) Painel direito, (4) Toggles, (5) Empty state, (7) Carregar↑, (8) Estado dirty, (9) Feature flag.

**Pré-requisito:** Planos 3c-1 e 3c-2 mergeados em main.

---

## File Structure

```
src/components/questoes/filtros/
  QuestoesActiveFiltersPanel.tsx                  CRIAR — composer coluna direita
  QuestoesFilterEmptyState.tsx                    CRIAR — estado sem filtros pendentes
  VisibilityTogglesPanel.tsx                      CRIAR — 4 toggles
  ApplyFiltersButton.tsx                          CRIAR — botão Aplicar com lógica dirty
  ActiveFiltersGroup.tsx                          CRIAR — 1 grupo amber com × header e × hover por item
  CarregarLink.tsx                                CRIAR — "Carregar ↑" disabled + tooltip
  QuestoesFilterCard.tsx                          MODIFICAR — substituir placeholder por painel
  __tests__/
    ApplyFiltersButton.test.tsx                   CRIAR
    VisibilityTogglesPanel.test.tsx               CRIAR
    QuestoesFilterEmptyState.test.tsx             CRIAR
    ActiveFiltersGroup.test.tsx                   CRIAR
    QuestoesActiveFiltersPanel.test.tsx           CRIAR
src/views/
  QuestoesPage.tsx                                MODIFICAR — feature flag swap
```

**Tipos compartilhados:**

```ts
// Mapeamento dos campos do AppliedFilters para grupos amber no painel
type CategoryKey =
  | 'bancas'
  | 'anos'
  | 'materias'
  | 'assuntos'
  | 'orgaos'
  | 'cargos';

interface CategoryGroupConfig {
  key: CategoryKey;
  label: string;  // ex: "BANCA"
}
```

---

## Pré-requisitos

- Branch: `feat/questoes-3c-3-painel-direito-flag` a partir de main após 3c-2 mergeado
- Variável de ambiente local: `NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD=true` (em `.env.local` pra testar local; default false em produção)

---

## Task 1: `ApplyFiltersButton` — botão com lógica dirty/disabled

**Files:**
- Create: `src/components/questoes/filtros/ApplyFiltersButton.tsx`
- Test: `src/components/questoes/filtros/__tests__/ApplyFiltersButton.test.tsx`

> Lógica: lê `isDirty`, `aplicados`, `pendentes`, `apply` do contexto + `count` do `useQuestoesCount` (pode ser passado por prop ou consumido via hook próprio). Disabled quando `!isDirty` (nada pra aplicar) OU `count === 0` (vazio — discutível, ver edge case 1 do spec; **decisão: deixar habilitado mesmo com count=0** pra consistência com spec). Label = `'Aplicar mudanças'` quando `isDirty`, `'Aplicar filtros'` caso contrário.

- [ ] **Step 1.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/ApplyFiltersButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyFiltersButton } from '../ApplyFiltersButton';

describe('ApplyFiltersButton', () => {
  it('label "Aplicar filtros" quando !isDirty', () => {
    render(<ApplyFiltersButton isDirty={false} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Aplicar filtros');
  });

  it('label "Aplicar mudanças" quando isDirty', () => {
    render(<ApplyFiltersButton isDirty={true} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Aplicar mudanças');
  });

  it('disabled quando !isDirty', () => {
    render(<ApplyFiltersButton isDirty={false} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('habilitado quando isDirty', () => {
    render(<ApplyFiltersButton isDirty={true} count={100} onClick={() => {}} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('habilitado mesmo com count=0 (não bloqueia)', () => {
    render(<ApplyFiltersButton isDirty={true} count={0} onClick={() => {}} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('disabled quando count=null (loading)', () => {
    render(<ApplyFiltersButton isDirty={true} count={null} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('click dispara onClick quando habilitado', () => {
    const onClick = vi.fn();
    render(<ApplyFiltersButton isDirty={true} count={100} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/ApplyFiltersButton.test.tsx`
Expected: FAIL.

- [ ] **Step 1.3: Implementar**

Cria `src/components/questoes/filtros/ApplyFiltersButton.tsx`:

```tsx
'use client';

export interface ApplyFiltersButtonProps {
  isDirty: boolean;
  count: number | null;
  onClick: () => void;
}

export function ApplyFiltersButton({
  isDirty,
  count,
  onClick,
}: ApplyFiltersButtonProps) {
  const disabled = !isDirty || count === null;
  const label = isDirty ? 'Aplicar mudanças' : 'Aplicar filtros';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full py-2.5 rounded text-sm font-semibold transition-colors',
        disabled
          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
          : 'bg-[#0f172a] text-white hover:bg-[#1e293b]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 1.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/ApplyFiltersButton.test.tsx`
Expected: PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/components/questoes/filtros/ApplyFiltersButton.tsx src/components/questoes/filtros/__tests__/ApplyFiltersButton.test.tsx
git commit -m "feat(questoes): ApplyFiltersButton com label dirty + disabled logic"
```

---

## Task 2: `VisibilityTogglesPanel` — 4 linhas com radio horizontal

**Files:**
- Create: `src/components/questoes/filtros/VisibilityTogglesPanel.tsx`
- Test: `src/components/questoes/filtros/__tests__/VisibilityTogglesPanel.test.tsx`

> 4 toggles. Linhas 1-2 binárias (Mostrar/Esconder). Linha 3 binária mas disabled. Linha 4 ternária (Mostrar/Esconder/Somente) disabled. **Toggles disabled têm `aria-disabled="true"` e tooltip "em breve".**

> Estado funcional: linhas 1-2 leem `pendentes.visibility_anuladas` / `visibility_desatualizadas` (default `'mostrar'` — exibido como ativa) e escrevem via `setPendentes`. Linhas 3-4 são puramente visuais.

- [ ] **Step 2.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/VisibilityTogglesPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisibilityTogglesPanel } from '../VisibilityTogglesPanel';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

describe('VisibilityTogglesPanel — render', () => {
  it('renderiza 4 grupos com labels esperados', () => {
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    expect(screen.getByText(/Anuladas/i)).toBeInTheDocument();
    expect(screen.getByText(/Desatualizadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Já respondidas/i)).toBeInTheDocument();
    expect(screen.getByText(/Errei antes/i)).toBeInTheDocument();
  });

  it('Anuladas tem 2 opções (Mostrar, Esconder)', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="anuladas"]');
    const radios = group?.querySelectorAll('input[type="radio"]');
    expect(radios?.length).toBe(2);
  });

  it('Errei antes tem 3 opções (Mostrar, Esconder, Somente)', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="errei_antes"]');
    const radios = group?.querySelectorAll('input[type="radio"]');
    expect(radios?.length).toBe(3);
  });

  it('Anuladas com pendentes vazio → Mostrar selecionado por padrão', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="anuladas"]');
    const checked = group?.querySelector('input[type="radio"]:checked');
    expect((checked as HTMLInputElement)?.value).toBe('mostrar');
  });

  it('Anuladas com pendentes.visibility_anuladas="esconder" → Esconder selecionado', () => {
    const { container } = render(
      <VisibilityTogglesPanel
        pendentes={{ ...EMPTY_FILTERS, visibility_anuladas: 'esconder' }}
        onChange={() => {}}
      />,
    );
    const group = container.querySelector('[data-toggle-group="anuladas"]');
    const checked = group?.querySelector('input[type="radio"]:checked');
    expect((checked as HTMLInputElement)?.value).toBe('esconder');
  });
});

describe('VisibilityTogglesPanel — funcionais (Anuladas, Desatualizadas)', () => {
  it('clicar em Esconder de Anuladas dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={onChange} />,
    );
    const radio = screen.getByLabelText('Esconder Anuladas');
    fireEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith({
      visibility_anuladas: 'esconder',
    });
  });

  it('clicar em Esconder de Desatualizadas dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={onChange} />,
    );
    const radio = screen.getByLabelText('Esconder Desatualizadas');
    fireEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith({
      visibility_desatualizadas: 'esconder',
    });
  });
});

describe('VisibilityTogglesPanel — disabled (Já respondidas, Errei antes)', () => {
  it('Já respondidas tem aria-disabled', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="ja_respondidas"]');
    expect(group).toHaveAttribute('aria-disabled', 'true');
  });

  it('Já respondidas tem title "em breve"', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="ja_respondidas"]');
    expect(group).toHaveAttribute('title', expect.stringMatching(/em breve/i));
  });

  it('clicar em Esconder Já respondidas NÃO dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={onChange} />,
    );
    const radio = screen.getByLabelText('Esconder Já respondidas');
    fireEvent.click(radio);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Errei antes tem aria-disabled e tooltip', () => {
    const { container } = render(
      <VisibilityTogglesPanel pendentes={EMPTY_FILTERS} onChange={() => {}} />,
    );
    const group = container.querySelector('[data-toggle-group="errei_antes"]');
    expect(group).toHaveAttribute('aria-disabled', 'true');
    expect(group).toHaveAttribute('title', expect.stringMatching(/em breve/i));
  });
});
```

- [ ] **Step 2.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/VisibilityTogglesPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 2.3: Implementar**

Cria `src/components/questoes/filtros/VisibilityTogglesPanel.tsx`:

```tsx
'use client';
import type { AppliedFilters, VisibilityState } from '@/lib/questoes/filter-serialization';

interface ToggleRowProps {
  groupKey: string;
  label: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function ToggleRow({
  groupKey,
  label,
  options,
  selectedValue,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <div
      data-toggle-group={groupKey}
      aria-disabled={disabled || undefined}
      title={disabled ? 'em breve' : undefined}
      className={['flex flex-col gap-1', disabled && 'opacity-50'].filter(Boolean).join(' ')}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </div>
      <div className="flex gap-3 text-xs text-slate-700">
        {options.map((opt) => {
          const checked = opt.value === selectedValue;
          return (
            <label
              key={opt.value}
              className={[
                'flex items-center gap-1.5',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <input
                type="radio"
                name={`vis-${groupKey}`}
                value={opt.value}
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  if (!disabled && onChange) onChange(opt.value);
                }}
                aria-label={`${opt.label} ${label}`}
                className="accent-[#1f2937]"
              />
              <span className={checked ? 'font-medium text-slate-900' : ''}>
                {opt.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export interface VisibilityTogglesPanelProps {
  pendentes: AppliedFilters;
  onChange: (patch: Partial<AppliedFilters>) => void;
}

export function VisibilityTogglesPanel({
  pendentes,
  onChange,
}: VisibilityTogglesPanelProps) {
  const anuladas = pendentes.visibility_anuladas ?? 'mostrar';
  const desatualizadas = pendentes.visibility_desatualizadas ?? 'mostrar';

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <ToggleRow
        groupKey="anuladas"
        label="Anuladas"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
        ]}
        selectedValue={anuladas}
        onChange={(v) =>
          onChange({ visibility_anuladas: v as VisibilityState })
        }
      />
      <ToggleRow
        groupKey="desatualizadas"
        label="Desatualizadas"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
        ]}
        selectedValue={desatualizadas}
        onChange={(v) =>
          onChange({ visibility_desatualizadas: v as VisibilityState })
        }
      />
      <ToggleRow
        groupKey="ja_respondidas"
        label="Já respondidas"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
        ]}
        selectedValue="mostrar"
        disabled
      />
      <ToggleRow
        groupKey="errei_antes"
        label="Errei antes"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
          { value: 'somente', label: 'Somente' },
        ]}
        selectedValue="mostrar"
        disabled
      />
    </div>
  );
}
```

- [ ] **Step 2.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/VisibilityTogglesPanel.test.tsx`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/questoes/filtros/VisibilityTogglesPanel.tsx src/components/questoes/filtros/__tests__/VisibilityTogglesPanel.test.tsx
git commit -m "feat(questoes): VisibilityTogglesPanel — 4 toggles (2 funcionais, 2 disabled tooltip 'em breve')"
```

---

## Task 3: `QuestoesFilterEmptyState` — variante minimalista

**Files:**
- Create: `src/components/questoes/filtros/QuestoesFilterEmptyState.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesFilterEmptyState.test.tsx`

- [ ] **Step 3.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/QuestoesFilterEmptyState.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestoesFilterEmptyState } from '../QuestoesFilterEmptyState';

describe('QuestoesFilterEmptyState', () => {
  it('renderiza mensagem padrão', () => {
    render(<QuestoesFilterEmptyState />);
    expect(screen.getByText('Nenhum filtro selecionado.')).toBeInTheDocument();
  });

  it('texto centralizado em wrapper com altura mínima', () => {
    const { container } = render(<QuestoesFilterEmptyState />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/items-center|justify-center/);
  });
});
```

- [ ] **Step 3.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterEmptyState.test.tsx`
Expected: FAIL.

- [ ] **Step 3.3: Implementar**

Cria `src/components/questoes/filtros/QuestoesFilterEmptyState.tsx`:

```tsx
'use client';
import React from 'react';

export function QuestoesFilterEmptyState() {
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <p className="text-sm text-slate-400 text-center">
        Nenhum filtro selecionado.
      </p>
    </div>
  );
}
```

- [ ] **Step 3.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterEmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterEmptyState.tsx src/components/questoes/filtros/__tests__/QuestoesFilterEmptyState.test.tsx
git commit -m "feat(questoes): QuestoesFilterEmptyState — minimalista 'Nenhum filtro selecionado.'"
```

---

## Task 4: `ActiveFiltersGroup` — 1 grupo amber com header × e item × hover

**Files:**
- Create: `src/components/questoes/filtros/ActiveFiltersGroup.tsx`
- Test: `src/components/questoes/filtros/__tests__/ActiveFiltersGroup.test.tsx`

> Renderiza 1 grupo de filtros aplicados. Header com label uppercase + ✕ pra clear all do grupo. Cada item com borda accent amber + ✕ no hover.

- [ ] **Step 4.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/ActiveFiltersGroup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveFiltersGroup } from '../ActiveFiltersGroup';

describe('ActiveFiltersGroup', () => {
  it('renderiza label uppercase', () => {
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE']}
        onClearGroup={() => {}}
        onRemoveItem={() => {}}
      />,
    );
    expect(screen.getByText('BANCA')).toBeInTheDocument();
  });

  it('renderiza items', () => {
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE', 'FGV']}
        onClearGroup={() => {}}
        onRemoveItem={() => {}}
      />,
    );
    expect(screen.getByText('CESPE')).toBeInTheDocument();
    expect(screen.getByText('FGV')).toBeInTheDocument();
  });

  it('click no × do header dispara onClearGroup', () => {
    const onClearGroup = vi.fn();
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE']}
        onClearGroup={onClearGroup}
        onRemoveItem={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar grupo BANCA/i }));
    expect(onClearGroup).toHaveBeenCalled();
  });

  it('click no × do item dispara onRemoveItem com o valor', () => {
    const onRemoveItem = vi.fn();
    render(
      <ActiveFiltersGroup
        label="BANCA"
        items={['CESPE', 'FGV']}
        onClearGroup={() => {}}
        onRemoveItem={onRemoveItem}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remover CESPE/i }));
    expect(onRemoveItem).toHaveBeenCalledWith('CESPE');
  });

  it('grupo vazio não renderiza nada', () => {
    const { container } = render(
      <ActiveFiltersGroup
        label="BANCA"
        items={[]}
        onClearGroup={() => {}}
        onRemoveItem={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 4.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/ActiveFiltersGroup.test.tsx`
Expected: FAIL.

- [ ] **Step 4.3: Implementar**

Cria `src/components/questoes/filtros/ActiveFiltersGroup.tsx`:

```tsx
'use client';

export interface ActiveFiltersGroupProps {
  label: string;
  items: string[];
  onClearGroup: () => void;
  onRemoveItem: (value: string) => void;
}

export function ActiveFiltersGroup({
  label,
  items,
  onClearGroup,
  onRemoveItem,
}: ActiveFiltersGroupProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          {label}
        </span>
        <button
          type="button"
          onClick={onClearGroup}
          aria-label={`limpar grupo ${label}`}
          className="text-slate-400 hover:text-slate-600 px-1 leading-none"
        >
          ✕
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li
            key={item}
            className="group flex items-center justify-between gap-2 pl-3 py-0.5 border-l-2 border-amber-400"
          >
            <span className="text-sm text-slate-700 truncate">{item}</span>
            <button
              type="button"
              onClick={() => onRemoveItem(item)}
              aria-label={`remover ${item}`}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 px-1 leading-none transition-opacity"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/ActiveFiltersGroup.test.tsx`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/components/questoes/filtros/ActiveFiltersGroup.tsx src/components/questoes/filtros/__tests__/ActiveFiltersGroup.test.tsx
git commit -m "feat(questoes): ActiveFiltersGroup — header × + item × hover, accent amber"
```

---

## Task 5: `CarregarLink` — disabled com tooltip "em breve"

**Files:**
- Create: `src/components/questoes/filtros/CarregarLink.tsx`
- Test: `src/components/questoes/filtros/__tests__/CarregarLink.test.tsx`

- [ ] **Step 5.1: Criar testes**

Cria `src/components/questoes/filtros/__tests__/CarregarLink.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarregarLink } from '../CarregarLink';

describe('CarregarLink', () => {
  it('renderiza texto "Carregar ↑"', () => {
    render(<CarregarLink />);
    expect(screen.getByText(/Carregar/)).toBeInTheDocument();
  });

  it('tem aria-disabled=true', () => {
    render(<CarregarLink />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('tem tooltip "em breve"', () => {
    render(<CarregarLink />);
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringMatching(/em breve/i));
  });

  it('click NÃO dispara nada (disabled)', () => {
    const onClick = vi.fn();
    render(<CarregarLink onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/CarregarLink.test.tsx`
Expected: FAIL.

- [ ] **Step 5.3: Implementar**

Cria `src/components/questoes/filtros/CarregarLink.tsx`:

```tsx
'use client';

export interface CarregarLinkProps {
  onClick?: () => void;
}

export function CarregarLink({ onClick: _onClick }: CarregarLinkProps = {}) {
  return (
    <button
      type="button"
      aria-disabled="true"
      title="em breve"
      className="text-xs text-slate-300 cursor-not-allowed"
      onClick={(e) => e.preventDefault()}
    >
      Carregar ↑
    </button>
  );
}
```

- [ ] **Step 5.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/CarregarLink.test.tsx`
Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/questoes/filtros/CarregarLink.tsx src/components/questoes/filtros/__tests__/CarregarLink.test.tsx
git commit -m "feat(questoes): CarregarLink — disabled visual + tooltip 'em breve' (paridade foto)"
```

---

## Task 6: `QuestoesActiveFiltersPanel` — composer da coluna direita

**Files:**
- Create: `src/components/questoes/filtros/QuestoesActiveFiltersPanel.tsx`
- Test: `src/components/questoes/filtros/__tests__/QuestoesActiveFiltersPanel.test.tsx`

> Composer puro recebe `pendentes`, `aplicados`, `isDirty`, `count`, `onApply`, `onChange` por props. Estado interno zero — toda lógica via props (testabilidade fácil + decoupling do contexto).

- [ ] **Step 6.1: Criar testes integrados**

Cria `src/components/questoes/filtros/__tests__/QuestoesActiveFiltersPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestoesActiveFiltersPanel } from '../QuestoesActiveFiltersPanel';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

describe('QuestoesActiveFiltersPanel — header', () => {
  it('mostra "FILTROS ATIVOS · 0" quando vazio', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/FILTROS ATIVOS · 0/i)).toBeInTheDocument();
  });

  it('conta filtros aplicados (não pendentes)', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE', 'FGV'], anos: [2023] }}
        isDirty={false}
        count={1000}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/FILTROS ATIVOS · 3/i)).toBeInTheDocument();
  });
});

describe('QuestoesActiveFiltersPanel — empty state', () => {
  it('renderiza empty state quando pendentes vazio', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Nenhum filtro selecionado.')).toBeInTheDocument();
  });

  it('NÃO renderiza empty state quando há pendentes', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={1000}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('Nenhum filtro selecionado.')).not.toBeInTheDocument();
  });
});

describe('QuestoesActiveFiltersPanel — count', () => {
  it('mostra count formatado em pt-BR', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('3.886.057')).toBeInTheDocument();
  });

  it('mostra "—" quando count=null', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={null}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('label muda pra "total no banco" quando empty', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={EMPTY_FILTERS}
        aplicados={EMPTY_FILTERS}
        isDirty={false}
        count={3886057}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('total no banco')).toBeInTheDocument();
  });

  it('label "questões encontradas" quando há filtros', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        isDirty={false}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('questões encontradas')).toBeInTheDocument();
  });
});

describe('QuestoesActiveFiltersPanel — Aplicar', () => {
  it('botão habilitado quando isDirty', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Aplicar/ })).not.toBeDisabled();
  });

  it('click chama onApply', () => {
    const onApply = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={onApply}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));
    expect(onApply).toHaveBeenCalled();
  });
});

describe('QuestoesActiveFiltersPanel — grupos', () => {
  it('renderiza grupo BANCA quando aplicados.bancas tem itens', () => {
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        aplicados={{ ...EMPTY_FILTERS, bancas: ['CESPE'] }}
        isDirty={false}
        count={500}
        onApply={() => {}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('BANCA')).toBeInTheDocument();
    expect(screen.getByText('CESPE')).toBeInTheDocument();
  });

  it('clique no × do grupo dispara onChange limpando categoria', () => {
    const onChange = vi.fn();
    render(
      <QuestoesActiveFiltersPanel
        pendentes={{ ...EMPTY_FILTERS, bancas: ['CESPE'], anos: [2023] }}
        aplicados={EMPTY_FILTERS}
        isDirty={true}
        count={500}
        onApply={() => {}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar grupo BANCA/i }));
    expect(onChange).toHaveBeenCalledWith({ bancas: [] });
  });
});
```

- [ ] **Step 6.2: Rodar — FAIL**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesActiveFiltersPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 6.3: Implementar composer**

Cria `src/components/questoes/filtros/QuestoesActiveFiltersPanel.tsx`:

```tsx
'use client';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { countActiveFilters, hasAnyFilter } from '@/lib/questoes/filter-serialization';
import { ActiveFiltersGroup } from './ActiveFiltersGroup';
import { CarregarLink } from './CarregarLink';
import { QuestoesFilterEmptyState } from './QuestoesFilterEmptyState';
import { VisibilityTogglesPanel } from './VisibilityTogglesPanel';
import { ApplyFiltersButton } from './ApplyFiltersButton';

const GROUP_CONFIG: Array<{
  key: keyof AppliedFilters;
  label: string;
}> = [
  { key: 'bancas', label: 'BANCA' },
  { key: 'orgaos', label: 'ÓRGÃO' },
  { key: 'cargos', label: 'CARGO' },
  { key: 'anos', label: 'ANO' },
  { key: 'materias', label: 'MATÉRIA' },
  { key: 'assuntos', label: 'ASSUNTO' },
];

function formatCount(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('pt-BR');
}

export interface QuestoesActiveFiltersPanelProps {
  pendentes: AppliedFilters;
  aplicados: AppliedFilters;
  isDirty: boolean;
  count: number | null;
  onApply: () => void;
  onChange: (patch: Partial<AppliedFilters>) => void;
}

export function QuestoesActiveFiltersPanel({
  pendentes,
  aplicados,
  isDirty,
  count,
  onApply,
  onChange,
}: QuestoesActiveFiltersPanelProps) {
  const aplicadosCount = countActiveFilters(aplicados);
  const pendentesEmpty = !hasAnyFilter(pendentes);
  const countLabel = pendentesEmpty ? 'total no banco' : 'questões encontradas';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          FILTROS ATIVOS · {aplicadosCount}
        </span>
        <CarregarLink />
      </div>

      {/* Body: grupos OU empty state */}
      <div className="flex-1 overflow-auto px-4 py-2">
        {pendentesEmpty ? (
          <QuestoesFilterEmptyState />
        ) : (
          GROUP_CONFIG.map((cfg) => {
            const items = (pendentes[cfg.key] as (string | number)[] | undefined) ?? [];
            return (
              <ActiveFiltersGroup
                key={cfg.key}
                label={cfg.label}
                items={items.map(String)}
                onClearGroup={() => onChange({ [cfg.key]: [] } as Partial<AppliedFilters>)}
                onRemoveItem={(value) => {
                  const next = items.filter((v) => String(v) !== value);
                  onChange({ [cfg.key]: next } as Partial<AppliedFilters>);
                }}
              />
            );
          })
        )}
      </div>

      {/* Count grande */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="text-[36px] font-semibold text-slate-900 leading-none">
          {formatCount(count)}
        </div>
        <div className="text-xs text-slate-400 mt-1">{countLabel}</div>
      </div>

      {/* Toggles */}
      <VisibilityTogglesPanel pendentes={pendentes} onChange={onChange} />

      {/* Aplicar */}
      <div className="px-4 pb-4">
        <ApplyFiltersButton isDirty={isDirty} count={count} onClick={onApply} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: Rodar — PASS**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesActiveFiltersPanel.test.tsx`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/components/questoes/filtros/QuestoesActiveFiltersPanel.tsx src/components/questoes/filtros/__tests__/QuestoesActiveFiltersPanel.test.tsx
git commit -m "feat(questoes): QuestoesActiveFiltersPanel composer (header + grupos OR empty + count + toggles + Aplicar)"
```

---

## Task 7: Plug do painel direito no `QuestoesFilterCard`

**Files:**
- Modify: `src/components/questoes/filtros/QuestoesFilterCard.tsx`
- Modify: `src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`

> Trocar o placeholder `<div data-testid="painel-direito-placeholder">` por `<QuestoesActiveFiltersPanel />` consumindo o contexto e `useQuestoesCount`.

- [ ] **Step 7.1: Atualizar testes do Card**

Em `src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`, substituir o teste `'renderiza placeholder na coluna direita'` por:

```tsx
it('renderiza painel direito real (header FILTROS ATIVOS)', () => {
  render(withProviders(<QuestoesFilterCard />));
  expect(screen.getByText(/FILTROS ATIVOS · 0/i)).toBeInTheDocument();
});

it('renderiza empty state quando sem filtros', () => {
  render(withProviders(<QuestoesFilterCard />));
  expect(screen.getByText('Nenhum filtro selecionado.')).toBeInTheDocument();
});

it('renderiza botão Aplicar filtros desabilitado quando vazio', () => {
  render(withProviders(<QuestoesFilterCard />));
  const btn = screen.getByRole('button', { name: /Aplicar filtros/ });
  expect(btn).toBeDisabled();
});
```

- [ ] **Step 7.2: Trocar placeholder por painel real**

Em `src/components/questoes/filtros/QuestoesFilterCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { QuestoesFilterChipStrip, type ChipKey } from './QuestoesFilterChipStrip';
import { QuestoesFilterDrawer } from './QuestoesFilterDrawer';
import { QuestoesFilterPicker } from './QuestoesFilterPicker';
import { QuestoesActiveFiltersPanel } from './QuestoesActiveFiltersPanel';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useQuestoesCount } from '@/hooks/useQuestoesCount';

export function QuestoesFilterCard() {
  const [activeChip, setActiveChip] = useState<ChipKey>('materia_assuntos');
  const { pendentes, aplicados, isDirty, setPendentes, apply } = useFiltrosPendentes();
  const { count } = useQuestoesCount(pendentes);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <QuestoesFilterChipStrip activeChip={activeChip} onChange={setActiveChip} />
      <QuestoesFilterDrawer
        left={<QuestoesFilterPicker activeChip={activeChip} />}
        right={
          <QuestoesActiveFiltersPanel
            pendentes={pendentes}
            aplicados={aplicados}
            isDirty={isDirty}
            count={count}
            onApply={apply}
            onChange={(patch) => setPendentes({ ...pendentes, ...patch })}
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 7.3: Rodar testes do Card**

Run: `npx vitest run src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx`
Expected: PASS.

- [ ] **Step 7.4: Commit**

```bash
git add src/components/questoes/filtros/QuestoesFilterCard.tsx src/components/questoes/filtros/__tests__/QuestoesFilterCard.test.tsx
git commit -m "feat(questoes): QuestoesFilterCard pluga QuestoesActiveFiltersPanel (substitui placeholder)"
```

---

## Task 8: Smoke test no `/dev/filter-pickers` (com painel real)

> Sem mudança de código — apenas validação visual do que 3c-2 já entregou + 3c-3 acabou de plugar.

- [ ] **Step 8.1: Verificar manualmente**

Em terminal separado: `npm run dev`
Abrir: `http://localhost:3000/dev/filter-pickers`

**Checklist visual:**
- ✅ Card com chip strip 4 chips
- ✅ Coluna esquerda mostra picker da chip ativa
- ✅ Coluna direita: header "FILTROS ATIVOS · 0", "Carregar ↑" cinza claro
- ✅ Empty state "Nenhum filtro selecionado." centralizado
- ✅ Count grande mostra total + label "total no banco"
- ✅ Toggles 4 linhas: Anuladas, Desatualizadas (ambas Mostrar marcado), Já respondidas e Errei antes opaque
- ✅ Hover em "Já respondidas" mostra tooltip "em breve"
- ✅ Botão "Aplicar filtros" disabled, cinza
- ✅ Selecionar uma banca → empty state some, grupo BANCA aparece com item e × hover
- ✅ Header passa pra "FILTROS ATIVOS · 0" (ainda 0 porque é APLICADOS, não PENDENTES)
- ✅ Botão muda pra "Aplicar mudanças" em preto, habilitado
- ✅ Click "Aplicar mudanças" → URL atualiza, header passa pra "FILTROS ATIVOS · 1", botão volta pra "Aplicar filtros" disabled

Se algo falhar visualmente, anotar e ajustar componente isolado antes de seguir.

---

## Task 9: Feature flag em `QuestoesPage.tsx`

**Files:**
- Modify: `src/views/QuestoesPage.tsx:154-163` (bloco `{filterView === 'filtros' && ...}`)
- Adicionar verificação de env var

- [ ] **Step 9.1: Importar QuestoesFilterCard e adicionar guard de flag**

Em `src/views/QuestoesPage.tsx`, adicionar import:

```tsx
import { QuestoesFilterCard } from '@/components/questoes/filtros/QuestoesFilterCard';
```

E uma constante no topo do arquivo (após imports):

```tsx
const USE_NEW_FILTER_CARD =
  process.env.NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD === 'true';
```

- [ ] **Step 9.2: Trocar legacy por novo card atrás da flag**

Substituir o JSX dentro de `<QuestoesFilterDraftProvider>` (já adicionado em 3c-1):

**Antes (após 3c-1):**

```tsx
{filterView === 'filtros' && (
  <QuestoesFilterDraftProvider>
    <ObjetivoSection />
    <div className="pt-2 pb-2">
      <QuestoesFilterBar onPopoverChange={setHasOpenPopover} onSearch={handleSearch} />
    </div>
    <FilterChipsBidirectional onSearch={handleSearch} />
  </QuestoesFilterDraftProvider>
)}
```

**Depois:**

```tsx
{filterView === 'filtros' && (
  <QuestoesFilterDraftProvider>
    <ObjetivoSection />
    {USE_NEW_FILTER_CARD ? (
      <div className="pt-2 pb-2">
        <QuestoesFilterCard />
      </div>
    ) : (
      <>
        <div className="pt-2 pb-2">
          <QuestoesFilterBar onPopoverChange={setHasOpenPopover} onSearch={handleSearch} />
        </div>
        <FilterChipsBidirectional onSearch={handleSearch} />
      </>
    )}
  </QuestoesFilterDraftProvider>
)}
```

- [ ] **Step 9.3: TypeCheck**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 9.4: Smoke test com flag false (default)**

Não setar `.env.local`. Reiniciar dev server.
Abrir `/questoes?view=filtros`.
Expected: vê `QuestoesFilterBar` legacy + `FilterChipsBidirectional` (caminho atual de produção).

- [ ] **Step 9.5: Smoke test com flag true**

Em `.env.local` (criar se não existir):

```
NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD=true
```

Reiniciar dev server.
Abrir `/questoes?view=filtros`.
Expected: vê `QuestoesFilterCard` novo (chip strip + drawer + painel direito).

**Test E2E manual completo:**
- Selecionar banca → empty state some → grupo aparece → "Aplicar mudanças" preto habilitado
- Click Aplicar → URL ganha `?bancas=cespe`
- Trocar pra tab "Questões" → resultados refletem o filtro
- Voltar pra tab "Filtros" → estado preservado
- Apertar back do navegador → volta pro estado anterior, header sincronizado

- [ ] **Step 9.6: Commit**

```bash
git add src/views/QuestoesPage.tsx
git commit -m "feat(questoes): feature flag NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD swap legacy ↔ QuestoesFilterCard"
```

---

## Task 10: Suite final + push + PR

- [ ] **Step 10.1: Rodar suite completa**

Run: `npx vitest run`
Expected: 0 failures.

- [ ] **Step 10.2: TypeCheck**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 10.3: Build**

Run: `npm run build:dev`
Expected: build succeeds.

- [ ] **Step 10.4: Push**

```bash
git push -u origin feat/questoes-3c-3-painel-direito-flag
```

- [ ] **Step 10.5: Abrir PR**

```bash
gh pr create --title "feat(questoes): 3c-3 — Painel Direito + Toggles + Aplicar + Feature Flag (encerra Leva 2 desktop)" --body "$(cat <<'EOF'
## Summary
- `ApplyFiltersButton` com label dirty + disabled logic
- `VisibilityTogglesPanel` 4 toggles (2 funcionais Anuladas/Desatualizadas, 2 disabled Já respondidas/Errei antes com tooltip "em breve")
- `QuestoesFilterEmptyState` minimalista
- `ActiveFiltersGroup` grupo amber com header × e item × no hover
- `CarregarLink` disabled visual (paridade foto)
- `QuestoesActiveFiltersPanel` composer da coluna direita
- `QuestoesFilterCard` agora pluga painel direito real
- Feature flag `NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD` em `QuestoesPage.tsx`

## Plan
docs/superpowers/plans/2026-05-02-questoes-3c-3-painel-direito-flag.md

## Test plan
- [ ] `npx vitest run` passa
- [ ] `npx tsc --noEmit` zero erros
- [ ] `npm run build:dev` succeeds
- [ ] Flag default (false) mostra QuestoesFilterBar legacy intacto
- [ ] Flag true mostra QuestoesFilterCard com painel direito completo
- [ ] Selecionar filtros, ver count atualizar com debounce 300ms
- [ ] Aplicar filtros muda URL e habilita "Aplicar filtros" disabled (até nova mudança)
- [ ] × no header de grupo limpa categoria
- [ ] × hover no item remove só ele
- [ ] Toggle Anuladas Esconder afeta count
- [ ] Toggle Já respondidas/Errei antes mostra tooltip "em breve" no hover

## Rollback
Em produção, `NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD=false` no Coolify (ou unset). Sem deploy necessário.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Definition of Done — 3c-3

- ✅ `ApplyFiltersButton` muda label conforme dirty + disabled quando !dirty
- ✅ `VisibilityTogglesPanel` 4 toggles, 2 funcionais 2 disabled
- ✅ `QuestoesFilterEmptyState` aparece quando pendentes vazio
- ✅ `ActiveFiltersGroup` × header limpa categoria, × item hover remove
- ✅ `CarregarLink` visível disabled com tooltip
- ✅ `QuestoesActiveFiltersPanel` compõe tudo
- ✅ `QuestoesFilterCard` pluga painel direito
- ✅ Feature flag em produção (Coolify)
- ✅ Flag false: legacy intacto. Flag true: card novo.
- ✅ Suite passa, TypeCheck zero, build sucede
- ✅ PR mergeado

## Encerramento da Leva 2 (desktop)

Após merge do 3c-3, o card novo está em produção atrás da flag. Próximas Levas:

- **3d (Mobile)** — `QuestoesFilterMobileSheet` + variantes A/B
- **3e (Cleanup)** — aposentar QuestoesFilterBar/Pill/Popover/Sheet/Overlay/FilterChipsBidirectional/AdvancedPopover

## Notas de QA pré-merge

Pra validar antes de flipar flag em produção:
1. **Rodar localmente com flag true** e testar fluxo completo (selecionar → aplicar → ver questões → editar → reaplicar)
2. **Testar deep link** `/questoes?view=filtros&bancas=cespe&anos=2023` — deve hidratar pendentes e header corretamente
3. **Testar back/forward do browser** entre tabs e estados
4. **Testar com dicionário lento** (network throttle 3G) — pickers devem mostrar skeleton
5. **Conferir performance** — count deve responder ≤ 300ms cache hit, ≤ 2s cache miss
6. **Validar visualmente** contra a foto referência (chip strip layout, painel direito, toggles)

Após validar local, flag fica `false` no Coolify por padrão. Aldemir flipa quando quiser ativar pra alunos beta.

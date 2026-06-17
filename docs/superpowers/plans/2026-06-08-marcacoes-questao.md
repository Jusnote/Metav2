# Marcações na Questão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir marcar trechos da questão (enunciado + alternativas) em dois tipos — **Grifo comum** (só cor) e **Atenção** (cor + triângulo + tipo + nota) — com persistência por usuário e um **Caderno** para revisar.

**Architecture:** Persistência por âncora **quote+contexto** (não offset). Renderização **sem mutar o DOM** da questão: uma **camada de overlay** absoluta desenha os fundos coloridos (via `Range.getClientRects()`) e os triângulos; reposiciona em resize/reflow. Estado servidor via React Query espelhando `useQuestionNote`. Tudo gira em torno de uma única tabela `question_highlights`.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + RLS), `@tanstack/react-query`, Tailwind v4, Vitest (happy-dom) + Testing Library, DOMPurify (já no card).

---

## Notas para o executor

- **Rodar um teste:** `npx vitest run <caminho>` (não há script `test`). Watch: `npx vitest <caminho>`.
- **Ambiente de teste é happy-dom** → **não há layout** (`getClientRects()` retorna vazio) nem **CSS Custom Highlight API**. Por isso:
  - TDD de verdade: `highlights.config.ts`, `highlight-anchor.ts`, e os **popovers** (interação/callbacks, como os testes de `filtros/`).
  - **Verificação manual no app** (passos "Run app"): `HighlightLayer`, posicionamento dos triângulos, integração no card. Use `npm run dev` → questão real.
- **Branch:** já estamos em `feat/marcacoes-questao`.
- **Padrões existentes a seguir:** hooks como `src/hooks/useQuestionNote.ts`; testes como `src/components/questoes/filtros/__tests__/`.

## Mapa de arquivos

**Criar:**
- `src/components/questoes/highlights/highlights.config.ts` — fonte única de `COLORS` e `MARK_TYPES`.
- `src/components/questoes/highlights/lib/highlight-anchor.ts` — `createAnchor` / `resolveAnchor`.
- `src/components/questoes/highlights/lib/highlight-render.ts` — cálculo de retângulos + posição do triângulo a partir de um `Range`.
- `src/components/questoes/highlights/HighlightLayer.tsx` — overlay que pinta fundos + triângulos sobre os blocos.
- `src/components/questoes/highlights/SelectionToolbar.tsx` — popover de seleção (toggle Atenção/Comum + paleta).
- `src/components/questoes/highlights/HighlightNotePopover.tsx` — nota da Atenção.
- `src/components/questoes/highlights/PlainHighlightMenu.tsx` — mini-menu do Grifo comum.
- `src/components/questoes/highlights/TriangleIcon.tsx` — o triângulo (path único reusável).
- `src/components/questoes/highlights/types.ts` — tipos compartilhados (`Highlight`, `MarkKind`, `Anchor`).
- `src/components/questoes/highlights/__tests__/*.test.tsx` — testes.
- `src/hooks/useQuestionHighlights.ts` — CRUD por questão (React Query).
- `src/hooks/useHighlightsAll.ts` — lista global p/ o Caderno + contagem.
- `src/components/questoes/caderno/CadernoDrawer.tsx` + `CadernoItem.tsx` — o Caderno.
- `supabase/migrations/<ts>_question_highlights.sql` — tabela + RLS + índices.

**Modificar:**
- `src/components/QuestionCard.tsx` — marcar blocos, montar layer, fiar seleção, remover `lisere`.
- `src/types/database.ts` — regerar após a migration.
- `src/views/QuestoesPage.tsx` (ou `AppTopNav.tsx`) — botão "Meu Caderno" + drawer + deep-link `?hl=`.

---

## Fase 1 — Config & Tipos

### Task 1: Config de cores e tipos

**Files:**
- Create: `src/components/questoes/highlights/types.ts`
- Create: `src/components/questoes/highlights/highlights.config.ts`
- Test: `src/components/questoes/highlights/__tests__/highlights.config.test.ts`

- [ ] **Step 1: Escrever os tipos**

```typescript
// src/components/questoes/highlights/types.ts
export type MarkKind = 'plain' | 'attention';

export type MarkTypeId = 'pegadinha' | 'chave' | 'cuidado' | 'sacada' | 'revisar';

/** Âncora persistente (W3C TextQuote Selector). */
export interface Anchor {
  quote: string;
  prefix: string;
  suffix: string;
}

/** Uma marca, como vem do banco e como o front usa. */
export interface Highlight {
  id: string;
  questionId: number;
  target: string;        // 'enunciado' | 'alt:A' | 'alt:B'...
  kind: MarkKind;
  color: string;         // hex #RRGGBB
  type: MarkTypeId | null;
  quote: string;
  prefix: string;
  suffix: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Escrever o teste (falha)**

```typescript
// src/components/questoes/highlights/__tests__/highlights.config.test.ts
import { describe, it, expect } from 'vitest';
import { COLORS, MARK_TYPES, bgFor, typeLabel } from '../highlights.config';

describe('highlights.config', () => {
  it('tem 12 cores hex válidas e sem repetição', () => {
    expect(COLORS).toHaveLength(12);
    COLORS.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
    expect(new Set(COLORS).size).toBe(12);
  });

  it('tem os 5 tipos de Atenção com label', () => {
    expect(MARK_TYPES.map(t => t.id)).toEqual(['pegadinha', 'chave', 'cuidado', 'sacada', 'revisar']);
    expect(typeLabel('pegadinha')).toBe('Pegadinha');
  });

  it('bgFor aplica alpha menor p/ atenção e maior p/ comum', () => {
    expect(bgFor('#E0484D', 'attention')).toBe('#E0484D2b');
    expect(bgFor('#E0484D', 'plain')).toBe('#E0484D3d');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/highlights.config.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 4: Implementar a config**

```typescript
// src/components/questoes/highlights/highlights.config.ts
import type { MarkKind, MarkTypeId } from './types';

export const COLORS = [
  '#E0484D', '#E8703A', '#F2C231', '#4CAF6E', '#2BB7A3', '#4F86E0',
  '#8B5CF6', '#D6589E', '#6E4A28', '#8A8F98', '#0F7B5F', '#C2410C',
] as const;

/** Cores no quick-row da seleção (subset). */
export const QUICK_COLORS = COLORS.slice(0, 8);

export const MARK_TYPES: { id: MarkTypeId; label: string }[] = [
  { id: 'pegadinha', label: 'Pegadinha' },
  { id: 'chave', label: 'Palavra-chave' },
  { id: 'cuidado', label: 'Cuidado' },
  { id: 'sacada', label: 'Sacada' },
  { id: 'revisar', label: 'Revisar depois' },
];

export function typeLabel(id: MarkTypeId | null): string {
  return MARK_TYPES.find(t => t.id === id)?.label ?? 'Pegadinha';
}

/** Fundo do destaque: alpha ~17% (atenção) / ~24% (comum). */
export function bgFor(color: string, kind: MarkKind): string {
  return color + (kind === 'plain' ? '3d' : '2b');
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/highlights.config.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add src/components/questoes/highlights/types.ts src/components/questoes/highlights/highlights.config.ts src/components/questoes/highlights/__tests__/highlights.config.test.ts
git commit -m "feat(marcacoes): config de cores/tipos + tipos compartilhados"
```

---

## Fase 2 — Ancoragem (quote + contexto)

### Task 2: createAnchor / resolveAnchor

A âncora não depende de layout (só de `textContent`), então é **100% TDD em happy-dom**.

**Files:**
- Create: `src/components/questoes/highlights/lib/highlight-anchor.ts`
- Test: `src/components/questoes/highlights/__tests__/highlight-anchor.test.ts`

- [ ] **Step 1: Escrever os testes (falha)**

```typescript
// src/components/questoes/highlights/__tests__/highlight-anchor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createAnchor, resolveAnchor } from '../lib/highlight-anchor';

function blockWith(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}

/** Cria um Range cobrindo a 1ª ocorrência de `needle` no textContent do bloco. */
function rangeFor(block: HTMLElement, needle: string): Range {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const i = node.data.indexOf(needle);
    if (i !== -1) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + needle.length);
      return r;
    }
  }
  throw new Error('needle não encontrado num único nó de texto: ' + needle);
}

describe('highlight-anchor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('createAnchor captura quote, prefix e suffix', () => {
    const block = blockWith('<p>compete privativamente à União legislar sobre tributos</p>');
    const anchor = createAnchor(block, rangeFor(block, 'privativamente à União'));
    expect(anchor.quote).toBe('privativamente à União');
    expect(anchor.prefix.endsWith('compete ')).toBe(true);
    expect(anchor.suffix.startsWith(' legislar')).toBe(true);
  });

  it('resolveAnchor reencontra o trecho e devolve um Range com o texto certo', () => {
    const block = blockWith('<p>compete privativamente à União legislar</p>');
    const anchor = createAnchor(block, rangeFor(block, 'privativamente à União'));
    const range = resolveAnchor(block, anchor);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('privativamente à União');
  });

  it('desambigua quote repetido pelo contexto (prefix/suffix)', () => {
    const block = blockWith('<p>a lei a lei a lei</p>'); // "a lei" 3x
    const a2 = createAnchor(block, rangeFor2(block, 'a lei', 2)); // 2ª ocorrência
    const range = resolveAnchor(block, a2);
    expect(range).not.toBeNull();
    // posição inicial da 2ª ocorrência (index 6) confirma desambiguação
    const full = (block.textContent ?? '');
    const start = full.indexOf('a lei', full.indexOf('a lei') + 1);
    expect(offsetInBlock(block, range!)).toBe(start);
  });

  it('retorna null quando o trecho some (texto mudou)', () => {
    const block = blockWith('<p>compete privativamente à União</p>');
    const anchor = createAnchor(block, rangeFor(block, 'privativamente à União'));
    block.innerHTML = '<p>texto totalmente diferente</p>';
    expect(resolveAnchor(block, anchor)).toBeNull();
  });
});

// helpers que tocam offset global no bloco
function rangeFor2(block: HTMLElement, needle: string, nth: number): Range {
  const full = block.textContent ?? '';
  let idx = -1;
  for (let k = 0; k < nth; k++) idx = full.indexOf(needle, idx + 1);
  return rangeAtGlobalOffset(block, idx, idx + needle.length);
}
function rangeAtGlobalOffset(block: HTMLElement, start: number, end: number): Range {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0; let node: Text | null; const r = document.createRange();
  let setStart = false;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.data.length;
    if (!setStart && start <= acc + len) { r.setStart(node, start - acc); setStart = true; }
    if (end <= acc + len) { r.setEnd(node, end - acc); return r; }
    acc += len;
  }
  throw new Error('offset fora do bloco');
}
function offsetInBlock(block: HTMLElement, range: Range): number {
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/highlight-anchor.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar a ancoragem**

```typescript
// src/components/questoes/highlights/lib/highlight-anchor.ts
import type { Anchor } from '../types';

const CONTEXT = 32;

/** textContent total do bloco. */
function fullText(block: HTMLElement): string {
  return block.textContent ?? '';
}

/** Offset global (em chars do textContent) do início de um Range dentro do bloco. */
function startOffset(block: HTMLElement, range: Range): number {
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function createAnchor(block: HTMLElement, range: Range): Anchor {
  const quote = range.toString();
  const start = startOffset(block, range);
  const full = fullText(block);
  return {
    quote,
    prefix: full.slice(Math.max(0, start - CONTEXT), start),
    suffix: full.slice(start + quote.length, start + quote.length + CONTEXT),
  };
}

/** Converte um offset global do bloco num Range (mapeando para nós de texto). */
function rangeAtOffset(block: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let node: Text | null;
  const range = document.createRange();
  let startSet = false;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.data.length;
    if (!startSet && start <= acc + len) { range.setStart(node, start - acc); startSet = true; }
    if (startSet && end <= acc + len) { range.setEnd(node, end - acc); return range; }
    acc += len;
  }
  return null;
}

/**
 * Acha a melhor ocorrência de `quote` no bloco, pontuando pela quantidade de
 * contexto (prefix/suffix) que casa. Retorna o Range ou null.
 */
export function resolveAnchor(block: HTMLElement, anchor: Anchor): Range | null {
  const full = fullText(block);
  const { quote, prefix, suffix } = anchor;
  if (!quote) return null;

  let best = -1;
  let bestScore = -1;
  let from = 0;
  for (;;) {
    const idx = full.indexOf(quote, from);
    if (idx === -1) break;
    const pre = full.slice(Math.max(0, idx - prefix.length), idx);
    const suf = full.slice(idx + quote.length, idx + quote.length + suffix.length);
    const score = commonSuffixLen(pre, prefix) + commonPrefixLen(suf, suffix);
    if (score > bestScore) { bestScore = score; best = idx; }
    from = idx + 1;
  }
  if (best === -1) return null;
  return rangeAtOffset(block, best, best + quote.length);
}

function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/highlight-anchor.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/questoes/highlights/lib/highlight-anchor.ts src/components/questoes/highlights/__tests__/highlight-anchor.test.ts
git commit -m "feat(marcacoes): ancoragem por quote+contexto (createAnchor/resolveAnchor)"
```

---

## Fase 3 — Banco de dados

### Task 3: Tabela `question_highlights` + RLS + índices

**Files:**
- Create: `supabase/migrations/20260608120000_question_highlights.sql`
- Modify: `src/types/database.ts` (regenerar)

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260608120000_question_highlights.sql
create table if not exists public.question_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id bigint not null,
  target      text not null,                       -- 'enunciado' | 'alt:A'...
  kind        text not null check (kind in ('plain','attention')),
  color       text not null,
  type        text check (type in ('pegadinha','chave','cuidado','sacada','revisar')),
  quote       text not null,
  prefix      text not null default '',
  suffix      text not null default '',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists qh_user_question_idx on public.question_highlights (user_id, question_id);
create index if not exists qh_user_type_idx     on public.question_highlights (user_id, type);
create index if not exists qh_user_created_idx  on public.question_highlights (user_id, created_at desc);

alter table public.question_highlights enable row level security;

create policy "qh_select_own" on public.question_highlights
  for select using (auth.uid() = user_id);
create policy "qh_insert_own" on public.question_highlights
  for insert with check (auth.uid() = user_id);
create policy "qh_update_own" on public.question_highlights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "qh_delete_own" on public.question_highlights
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar no Supabase**

Run: `npx supabase db push` (ou aplicar o SQL no painel do projeto `xmtleqquivcukwgdexhc`).
Expected: tabela criada, 4 policies, 3 índices.

- [ ] **Step 3: Regenerar tipos**

Run: `npx supabase gen types typescript --project-id xmtleqquivcukwgdexhc > src/types/database.ts`
Expected: `question_highlights` aparece em `Database['public']['Tables']`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260608120000_question_highlights.sql src/types/database.ts
git commit -m "feat(marcacoes): tabela question_highlights + RLS + índices"
```

---

## Fase 4 — Hooks (React Query)

### Task 4: `useQuestionHighlights`

Espelha `src/hooks/useQuestionNote.ts`. (Teste de hook é opcional aqui — a verificação real vem na integração; foque no código correto.)

**Files:**
- Create: `src/hooks/useQuestionHighlights.ts`

- [ ] **Step 1: Implementar o hook**

```typescript
// src/hooks/useQuestionHighlights.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Highlight, MarkKind, MarkTypeId } from '@/components/questoes/highlights/types';

type Row = {
  id: string; question_id: number; target: string; kind: MarkKind; color: string;
  type: MarkTypeId | null; quote: string; prefix: string; suffix: string;
  note: string | null; created_at: string; updated_at: string;
};

function toHighlight(r: Row): Highlight {
  return {
    id: r.id, questionId: r.question_id, target: r.target, kind: r.kind, color: r.color,
    type: r.type, quote: r.quote, prefix: r.prefix, suffix: r.suffix, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export interface CreateHighlightInput {
  questionId: number; target: string; kind: MarkKind; color: string;
  type: MarkTypeId | null; quote: string; prefix: string; suffix: string; note: string | null;
}

export function useQuestionHighlights(questionId: number | null) {
  const qc = useQueryClient();
  const queryKey = ['question-highlights', questionId];

  const query = useQuery({
    queryKey,
    enabled: !!questionId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Highlight[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('question_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', questionId!);
      if (error) throw error;
      return (data as Row[]).map(toHighlight);
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateHighlightInput): Promise<Highlight> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('question_highlights').insert({
        user_id: user.id, question_id: input.questionId, target: input.target,
        kind: input.kind, color: input.color, type: input.type, quote: input.quote,
        prefix: input.prefix, suffix: input.suffix, note: input.note,
      }).select().single();
      if (error) throw error;
      return toHighlight(data as Row);
    },
    onSuccess: (h) => qc.setQueryData<Highlight[]>(queryKey, (prev = []) => [...prev, h]),
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Highlight> & { id: string }): Promise<Highlight> => {
      const { id, ...rest } = patch;
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (rest.kind !== undefined) dbPatch.kind = rest.kind;
      if (rest.color !== undefined) dbPatch.color = rest.color;
      if (rest.type !== undefined) dbPatch.type = rest.type;
      if (rest.note !== undefined) dbPatch.note = rest.note;
      const { data, error } = await supabase.from('question_highlights')
        .update(dbPatch).eq('id', id).select().single();
      if (error) throw error;
      return toHighlight(data as Row);
    },
    onSuccess: (h) => qc.setQueryData<Highlight[]>(queryKey, (prev = []) =>
      prev.map(x => x.id === h.id ? h : x)),
  });

  const remove = useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { error } = await supabase.from('question_highlights').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => qc.setQueryData<Highlight[]>(queryKey, (prev = []) =>
      prev.filter(x => x.id !== id)),
  });

  return {
    highlights: query.data ?? [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
  };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` (ou `npm run lint`)
Expected: sem erros no arquivo novo.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQuestionHighlights.ts
git commit -m "feat(marcacoes): hook useQuestionHighlights (CRUD React Query)"
```

### Task 5: `useHighlightsAll` (Caderno) + contagem

**Files:**
- Create: `src/hooks/useHighlightsAll.ts`

- [ ] **Step 1: Implementar**

```typescript
// src/hooks/useHighlightsAll.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Highlight, MarkTypeId } from '@/components/questoes/highlights/types';

type Row = Parameters<typeof Object>[0] & Record<string, unknown>;

function toHighlight(r: any): Highlight {
  return {
    id: r.id, questionId: r.question_id, target: r.target, kind: r.kind, color: r.color,
    type: r.type, quote: r.quote, prefix: r.prefix, suffix: r.suffix, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function useHighlightsAll(opts: { type?: MarkTypeId | 'all'; search?: string } = {}) {
  const { type = 'all', search = '' } = opts;
  return useQuery({
    queryKey: ['highlights-all', type, search],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Highlight[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase.from('question_highlights').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false });
      if (type !== 'all') q = q.eq('type', type);
      if (search.trim()) q = q.or(`quote.ilike.%${search}%,note.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]).map(toHighlight);
    },
  });
}

export function useHighlightsCount() {
  return useQuery({
    queryKey: ['highlights-count'],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await supabase.from('question_highlights')
        .select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/hooks/useHighlightsAll.ts
git commit -m "feat(marcacoes): hooks do Caderno (lista global + contagem)"
```

---

## Fase 5 — Popovers (TDD, como os testes de `filtros/`)

### Task 6: `TriangleIcon`

**Files:**
- Create: `src/components/questoes/highlights/TriangleIcon.tsx`

- [ ] **Step 1: Implementar (triângulo cheio + "!" branco, pega a cor via prop)**

```tsx
// src/components/questoes/highlights/TriangleIcon.tsx
import React from 'react';

export function TriangleIcon({ color, size = 13, className }: { color: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ color, display: 'block' }} aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" fill="currentColor" />
      <path d="M12 9.1v3.9" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.7" r="1.05" fill="#fff" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/questoes/highlights/TriangleIcon.tsx
git commit -m "feat(marcacoes): TriangleIcon (cheio + ! branco, cor via prop)"
```

### Task 7: `SelectionToolbar` (toggle + paleta)

**Files:**
- Create: `src/components/questoes/highlights/SelectionToolbar.tsx`
- Test: `src/components/questoes/highlights/__tests__/SelectionToolbar.test.tsx`

- [ ] **Step 1: Escrever o teste (falha)**

```tsx
// src/components/questoes/highlights/__tests__/SelectionToolbar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar } from '../SelectionToolbar';

const pos = { left: 100, top: 100 };

describe('SelectionToolbar', () => {
  it('começa em Atenção e troca para Grifo comum', () => {
    render(<SelectionToolbar position={pos} onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /Atenção/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Grifo comum/ }));
    expect(screen.getByRole('button', { name: /Grifo comum/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar numa cor chama onPick(color, kind) com o kind ativo', () => {
    const onPick = vi.fn();
    render(<SelectionToolbar position={pos} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Grifo comum/ }));
    fireEvent.click(screen.getByTestId('swatch-#E0484D'));
    expect(onPick).toHaveBeenCalledWith('#E0484D', 'plain');
  });

  it('respeita defaultKind', () => {
    render(<SelectionToolbar position={pos} onPick={() => {}} defaultKind="plain" />);
    expect(screen.getByRole('button', { name: /Grifo comum/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/SelectionToolbar.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar**

```tsx
// src/components/questoes/highlights/SelectionToolbar.tsx
import React, { useState } from 'react';
import { QUICK_COLORS } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { MarkKind } from './types';

export interface SelectionToolbarProps {
  position: { left: number; top: number };
  onPick: (color: string, kind: MarkKind) => void;
  defaultKind?: MarkKind;
}

export function SelectionToolbar({ position, onPick, defaultKind = 'attention' }: SelectionToolbarProps) {
  const [kind, setKind] = useState<MarkKind>(defaultKind);
  return (
    <div
      className="qh-pop qh-selpop"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="qh-seg" role="group" aria-label="Tipo de marca">
        <button type="button" aria-pressed={kind === 'attention'} className={kind === 'attention' ? 'on' : ''} onClick={() => setKind('attention')}>
          <TriangleIcon color="#E0484D" size={13} /> Atenção
        </button>
        <button type="button" aria-pressed={kind === 'plain'} className={kind === 'plain' ? 'on' : ''} onClick={() => setKind('plain')}>
          Grifo comum
        </button>
      </div>
      <div className="qh-crow">
        {QUICK_COLORS.map((c) => (
          <button key={c} type="button" data-testid={`swatch-${c}`} aria-label={`Cor ${c}`}
            className="qh-dot" style={{ background: c }} onClick={() => onPick(c, kind)} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/SelectionToolbar.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/questoes/highlights/SelectionToolbar.tsx src/components/questoes/highlights/__tests__/SelectionToolbar.test.tsx
git commit -m "feat(marcacoes): SelectionToolbar (toggle Atenção/Comum + paleta)"
```

### Task 8: `HighlightNotePopover` (auto-save)

**Files:**
- Create: `src/components/questoes/highlights/HighlightNotePopover.tsx`
- Test: `src/components/questoes/highlights/__tests__/HighlightNotePopover.test.tsx`

- [ ] **Step 1: Escrever o teste (falha)**

```tsx
// src/components/questoes/highlights/__tests__/HighlightNotePopover.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightNotePopover } from '../HighlightNotePopover';
import type { Highlight } from '../types';

const base: Highlight = {
  id: '1', questionId: 1, target: 'enunciado', kind: 'attention', color: '#E0484D',
  type: 'pegadinha', quote: 'x', prefix: '', suffix: '', note: '', createdAt: '', updatedAt: '',
};
const pos = { left: 10, top: 10 };

describe('HighlightNotePopover', () => {
  it('mostra o tipo atual e troca via dropdown chamando onChange', () => {
    const onChange = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={onChange} onRemove={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Pegadinha/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cuidado' }));
    expect(onChange).toHaveBeenCalledWith({ type: 'cuidado' });
  });

  it('trocar cor chama onChange com a cor', () => {
    const onChange = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={onChange} onRemove={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('note-swatch-#4CAF6E'));
    expect(onChange).toHaveBeenCalledWith({ color: '#4CAF6E' });
  });

  it('auto-save: digitar e disparar onClose salva a nota', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={onChange} onRemove={() => {}} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/Anote/), { target: { value: 'trocaram pode por deve' } });
    fireEvent.blur(screen.getByPlaceholderText(/Anote/));
    expect(onChange).toHaveBeenCalledWith({ note: 'trocaram pode por deve' });
  });

  it('lixeira chama onRemove', () => {
    const onRemove = vi.fn();
    render(<HighlightNotePopover highlight={base} position={pos} onChange={() => {}} onRemove={onRemove} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/HighlightNotePopover.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// src/components/questoes/highlights/HighlightNotePopover.tsx
import React, { useState } from 'react';
import { COLORS, MARK_TYPES, typeLabel } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { Highlight, MarkTypeId } from './types';

export interface HighlightNotePopoverProps {
  highlight: Highlight;
  position: { left: number; top: number };
  onChange: (patch: Partial<Pick<Highlight, 'type' | 'color' | 'note'>>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function HighlightNotePopover({ highlight, position, onChange, onRemove, onClose }: HighlightNotePopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(highlight.note ?? '');

  function commitNote() {
    if (draft.trim() !== (highlight.note ?? '')) onChange({ note: draft.trim() });
  }

  return (
    <div className="qh-pop qh-note" style={{ left: position.left, top: position.top }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="qh-nh">
        <span className="qh-mk"><TriangleIcon color={highlight.color} size={17} /></span>
        <div className={`qh-dd ${open ? 'open' : ''}`}>
          <button type="button" className="qh-ddbtn" onClick={() => setOpen(o => !o)}>
            {typeLabel(highlight.type)} <span className="car">▾</span>
          </button>
          <div className="qh-ddmenu">
            {MARK_TYPES.map(t => (
              <button key={t.id} type="button" onClick={() => { onChange({ type: t.id as MarkTypeId }); setOpen(false); }}>{t.label}</button>
            ))}
          </div>
        </div>
        <button type="button" className="qh-trash" aria-label="Remover" onClick={onRemove}>🗑</button>
      </div>
      <textarea placeholder="Anote o porquê…" value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={commitNote} autoFocus />
      <div className="qh-divln" />
      <div className="qh-crow">
        {COLORS.map(c => (
          <button key={c} type="button" data-testid={`note-swatch-${c}`} aria-label={`Cor ${c}`}
            className={`qh-dot ${c === highlight.color ? 'on' : ''}`} style={{ background: c }}
            onClick={() => onChange({ color: c })} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/HighlightNotePopover.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/questoes/highlights/HighlightNotePopover.tsx src/components/questoes/highlights/__tests__/HighlightNotePopover.test.tsx
git commit -m "feat(marcacoes): HighlightNotePopover (dropdown de tipo + cores + auto-save)"
```

### Task 9: `PlainHighlightMenu`

**Files:**
- Create: `src/components/questoes/highlights/PlainHighlightMenu.tsx`
- Test: `src/components/questoes/highlights/__tests__/PlainHighlightMenu.test.tsx`

- [ ] **Step 1: Escrever o teste (falha)**

```tsx
// src/components/questoes/highlights/__tests__/PlainHighlightMenu.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlainHighlightMenu } from '../PlainHighlightMenu';

const pos = { left: 10, top: 10 };

describe('PlainHighlightMenu', () => {
  it('trocar cor chama onColor', () => {
    const onColor = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" position={pos} onColor={onColor} onPromote={() => {}} onRemove={() => {}} />);
    fireEvent.click(screen.getByTestId('plain-swatch-#8B5CF6'));
    expect(onColor).toHaveBeenCalledWith('#8B5CF6');
  });
  it('"Virar Atenção" chama onPromote', () => {
    const onPromote = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" position={pos} onColor={() => {}} onPromote={onPromote} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Virar Atenção/ }));
    expect(onPromote).toHaveBeenCalled();
  });
  it('"Remover" chama onRemove', () => {
    const onRemove = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" position={pos} onColor={() => {}} onPromote={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/PlainHighlightMenu.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// src/components/questoes/highlights/PlainHighlightMenu.tsx
import React from 'react';
import { COLORS } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';

export interface PlainHighlightMenuProps {
  color: string;
  position: { left: number; top: number };
  onColor: (c: string) => void;
  onPromote: () => void;
  onRemove: () => void;
}

export function PlainHighlightMenu({ color, position, onColor, onPromote, onRemove }: PlainHighlightMenuProps) {
  return (
    <div className="qh-pop qh-plain" style={{ left: position.left, top: position.top }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="qh-crow">
        {COLORS.map(c => (
          <button key={c} type="button" data-testid={`plain-swatch-${c}`} aria-label={`Cor ${c}`}
            className={`qh-dot ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(c)} />
        ))}
      </div>
      <div className="qh-acts">
        <button type="button" className="att" onClick={onPromote}><TriangleIcon color="#E0484D" size={14} /> Virar Atenção</button>
        <button type="button" className="rm" onClick={onRemove}>🗑 Remover</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/questoes/highlights/__tests__/PlainHighlightMenu.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/questoes/highlights/PlainHighlightMenu.tsx src/components/questoes/highlights/__tests__/PlainHighlightMenu.test.tsx
git commit -m "feat(marcacoes): PlainHighlightMenu (cor/promover/remover)"
```

---

## Fase 6 — Renderização (overlay) — verificação no app

### Task 10: `highlight-render` (rects + posição do triângulo)

A lógica de transformar um `Range` em retângulos relativos ao container é pequena, mas
depende de layout — então **verificação no app** (em happy-dom os rects vêm vazios).

**Files:**
- Create: `src/components/questoes/highlights/lib/highlight-render.ts`

- [ ] **Step 1: Implementar**

```typescript
// src/components/questoes/highlights/lib/highlight-render.ts
export interface RelRect { left: number; top: number; width: number; height: number; }

/** Retângulos de um Range relativos ao container (para desenhar o fundo). */
export function rangeRects(range: Range, container: HTMLElement): RelRect[] {
  const base = container.getBoundingClientRect();
  return Array.from(range.getClientRects()).map(r => ({
    left: r.left - base.left,
    top: r.top - base.top,
    width: r.width,
    height: r.height,
  }));
}

/** Posição do triângulo: canto sup-esq do primeiro retângulo. */
export function trianglePos(range: Range, container: HTMLElement): { left: number; top: number } | null {
  const rects = rangeRects(range, container);
  if (!rects.length) return null;
  return { left: rects[0].left, top: rects[0].top };
}

/** Qual marca (índice) contém o ponto do clique — hit-test pelos rects. */
export function hitTest(point: { x: number; y: number }, rectsByIndex: RelRect[][], container: HTMLElement): number {
  const base = container.getBoundingClientRect();
  const x = point.x - base.left;
  const y = point.y - base.top;
  for (let i = 0; i < rectsByIndex.length; i++) {
    for (const r of rectsByIndex[i]) {
      if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) return i;
    }
  }
  return -1;
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/components/questoes/highlights/lib/highlight-render.ts
git commit -m "feat(marcacoes): util de rects/posição do triângulo + hit-test"
```

### Task 11: `HighlightLayer` (overlay que pinta fundos + triângulos)

**Files:**
- Create: `src/components/questoes/highlights/HighlightLayer.tsx`
- Create: `src/components/questoes/highlights/highlights.css`

- [ ] **Step 1: Escrever o CSS dos popovers/overlay**

```css
/* src/components/questoes/highlights/highlights.css */
.qh-host { position: relative; }
.qh-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.qh-host > *:not(.qh-overlay) { position: relative; z-index: 1; }
.qh-bg { position: absolute; border-radius: 3px; }
.qh-tri { position: absolute; transform: translate(-45%, -55%); pointer-events: auto; cursor: pointer;
  filter: drop-shadow(0 0 1.4px #fff) drop-shadow(0 1px 1px rgba(0,0,0,.12)); }

.qh-pop { position: fixed; z-index: 55; background: #fff; border: 1px solid rgba(26,23,20,.07);
  border-radius: 14px; box-shadow: 0 10px 38px -12px rgba(26,23,20,.28), 0 2px 8px -4px rgba(26,23,20,.12);
  animation: qh-rise .16s ease both; }
@keyframes qh-rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.qh-selpop, .qh-plain { padding: 7px; } .qh-note { width: 264px; padding: 5px; }
.qh-seg { display: flex; gap: 3px; background: #F4F2EE; border-radius: 9px; padding: 3px; margin-bottom: 8px; }
.qh-seg button { flex: 1; border: none; background: transparent; font: 700 11.5px/1 inherit; color: #6B6560;
  padding: 6px 12px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.qh-seg button.on { background: #fff; color: #1A1714; box-shadow: 0 1px 2px rgba(26,23,20,.06); }
.qh-crow { display: flex; flex-wrap: wrap; gap: 7px; padding: 1px 3px 3px; }
.qh-dot { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(26,23,20,.1); transition: transform .12s; }
.qh-dot:hover { transform: scale(1.18); } .qh-dot.on { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #1A1714; }
.qh-nh { display: flex; align-items: center; gap: 9px; padding: 8px 8px 6px; }
.qh-mk { width: 17px; height: 17px; flex: none; }
.qh-dd { position: relative; flex: 1; }
.qh-ddbtn { display: inline-flex; align-items: center; gap: 6px; font: 700 13.5px/1 inherit; color: #1A1714;
  background: transparent; border: none; padding: 3px 5px; border-radius: 7px; cursor: pointer; }
.qh-ddbtn:hover { background: #F4F2EE; } .qh-ddbtn .car { color: #9C958D; font-size: 9px; }
.qh-ddmenu { position: absolute; top: calc(100% + 4px); left: 0; min-width: 170px; background: #fff;
  border: 1px solid rgba(26,23,20,.07); border-radius: 11px; box-shadow: 0 10px 38px -12px rgba(26,23,20,.28);
  padding: 5px; display: none; z-index: 5; }
.qh-dd.open .qh-ddmenu { display: block; }
.qh-ddmenu button { width: 100%; text-align: left; border: none; background: transparent; font: 500 13px/1 inherit;
  color: #2c2824; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.qh-ddmenu button:hover { background: #F4F2EE; }
.qh-trash { flex: none; border: none; background: transparent; color: #9C958D; cursor: pointer; padding: 5px;
  border-radius: 7px; }
.qh-trash:hover { color: #C0392B; background: #FBEFED; }
.qh-note textarea { width: 100%; resize: none; font: 400 13px/1.55 inherit; color: #1A1714; background: transparent;
  border: none; padding: 2px 10px 8px; min-height: 46px; }
.qh-note textarea:focus { outline: none; }
.qh-divln { height: 1px; background: #ECEAE5; margin: 2px 8px; }
.qh-acts { display: flex; gap: 4px; border-top: 1px solid #ECEAE5; padding-top: 7px; margin-top: 2px; }
.qh-acts button { flex: 1; border: none; background: transparent; font: 600 12px/1 inherit; color: #6B6560;
  padding: 7px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.qh-acts button:hover { background: #F4F2EE; color: #1A1714; }
.qh-acts .rm:hover { color: #C0392B; background: #FBEFED; }
```

- [ ] **Step 2: Implementar o layer**

```tsx
// src/components/questoes/highlights/HighlightLayer.tsx
import React, { useLayoutEffect, useRef, useState } from 'react';
import { resolveAnchor } from './lib/highlight-anchor';
import { rangeRects, trianglePos, type RelRect } from './lib/highlight-render';
import { bgFor } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { Highlight } from './types';

interface Resolved { hl: Highlight; rects: RelRect[]; tri: { left: number; top: number } | null; }

export function HighlightLayer({
  blockRef, highlights, onClickHighlight,
}: {
  blockRef: React.RefObject<HTMLElement>;
  highlights: Highlight[];
  onClickHighlight: (hl: Highlight, anchorEl: { left: number; top: number }) => void;
}) {
  const [resolved, setResolved] = useState<Resolved[]>([]);
  const raf = useRef<number>(0);

  useLayoutEffect(() => {
    const block = blockRef.current;
    if (!block) return;

    const recompute = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const next: Resolved[] = [];
        for (const hl of highlights) {
          const range = resolveAnchor(block, { quote: hl.quote, prefix: hl.prefix, suffix: hl.suffix });
          if (!range) continue;
          next.push({ hl, rects: rangeRects(range, block), tri: hl.kind === 'attention' ? trianglePos(range, block) : null });
        }
        setResolved(next);
      });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(block);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); cancelAnimationFrame(raf.current); };
  }, [blockRef, highlights]);

  return (
    <div className="qh-overlay" aria-hidden>
      {resolved.map(({ hl, rects, tri }) => (
        <React.Fragment key={hl.id}>
          {rects.map((r, i) => (
            <span key={i} className="qh-bg" style={{
              left: r.left - 2, top: r.top, width: r.width + 4, height: r.height,
              background: bgFor(hl.color, hl.kind),
            }} />
          ))}
          {tri && (
            <span className="qh-tri" style={{ left: tri.left, top: tri.top }}
              onClick={() => onClickHighlight(hl, tri)}>
              <TriangleIcon color={hl.color} size={13} />
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verificar no app (manual)**

Run: `npm run dev` → abrir uma questão. (Esta etapa só renderiza quando o card montar o layer — concluída de fato na Task 12.) Por ora, garantir que compila:
Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/highlights/HighlightLayer.tsx src/components/questoes/highlights/highlights.css
git commit -m "feat(marcacoes): HighlightLayer (overlay de fundos + triângulos)"
```

---

## Fase 7 — Integração no QuestionCard

### Task 12: Fiar marcação no card

**Files:**
- Modify: `src/components/QuestionCard.tsx`

Referências do arquivo atual: imports de `lisere`/`TextHighlighter` (linhas ~5-6), `HighlightMode`/`HIGHLIGHT_STYLES` (~154-159), estado `highlightMode` (~407), botões Highlighter/Strikethrough no header (~808-832), `<TextHighlighter>` no corpo (~842-853) e nas alternativas (~915-927).

- [ ] **Step 1: Remover o sistema antigo (lisere)**

Apague no `QuestionCard.tsx`:
- `import { TextHighlighter } from 'lisere';` e `import 'lisere/dist/style.css';`
- `type HighlightMode`, `HIGHLIGHT_STYLES`, `const [highlightMode, setHighlightMode] = useState(...)`.
- Os dois botões de Highlighter/Strikethrough no header.
- Os dois wrappers `<TextHighlighter>` (corpo + alternativa) — deixe só o `<div ... dangerouslySetInnerHTML />`.

- [ ] **Step 2: Adicionar refs + data-attrs nos blocos markable**

No corpo do enunciado, troque o `<div ... dangerouslySetInnerHTML={sanitizedQuestion} />` por um container com host:

```tsx
// imports novos no topo
import { HighlightLayer } from '@/components/questoes/highlights/HighlightLayer';
import { SelectionToolbar } from '@/components/questoes/highlights/SelectionToolbar';
import { HighlightNotePopover } from '@/components/questoes/highlights/HighlightNotePopover';
import { PlainHighlightMenu } from '@/components/questoes/highlights/PlainHighlightMenu';
import { useQuestionHighlights } from '@/hooks/useQuestionHighlights';
import { createAnchor } from '@/components/questoes/highlights/lib/highlight-anchor';
import { hitTest } from '@/components/questoes/highlights/lib/highlight-render';
import '@/components/questoes/highlights/highlights.css';
```

- [ ] **Step 3: Estado e handlers de marcação dentro do componente**

```tsx
const { highlights, create, update, remove } = useQuestionHighlights(questaoId);

type PopState =
  | { kind: 'sel'; left: number; top: number; range: Range; target: string; block: HTMLElement }
  | { kind: 'note' | 'plain'; left: number; top: number; id: string }
  | null;
const [pop, setPop] = useState<PopState>(null);
const lastKind = useRef<'attention' | 'plain'>('attention');

// chamada no onMouseUp de cada bloco markable
const handleSelect = useCallback((block: HTMLElement, target: string) => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
  const range = sel.getRangeAt(0);
  if (!block.contains(range.commonAncestorContainer)) return;
  const r = range.getBoundingClientRect();
  setPop({ kind: 'sel', left: r.left + r.width / 2, top: r.top - 8, range: range.cloneRange(), target, block });
}, []);

const onPick = useCallback(async (color: string, kind: 'attention' | 'plain') => {
  if (!pop || pop.kind !== 'sel') return;
  lastKind.current = kind;
  const anchor = createAnchor(pop.block, pop.range);
  const created = await create({
    questionId: questaoId, target: pop.target, kind, color,
    type: kind === 'attention' ? 'pegadinha' : null,
    quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix, note: null,
  });
  window.getSelection()?.removeAllRanges();
  if (kind === 'attention') setPop({ kind: 'note', left: pop.left, top: pop.top + 24, id: created.id });
  else setPop(null);
}, [pop, create, questaoId]);

const onClickHighlight = useCallback((hl, at: { left: number; top: number }) => {
  setPop({ kind: hl.kind === 'attention' ? 'note' : 'plain', left: at.left, top: at.top + 20, id: hl.id });
}, []);
```

- [ ] **Step 4: Render — envolver enunciado e cada alternativa**

Padrão para o enunciado (repita análogo para cada alternativa, com `target={'alt:'+alt.letter}`):

```tsx
const enunRef = useRef<HTMLDivElement>(null);
// ...
<div className="qh-host" ref={enunRef}
     onMouseUp={() => enunRef.current && handleSelect(enunRef.current, 'enunciado')}>
  <div className="prose ..." style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--qc-ink)' }}
       dangerouslySetInnerHTML={sanitizedQuestion} />
  <HighlightLayer
    blockRef={enunRef}
    highlights={highlights.filter(h => h.target === 'enunciado')}
    onClickHighlight={onClickHighlight}
  />
</div>
```

- [ ] **Step 5: Render dos popovers (fora dos blocos, posição fixed)**

```tsx
{pop?.kind === 'sel' && (
  <SelectionToolbar position={{ left: pop.left, top: pop.top }} defaultKind={lastKind.current} onPick={onPick} />
)}
{pop?.kind === 'note' && (() => {
  const hl = highlights.find(h => h.id === pop.id); if (!hl) return null;
  return <HighlightNotePopover highlight={hl} position={{ left: pop.left, top: pop.top }}
    onChange={(patch) => update({ id: hl.id, ...patch })}
    onRemove={() => { remove(hl.id); setPop(null); }}
    onClose={() => setPop(null)} />;
})()}
{pop?.kind === 'plain' && (() => {
  const hl = highlights.find(h => h.id === pop.id); if (!hl) return null;
  return <PlainHighlightMenu color={hl.color} position={{ left: pop.left, top: pop.top }}
    onColor={(c) => update({ id: hl.id, color: c })}
    onPromote={() => { update({ id: hl.id, kind: 'attention', type: 'pegadinha' }); setPop(p => p && { ...p, kind: 'note' }); }}
    onRemove={() => { remove(hl.id); setPop(null); }} />;
})()}
```

- [ ] **Step 6: Fechar popover ao clicar fora**

```tsx
useEffect(() => {
  if (!pop) return;
  const onDown = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.qh-pop') || t.closest('.qh-tri')) return;
    setPop(null);
  };
  document.addEventListener('mousedown', onDown);
  return () => document.removeEventListener('mousedown', onDown);
}, [pop]);
```

- [ ] **Step 7: Rodar testes do card + lint**

Run: `npx vitest run src/components/questoes` then `npm run lint`
Expected: testes existentes do card/filtros continuam passando; lint sem erros novos.

- [ ] **Step 8: Verificação no app (manual)**

Run: `npm run dev` → questão real. Verifique:
- Selecionar trecho → toolbar (Atenção/Comum + cores).
- Atenção+cor → triângulo na cor + nota abre; digitar e clicar fora salva.
- Comum+cor → só cor, sem ícone; clicar → mini-menu (cor/promover/remover).
- Recarregar a página → as marcas reaparecem nos lugares certos.
- Selecionar trecho com `<sup>`/tabela/KaTeX → não quebra a formatação.

- [ ] **Step 9: Commit**

```bash
git add src/components/QuestionCard.tsx
git commit -m "feat(marcacoes): integra marcação no QuestionCard (remove lisere)"
```

---

## Fase 8 — Caderno

### Task 13: `CadernoDrawer` + item + botão + deep-link

**Files:**
- Create: `src/components/questoes/caderno/CadernoDrawer.tsx`
- Create: `src/components/questoes/caderno/CadernoItem.tsx`
- Test: `src/components/questoes/caderno/__tests__/CadernoItem.test.tsx`
- Modify: `src/views/QuestoesPage.tsx`

- [ ] **Step 1: Teste do item (falha)**

```tsx
// src/components/questoes/caderno/__tests__/CadernoItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CadernoItem } from '../CadernoItem';
import type { Highlight } from '@/components/questoes/highlights/types';

const hl: Highlight = {
  id: '1', questionId: 2071, target: 'alt:B', kind: 'attention', color: '#E0484D',
  type: 'pegadinha', quote: 'sem qualquer limite', prefix: '', suffix: '',
  note: 'decadência 5 anos', createdAt: '', updatedAt: '',
};

describe('CadernoItem', () => {
  it('mostra trecho, nota e o tipo', () => {
    render(<CadernoItem highlight={hl} onOpen={() => {}} />);
    expect(screen.getByText(/sem qualquer limite/)).toBeInTheDocument();
    expect(screen.getByText(/decadência 5 anos/)).toBeInTheDocument();
    expect(screen.getByText(/Pegadinha/)).toBeInTheDocument();
  });
  it('clicar "Revisar" chama onOpen com a marca', () => {
    const onOpen = vi.fn();
    render(<CadernoItem highlight={hl} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Revisar/ }));
    expect(onOpen).toHaveBeenCalledWith(hl);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/questoes/caderno/__tests__/CadernoItem.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar o item**

```tsx
// src/components/questoes/caderno/CadernoItem.tsx
import React from 'react';
import { typeLabel } from '@/components/questoes/highlights/highlights.config';
import { bgFor } from '@/components/questoes/highlights/highlights.config';
import type { Highlight } from '@/components/questoes/highlights/types';

export function CadernoItem({ highlight, onOpen }: { highlight: Highlight; onOpen: (h: Highlight) => void }) {
  return (
    <div className="qh-pc">
      <div className="qh-pc-top" style={{ color: highlight.color }}>
        {highlight.kind === 'attention' ? typeLabel(highlight.type) : 'Grifo'}
      </div>
      <div className="qh-pc-quote">“<mark style={{ background: bgFor(highlight.color, highlight.kind) }}>{highlight.quote}</mark>”</div>
      {highlight.note && <div className="qh-pc-note">{highlight.note}</div>}
      <div className="qh-pc-foot">
        <span>Q{highlight.questionId}</span>
        <button type="button" onClick={() => onOpen(highlight)}>Revisar →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/questoes/caderno/__tests__/CadernoItem.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Implementar o drawer**

```tsx
// src/components/questoes/caderno/CadernoDrawer.tsx
import React, { useState } from 'react';
import { useHighlightsAll } from '@/hooks/useHighlightsAll';
import { MARK_TYPES } from '@/components/questoes/highlights/highlights.config';
import type { MarkTypeId, Highlight } from '@/components/questoes/highlights/types';
import { CadernoItem } from './CadernoItem';

export function CadernoDrawer({ open, onClose, onOpenHighlight }: {
  open: boolean; onClose: () => void; onOpenHighlight: (h: Highlight) => void;
}) {
  const [type, setType] = useState<MarkTypeId | 'all'>('all');
  const [search, setSearch] = useState('');
  const { data: items = [] } = useHighlightsAll({ type, search });

  return (
    <>
      <div className={`qh-scrim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`qh-drawer ${open ? 'open' : ''}`}>
        <div className="qh-dh">
          <div className="qh-dh-title"><h2>Meu Caderno</h2><button onClick={onClose} aria-label="Fechar">✕</button></div>
          <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="qh-filters">
          <button className={type === 'all' ? 'on' : ''} onClick={() => setType('all')}>Todos</button>
          {MARK_TYPES.map(t => (
            <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => setType(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="qh-dlist">
          {items.length === 0
            ? <p className="qh-empty">Nenhuma marca ainda.</p>
            : items.map(h => <CadernoItem key={h.id} highlight={h} onOpen={onOpenHighlight} />)}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 6: CSS do Caderno (append em `highlights.css`)**

```css
/* append em src/components/questoes/highlights/highlights.css */
.qh-scrim { position: fixed; inset: 0; background: rgba(26,23,20,.3); opacity: 0; pointer-events: none; transition: .22s; z-index: 60; }
.qh-scrim.open { opacity: 1; pointer-events: auto; }
.qh-drawer { position: fixed; top: 0; right: 0; height: 100%; width: min(420px, 93vw); background: #FBFAF7;
  box-shadow: -18px 0 50px -20px rgba(0,0,0,.35); z-index: 61; transform: translateX(100%);
  transition: transform .28s cubic-bezier(.2,.7,.2,1); display: flex; flex-direction: column; }
.qh-drawer.open { transform: none; }
.qh-dh { padding: 18px 20px 12px; border-bottom: 1px solid #ECEAE5; }
.qh-dh-title { display: flex; align-items: center; } .qh-dh-title h2 { margin: 0; font-size: 16px; font-weight: 700; }
.qh-dh-title button { margin-left: auto; border: none; background: transparent; font-size: 18px; color: #9C958D; cursor: pointer; }
.qh-dh input { width: 100%; margin-top: 11px; font: 400 12.5px/1 inherit; border: 1px solid #E0DDD6; border-radius: 9px; padding: 8px 11px; }
.qh-filters { display: flex; gap: 6px; padding: 10px 18px; flex-wrap: wrap; border-bottom: 1px solid #ECEAE5; }
.qh-filters button { font: 600 11.5px/1 inherit; border: 1px solid #E0DDD6; background: #fff; border-radius: 999px; padding: 5px 10px; cursor: pointer; color: #6B6560; }
.qh-filters button.on { border-color: #1A1714; color: #1A1714; }
.qh-dlist { flex: 1; overflow-y: auto; padding: 12px 14px 40px; display: flex; flex-direction: column; gap: 10px; }
.qh-pc { background: #fff; border: 1px solid #E0DDD6; border-radius: 13px; padding: 12px 13px; }
.qh-pc-top { font: 700 9.5px/1 inherit; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 7px; }
.qh-pc-quote { font-family: 'Fraunces', Georgia, serif; font-size: 13.5px; line-height: 1.45; padding: 1px 0 7px; }
.qh-pc-quote mark { padding: 1px 3px; border-radius: 3px; }
.qh-pc-note { font-size: 12px; line-height: 1.5; color: #4a443e; background: #FBFAF7; border-left: 2px solid #E0DDD6; padding: 5px 9px; border-radius: 0 7px 7px 0; margin-bottom: 8px; }
.qh-pc-foot { font-size: 11px; color: #9C958D; display: flex; align-items: center; }
.qh-pc-foot button { margin-left: auto; border: none; background: transparent; color: #0F7B5F; font-weight: 600; cursor: pointer; }
.qh-empty { text-align: center; color: #9C958D; font-size: 12.5px; padding: 30px; }
```

- [ ] **Step 7: Botão + drawer + deep-link na página**

Em `src/views/QuestoesPage.tsx`: importar `CadernoDrawer` e `useHighlightsCount`, adicionar estado `const [cadernoOpen, setCadernoOpen] = useState(false)`, um botão "Meu Caderno" (com `TriangleIcon` + badge da contagem) no cabeçalho da página, e:

```tsx
<CadernoDrawer
  open={cadernoOpen}
  onClose={() => setCadernoOpen(false)}
  onOpenHighlight={(h) => {
    setCadernoOpen(false);
    // deep-link: navega/rola até a questão e foca a marca
    window.location.hash = `hl=${h.id}`;
    document.querySelector(`[data-question-id="${h.questionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }}
/>
```

(Garantir que o `<article>` do `QuestionCard` exponha `data-question-id={questaoId}` — adicionar esse atributo na Task 12, Step 4.)

- [ ] **Step 8: Rodar testes + lint + app**

Run: `npx vitest run src/components/questoes/caderno` then `npm run lint`
Expected: PASS; lint ok.
Run app: abrir Caderno pelo botão → ver as marcas, filtrar por tipo, buscar, "Revisar" rola até a questão.

- [ ] **Step 9: Commit**

```bash
git add src/components/questoes/caderno src/components/questoes/highlights/highlights.css src/views/QuestoesPage.tsx
git commit -m "feat(marcacoes): Caderno (drawer, filtros, busca, deep-link)"
```

---

## Fase 9 — Mobile

### Task 14: Popovers como bottom sheet no mobile

**Files:**
- Modify: `src/components/questoes/highlights/SelectionToolbar.tsx`, `HighlightNotePopover.tsx`, `PlainHighlightMenu.tsx`

- [ ] **Step 1: Detectar mobile e renderizar como sheet**

Usar `useIsMobile` (já existe no projeto, citado na memória da UX mobile). Quando mobile, em vez de `position: fixed` ancorado, renderizar o conteúdo dentro do `MobileSheet` (bottom sheet existente). Manter os mesmos callbacks/props — só muda o container.

```tsx
// padrão dentro de cada popover:
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileSheet } from '@/components/questoes/MobileSheet'; // confirmar caminho real
// ...
const isMobile = useIsMobile();
if (isMobile) return <MobileSheet open onClose={onClose ?? (() => {})}>{inner}</MobileSheet>;
return <div className="qh-pop ..." style={{ left, top }}>{inner}</div>;
```

(Confirmar o caminho/props reais de `useIsMobile` e `MobileSheet` antes — grep no repo.)

- [ ] **Step 2: Verificação no app (mobile)**

Run: `npm run dev` → DevTools responsive (375px). Selecionar trecho → sheet sobe; criar/anotar/remover funcionam; teclado não cobre o textarea.

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/highlights
git commit -m "feat(marcacoes): popovers viram bottom sheet no mobile"
```

---

## Self-review (cobertura do spec)

- Grifo comum (só cor) → Task 12 (onPick kind=plain) + PlainHighlightMenu (Task 9). ✅
- Atenção (cor + △ + tipo + nota) → Tasks 8, 10, 11, 12. ✅
- Toggle no popover de seleção → Task 7. ✅
- Triângulo cheio + ! branco, na cor → Task 6. ✅
- Sem sublinhado → não há regra de sublinhado no CSS (Task 11). ✅
- Auto-save da nota → Task 8 (commitNote no blur/close). ✅
- Promover comum→atenção → Task 9 + Task 12 (onPromote). ✅
- Cor livre da paleta → Tasks 1, 7, 8. ✅
- Ancoragem quote+contexto → Task 2; usada em 11/12. ✅
- Sem mutar DOM (overlay) → Tasks 10, 11. ✅
- Tabela + RLS + índices → Task 3. ✅
- Caderno (filtro/busca/deep-link) → Task 13. ✅
- Mobile sheet → Task 14. ✅
- Remover `lisere` → Task 12 Step 1. ✅
- Portas FSRS/social → schema (Task 3) carrega quote/type/target. ✅

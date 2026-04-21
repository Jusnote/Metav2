# Questões · Objetivo (Fase 1) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a UI completa da seção OBJETIVO na página de questões + painel admin mínimo para upload de fotos. Foco ativa/desativa visualmente; sem integração com queries de questões (essa é a Fase 2).

**Architecture:** Componentes visuais novos em `src/components/questoes/objetivo/`, hooks de estado em `src/hooks/`, página admin sob React Router em `/moderacao/objetivos` seguindo o padrão existente de `EditaisModerationPage`. Tabela `carreiras` enxuta (sem FK `cargos.carreira_id` — fica pra Fase 2), bucket de imagens `carreira-images` no Supabase Storage.

**Tech Stack:** React 19, Tailwind CSS v4, shadcn/ui, @tanstack/react-query, Supabase (Postgres + Storage), React Router DOM, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-20-questoes-objetivo-design.md`

**Testing note:** O projeto não tem test runner configurado (nada em `package.json scripts`). Cada task usa verificação manual via `npm run dev` — o desenvolvedor abre a URL relevante, checa comportamento visual e DevTools. TDD estrito não se aplica neste projeto.

---

## File Structure

### Novos

```
supabase/migrations/20260420120000_carreiras_objetivo.sql
src/types/carreira.ts
src/hooks/useCarreiras.ts
src/hooks/useFocoObjetivo.ts
src/components/questoes/objetivo/
  ├─ ObjetivoSection.tsx          (container)
  ├─ ObjetivoHeader.tsx           (label + limpar + busca)
  ├─ AreaTabs.tsx                 (tabs de área)
  ├─ CarreiraCarousel.tsx         (scroll horizontal + seta)
  ├─ CarreiraCard.tsx             (card individual — 112×112)
  └─ SemanticScopeToggle.tsx      (toggle visual, sem lógica real)
src/components/moderation/objetivos/
  ├─ ObjetivosModerationPage.tsx  (página admin)
  ├─ ObjetivoTable.tsx            (listagem)
  ├─ ObjetivoDrawer.tsx           (create/edit)
  ├─ ObjetivoFotoUpload.tsx       (drop-zone + resize)
  └─ useCarreirasAdmin.ts         (CRUD hook)
```

### Modificados

```
src/views/QuestoesPage.tsx                       (refinar header + render ObjetivoSection + SemanticScopeToggle)
src/components/moderation/layout/ModerationSidebar.tsx  (adicionar entrada "Objetivos")
src/App.tsx                                      (registrar rota /moderacao/objetivos)
src/types/database.ts                            (regenerar pelo script do Supabase OU inserir tipo manualmente)
```

---

## Task 1: Migração — tabela `carreiras` + bucket

**Files:**
- Create: `supabase/migrations/20260420120000_carreiras_objetivo.sql`

- [ ] **Step 1: Criar arquivo de migração**

```sql
-- 20260420120000_carreiras_objetivo.sql
-- Fase 1 de "OBJETIVO na página de questões": tabela mínima + bucket de fotos.

-- ============================================================================
-- Tabela carreiras
-- ============================================================================

create table if not exists public.carreiras (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in (
    'policial','fiscal','juridica','tribunais','saude',
    'controle','legislativo','bancaria','militar'
  )),
  nome text not null,
  slug text not null unique,
  foto_url text,
  ordem int not null default 0,
  ativa boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_carreiras_area_ordem
  on public.carreiras(area, ordem)
  where ativa = true;

-- updated_at trigger (segue padrão do projeto)
create trigger carreiras_set_updated_at
  before update on public.carreiras
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.carreiras enable row level security;

-- Qualquer usuário autenticado lê carreiras ativas.
-- Admin/moderator lê todas (pra gerenciar inativas também).
create policy carreiras_select_active on public.carreiras
  for select
  using (
    ativa = true
    or public.get_user_role() in ('admin','moderator')
  );

-- Escrita: só admin e moderator.
create policy carreiras_write_admin on public.carreiras
  for all
  to authenticated
  using (public.get_user_role() in ('admin','moderator'))
  with check (public.get_user_role() in ('admin','moderator'));

-- ============================================================================
-- Storage bucket carreira-images
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('carreira-images', 'carreira-images', true)
on conflict (id) do nothing;

-- Leitura pública
create policy carreira_images_public_read on storage.objects
  for select
  using (bucket_id = 'carreira-images');

-- Upload/update/delete: só admin/moderator
create policy carreira_images_admin_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'carreira-images'
    and public.get_user_role() in ('admin','moderator')
  );

create policy carreira_images_admin_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'carreira-images'
    and public.get_user_role() in ('admin','moderator')
  );

create policy carreira_images_admin_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'carreira-images'
    and public.get_user_role() in ('admin','moderator')
  );
```

- [ ] **Step 2: Verificar função `set_updated_at` e `get_user_role` existentes**

A migração assume duas funções já existentes no projeto (usadas em outras migrações):
- `public.set_updated_at()` — trigger function que atualiza `updated_at`
- `public.get_user_role()` — retorna role do usuário corrente ('admin' | 'moderator' | 'teacher' | 'user')

Verifique se existem:

```bash
grep -r "create or replace function public.set_updated_at" supabase/migrations/
grep -r "create or replace function public.get_user_role" supabase/migrations/
```

Se alguma não existir, adicione-a no topo da migração antes dos `create table`. Padrão esperado de `set_updated_at`:
```sql
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
```

- [ ] **Step 3: Aplicar migração local**

Se `supabase` CLI estiver configurado:
```bash
supabase db push
```

Senão, aplicar manualmente via SQL editor do dashboard Supabase (colar o conteúdo do `.sql`).

- [ ] **Step 4: Verificar migração aplicada**

No SQL editor do Supabase, rodar:
```sql
select count(*) from public.carreiras;             -- deve retornar 0
select id from storage.buckets where id = 'carreira-images'; -- deve retornar 1 linha
```

- [ ] **Step 5: Regenerar tipos do Supabase**

```bash
npx supabase gen types typescript --project-id xmtleqquivcukwgdexhc > src/types/database.ts
```

(Project ref `xmtleqquivcukwgdexhc` está na memória.) Confirmar que a tabela `carreiras` e suas colunas aparecem em `src/types/database.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260420120000_carreiras_objetivo.sql src/types/database.ts
git commit -m "feat(objetivo): migração para tabela carreiras + bucket carreira-images"
```

---

## Task 2: Types + constantes de área

**Files:**
- Create: `src/types/carreira.ts`

- [ ] **Step 1: Criar tipos e constantes**

```typescript
// src/types/carreira.ts

export const AREAS = [
  'policial',
  'fiscal',
  'juridica',
  'tribunais',
  'saude',
  'controle',
  'legislativo',
  'bancaria',
  'militar',
] as const;

export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  policial: 'Policial',
  fiscal: 'Fiscal',
  juridica: 'Jurídica',
  tribunais: 'Tribunais',
  saude: 'Saúde',
  controle: 'Controle',
  legislativo: 'Legislativo',
  bancaria: 'Bancária',
  militar: 'Militar',
};

export interface Carreira {
  id: string;
  area: Area;
  nome: string;
  slug: string;
  foto_url: string | null;
  ordem: number;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarreiraInput {
  area: Area;
  nome: string;
  slug: string;
  foto_url?: string | null;
  ordem?: number;
  ativa?: boolean;
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados ao novo arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/types/carreira.ts
git commit -m "feat(objetivo): tipos de Carreira e enum de áreas"
```

---

## Task 3: Hook `useCarreiras` (read-only)

**Files:**
- Create: `src/hooks/useCarreiras.ts`

- [ ] **Step 1: Criar hook**

```typescript
// src/hooks/useCarreiras.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Area, Carreira } from '@/types/carreira';

/**
 * Lista carreiras ativas. Opcionalmente filtra por área.
 * Ordenado por `ordem` ASC.
 */
export function useCarreiras(area?: Area) {
  return useQuery({
    queryKey: ['carreiras', 'ativas', area ?? 'todas'],
    queryFn: async () => {
      let q = supabase
        .from('carreiras')
        .select('*')
        .eq('ativa', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true });

      if (area) q = q.eq('area', area);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Carreira[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Conta carreiras ativas por área. Usado nas tabs de área.
 */
export function useAreaCounts() {
  return useQuery({
    queryKey: ['carreiras', 'area-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreiras')
        .select('area')
        .eq('ativa', true);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.area] = (counts[row.area] ?? 0) + 1;
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCarreiras.ts
git commit -m "feat(objetivo): hook useCarreiras para fetch read-only de carreiras ativas"
```

---

## Task 4: Hook `useFocoObjetivo` (estado local)

**Files:**
- Create: `src/hooks/useFocoObjetivo.ts`

- [ ] **Step 1: Criar hook**

```typescript
// src/hooks/useFocoObjetivo.ts
'use client';

import { useCallback, useState } from 'react';

const MAX_FOCOS = 3;

/**
 * Estado dos focos ativos. Até 3 carreiras simultâneas; o 4º clique
 * desativa o foco mais antigo (FIFO) e ativa o novo.
 *
 * Fase 1: estado em memória apenas (não persiste). A lista abre sempre
 * vazia (card `TODAS` selecionado).
 */
export function useFocoObjetivo() {
  const [focos, setFocos] = useState<string[]>([]);

  const toggleFoco = useCallback((carreiraId: string) => {
    setFocos((prev) => {
      if (prev.includes(carreiraId)) {
        return prev.filter((id) => id !== carreiraId);
      }
      if (prev.length >= MAX_FOCOS) {
        // FIFO: remove o mais antigo (primeiro da lista), adiciona o novo no fim
        return [...prev.slice(1), carreiraId];
      }
      return [...prev, carreiraId];
    });
  }, []);

  const clearFocos = useCallback(() => setFocos([]), []);

  const isActive = useCallback(
    (carreiraId: string) => focos.includes(carreiraId),
    [focos],
  );

  return {
    focos,
    toggleFoco,
    clearFocos,
    isActive,
    hasAnyFoco: focos.length > 0,
  };
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFocoObjetivo.ts
git commit -m "feat(objetivo): hook useFocoObjetivo com limite de 3 focos simultâneos e FIFO"
```

---

## Task 5: Componente `CarreiraCard`

**Files:**
- Create: `src/components/questoes/objetivo/CarreiraCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/questoes/objetivo/CarreiraCard.tsx
'use client';

import { Check, ListChecks } from 'lucide-react';
import type { Carreira } from '@/types/carreira';

interface CarreiraCardProps {
  carreira: Carreira;
  active: boolean;
  onToggle: () => void;
}

/**
 * Card de uma carreira no carrossel. Foto full-bleed + overlay escuro +
 * nome uppercase branco na faixa inferior. Estado ativo: borda azul + ✓.
 */
export function CarreiraCard({ carreira, active, onToggle }: CarreiraCardProps) {
  const hasFoto = Boolean(carreira.foto_url);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'relative flex-shrink-0 w-[112px] h-[112px] rounded-[10px] overflow-hidden',
        'cursor-pointer transition-all duration-200 ease-out',
        'shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(15,23,42,0.15)]',
        'border-2',
        active
          ? 'border-[#1e3a8a] shadow-[0_0_0_3px_rgba(30,58,138,0.1)]'
          : 'border-transparent',
      ].join(' ')}
      aria-pressed={active}
      aria-label={`Foco: ${carreira.nome}`}
    >
      {/* Foto ou fallback */}
      {hasFoto ? (
        <img
          src={carreira.foto_url!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <FallbackBackground nome={carreira.nome} />
      )}

      {/* Overlay escuro pra legibilidade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.1) 40%, rgba(15,23,42,0.88) 100%)',
        }}
      />

      {/* Badge ✓ ativo */}
      {active && (
        <span className="absolute top-[6px] right-[6px] inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <Check className="h-[10px] w-[10px]" strokeWidth={3} />
        </span>
      )}

      {/* Nome */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-[6px] pt-[6px] text-white">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.03em] leading-[1.15]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {carreira.nome}
        </div>
      </div>
    </button>
  );
}

/**
 * Card "TODAS" — primeiro do carrossel, neutro.
 * Exportado separadamente pra não precisar de Carreira fake.
 */
export function TodasCard({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex-shrink-0 w-[112px] h-[112px] rounded-[10px] overflow-hidden',
        'flex flex-col items-center justify-center gap-[6px]',
        'cursor-pointer transition-colors',
        'border-[1.5px]',
        active
          ? 'border-[#1e3a8a] bg-[#eff6ff]'
          : 'border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9]',
      ].join(' ')}
      aria-pressed={active}
      aria-label="Todas as carreiras"
    >
      <ListChecks
        className={['h-7 w-7', active ? 'text-[#1e3a8a]' : 'text-[#64748b]'].join(' ')}
        strokeWidth={2}
      />
      <span
        className={[
          'text-[10px] font-bold uppercase tracking-[0.04em]',
          active ? 'text-[#1e3a8a]' : 'text-[#64748b]',
        ].join(' ')}
      >
        Todas
      </span>
    </button>
  );
}

/**
 * Fundo de fallback quando o cargo não tem foto ainda.
 * Gradient neutro + sigla extraída do nome em serifa grande.
 */
function FallbackBackground({ nome }: { nome: string }) {
  // Sigla = primeira parte antes do primeiro separador (·, -, :, espaço)
  const sigla = nome.split(/[·\-:\s]/)[0].toUpperCase().slice(0, 5);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2a4365 100%)',
      }}
    >
      <span
        className="text-white/40 font-serif font-bold"
        style={{ fontSize: '22px', letterSpacing: '0.05em' }}
      >
        {sigla}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/objetivo/CarreiraCard.tsx
git commit -m "feat(objetivo): componente CarreiraCard + TodasCard com fallback por sigla"
```

---

## Task 6: Componente `CarreiraCarousel`

**Files:**
- Create: `src/components/questoes/objetivo/CarreiraCarousel.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/questoes/objetivo/CarreiraCarousel.tsx
'use client';

import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Carreira } from '@/types/carreira';
import { CarreiraCard, TodasCard } from './CarreiraCard';

interface CarreiraCarouselProps {
  carreiras: Carreira[];
  focosAtivos: string[];
  onToggleFoco: (id: string) => void;
  onClearFocos: () => void;
  areaLabel: string;
  loading?: boolean;
}

const SCROLL_STEP = 360; // ~3 cards

/**
 * Carrossel horizontal scrollável de cards de carreira. Primeiro item
 * fixo = card "TODAS". Seta ">" fica FORA do carrossel (não sobrepõe
 * o último card).
 */
export function CarreiraCarousel({
  carreiras,
  focosAtivos,
  onToggleFoco,
  onClearFocos,
  areaLabel,
  loading = false,
}: CarreiraCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAnyFoco = focosAtivos.length > 0;

  const scrollForward = () =>
    scrollRef.current?.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });

  if (loading) {
    return (
      <div className="flex items-stretch gap-[10px]">
        <div className="flex-1 flex gap-[10px] py-[2px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[112px] w-[112px] flex-shrink-0 animate-pulse rounded-[10px] bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-[10px]">
      <div
        ref={scrollRef}
        className="flex-1 min-w-0 flex gap-[10px] overflow-x-auto py-[2px] px-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollBehavior: 'smooth' }}
      >
        <TodasCard active={!hasAnyFoco} onClick={onClearFocos} />

        {carreiras.length === 0 ? (
          <div className="flex items-center px-4 text-xs text-slate-400">
            Nenhuma carreira ativa em {areaLabel} ainda.
          </div>
        ) : (
          carreiras.map((c) => (
            <CarreiraCard
              key={c.id}
              carreira={c}
              active={focosAtivos.includes(c.id)}
              onToggle={() => onToggleFoco(c.id)}
            />
          ))
        )}
      </div>

      {carreiras.length > 0 && (
        <button
          type="button"
          onClick={scrollForward}
          aria-label="Rolar carrossel"
          className="flex-shrink-0 w-8 flex items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1]"
        >
          <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/objetivo/CarreiraCarousel.tsx
git commit -m "feat(objetivo): CarreiraCarousel com seta separada e TodasCard fixo no início"
```

---

## Task 7: Componente `AreaTabs`

**Files:**
- Create: `src/components/questoes/objetivo/AreaTabs.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/questoes/objetivo/AreaTabs.tsx
'use client';

import { AREAS, AREA_LABELS, type Area } from '@/types/carreira';

interface AreaTabsProps {
  value: Area;
  onChange: (area: Area) => void;
  counts: Record<string, number>;
}

/**
 * Tabs de área com underline azul royal no ativo. Contagem em cinza
 * (muda pra azul quando ativo). Scroll horizontal no mobile.
 */
export function AreaTabs({ value, onChange, counts }: AreaTabsProps) {
  return (
    <nav
      aria-label="Áreas de carreira"
      className="flex items-center gap-[3px] border-b border-[#e2e8f0] mb-[14px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {AREAS.map((area) => {
        const active = area === value;
        const count = counts[area] ?? 0;
        return (
          <button
            key={area}
            type="button"
            onClick={() => onChange(area)}
            className={[
              'relative whitespace-nowrap -mb-[1px]',
              'inline-flex items-center gap-[6px]',
              'px-[14px] pl-[12px] py-[10px] text-[12.5px]',
              'border-b-2 bg-transparent',
              'transition-colors',
              active
                ? 'font-semibold text-[#0f172a] border-[#1e3a8a]'
                : 'font-medium text-[#64748b] border-transparent hover:text-[#0f172a]',
            ].join(' ')}
          >
            {AREA_LABELS[area]}
            <span
              className={[
                'text-[10px] font-medium',
                active ? 'text-[#1e3a8a]' : 'text-[#94a3b8]',
              ].join(' ')}
            >
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/objetivo/AreaTabs.tsx
git commit -m "feat(objetivo): AreaTabs com contagem por área e underline ativo"
```

---

## Task 8: Componente `ObjetivoHeader`

**Files:**
- Create: `src/components/questoes/objetivo/ObjetivoHeader.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/questoes/objetivo/ObjetivoHeader.tsx
'use client';

import { Search, Target } from 'lucide-react';

interface ObjetivoHeaderProps {
  filtro: string;
  onFiltroChange: (value: string) => void;
  hasAnyFoco: boolean;
  onClearFocos: () => void;
}

/**
 * Header da seção OBJETIVO: label uppercase à esquerda + botão
 * "Limpar objetivo" (condicional) + campo de busca à direita.
 */
export function ObjetivoHeader({
  filtro,
  onFiltroChange,
  hasAnyFoco,
  onClearFocos,
}: ObjetivoHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
        <Target className="h-[14px] w-[14px] text-[#94a3b8]" strokeWidth={2} />
        Objetivo
      </div>

      <div className="inline-flex items-center gap-[10px]">
        {hasAnyFoco && (
          <button
            type="button"
            onClick={onClearFocos}
            className="rounded-md border border-dashed border-[#cbd5e1] bg-transparent px-[10px] py-[4px] text-[11px] text-[#64748b] transition-colors hover:border-[#64748b] hover:text-[#0f172a]"
          >
            Limpar objetivo
          </button>
        )}

        <div className="inline-flex w-[200px] items-center gap-[6px] rounded-lg border border-[#e2e8f0] bg-white px-[10px] py-[5px]">
          <Search className="h-3 w-3 text-[#94a3b8]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Filtrar carreiras"
            value={filtro}
            onChange={(e) => onFiltroChange(e.target.value)}
            className="flex-1 border-none bg-transparent text-[12px] text-[#334155] outline-none placeholder:text-[#cbd5e1]"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/objetivo/ObjetivoHeader.tsx
git commit -m "feat(objetivo): ObjetivoHeader com label, limpar (condicional) e busca de carreiras"
```

---

## Task 9: Componente container `ObjetivoSection`

**Files:**
- Create: `src/components/questoes/objetivo/ObjetivoSection.tsx`

- [ ] **Step 1: Criar o container**

```tsx
// src/components/questoes/objetivo/ObjetivoSection.tsx
'use client';

import { useMemo, useState } from 'react';
import { useCarreiras, useAreaCounts } from '@/hooks/useCarreiras';
import { useFocoObjetivo } from '@/hooks/useFocoObjetivo';
import { AREA_LABELS, type Area } from '@/types/carreira';
import { ObjetivoHeader } from './ObjetivoHeader';
import { AreaTabs } from './AreaTabs';
import { CarreiraCarousel } from './CarreiraCarousel';

/**
 * Container da seção OBJETIVO. Orquestra:
 *  - estado da área selecionada (UI only)
 *  - filtro por texto (busca "Filtrar carreiras")
 *  - estado de focos ativos (hook useFocoObjetivo)
 *  - fetch das carreiras da área (hook useCarreiras)
 *  - fetch de contagens por área (hook useAreaCounts)
 *
 * Fase 1: os focos NÃO são lidos por nenhum outro lugar — só destacam
 * os cards visualmente. Fase 2 plugará em QuestoesContext / useQuestoesV2.
 */
export function ObjetivoSection() {
  const [area, setArea] = useState<Area>('policial');
  const [filtro, setFiltro] = useState('');

  const { focos, toggleFoco, clearFocos, hasAnyFoco } = useFocoObjetivo();

  const { data: carreiras = [], isLoading } = useCarreiras(area);
  const { data: counts = {} } = useAreaCounts();

  const carreirasFiltradas = useMemo(() => {
    if (!filtro.trim()) return carreiras;
    const q = filtro.trim().toLowerCase();
    return carreiras.filter((c) => c.nome.toLowerCase().includes(q));
  }, [carreiras, filtro]);

  return (
    <section className="mt-5">
      <ObjetivoHeader
        filtro={filtro}
        onFiltroChange={setFiltro}
        hasAnyFoco={hasAnyFoco}
        onClearFocos={clearFocos}
      />

      <AreaTabs value={area} onChange={setArea} counts={counts} />

      <CarreiraCarousel
        carreiras={carreirasFiltradas}
        focosAtivos={focos}
        onToggleFoco={toggleFoco}
        onClearFocos={clearFocos}
        areaLabel={AREA_LABELS[area]}
        loading={isLoading}
      />
    </section>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/objetivo/ObjetivoSection.tsx
git commit -m "feat(objetivo): ObjetivoSection container orquestrando header, tabs e carrossel"
```

---

## Task 10: Componente `SemanticScopeToggle` (visual-only)

**Files:**
- Create: `src/components/questoes/objetivo/SemanticScopeToggle.tsx`

- [ ] **Step 1: Criar componente visual**

```tsx
// src/components/questoes/objetivo/SemanticScopeToggle.tsx
'use client';

/**
 * Toggle "Incluir fora do foco" da aba Filtro semântico.
 *
 * Fase 1: renderiza só a UI do toggle (sem lógica real — contagens mockadas
 * ou ocultas). Aparece quando há foco ativo + query digitada.
 * A Fase 2 conecta com `useQuestoesV2` pra ter as contagens e ampliar
 * o escopo da busca.
 */

interface SemanticScopeToggleProps {
  visible: boolean;       // há foco ativo + query digitada
  incluirFora: boolean;
  onToggle: () => void;
  /** opcional — passado pela Fase 2 quando a lógica de contagem existir */
  countFora?: number;
}

export function SemanticScopeToggle({
  visible,
  incluirFora,
  onToggle,
  countFora,
}: SemanticScopeToggleProps) {
  if (!visible) return null;

  return (
    <div className="mt-2 flex items-center gap-2 px-3">
      {incluirFora ? (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-medium text-[#1e40af] transition-colors hover:bg-[#dbeafe]"
        >
          <span>✓ incluindo fora do foco</span>
          <span className="text-[#64748b]">· remover</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cbd5e1] px-3 py-1 text-[11px] font-medium text-[#64748b] transition-colors hover:border-[#64748b] hover:text-[#0f172a]"
        >
          <span>+</span>
          <span>
            Incluir{typeof countFora === 'number' ? ` ${countFora}` : ''} resultados fora do foco
          </span>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/objetivo/SemanticScopeToggle.tsx
git commit -m "feat(objetivo): SemanticScopeToggle visual (Fase 1 — sem lógica de contagem)"
```

---

## Task 11: Refinar header da `QuestoesPage` + integrar ObjetivoSection

**Files:**
- Modify: `src/views/QuestoesPage.tsx`

- [ ] **Step 1: Ler arquivo atual pra localizar bloco do header**

```bash
sed -n '90,150p' "D:/meta novo/Metav2/src/views/QuestoesPage.tsx"
```

Confirme que você vê:
- `<section className="bg-white mx-4 mt-4 overflow-hidden">` (linha ~95)
- Bloco com `<h1>` e nav de tabs (linhas ~97–122)

- [ ] **Step 2: Substituir bloco do header por versão elegante + inserir ObjetivoSection**

Localize o bloco entre `{/* ─── Filters section (light blue background) ─── */}` e o fechamento antes de `{filterView === 'filtros' && ...`. Substitua o bloco do header (o trecho com `<h1>` e a primeira `<nav>` de modo) pelo seguinte, E adicione `<ObjetivoSection />` logo após o fechamento desse header e antes do `{filterView === 'filtros' && (...)}`:

```tsx
// Em QuestoesPage.tsx — topo do arquivo, adicionar import:
import { ObjetivoSection } from "@/components/questoes/objetivo/ObjetivoSection";
import { SemanticScopeToggle } from "@/components/questoes/objetivo/SemanticScopeToggle";
```

E em seguida, substituir o bloco `<div className="flex items-end gap-4 pt-2 pb-1 border-b border-blue-100/60">...</div>` (título + nav de modo) por:

```tsx
{/* Header refinado: título serifa + tabs segmented control */}
<div className="flex items-center justify-between gap-5 pt-[18px] pb-[14px] border-b border-[#f1f5f9]">
  <h1
    className="m-0 leading-none"
    style={{
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: '26px',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: '#0f172a',
    }}
  >
    Banco de Questões
    <span style={{ color: '#2563eb' }}>.</span>
  </h1>

  <nav
    className="inline-flex items-center gap-[2px] rounded-full bg-[#f1f5f9] p-[3px]"
    aria-label="Modo de filtro"
  >
    {(Object.keys(FILTER_VIEW_LABELS) as FilterView[]).map((view) => {
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
  </nav>
</div>

{/* Seção OBJETIVO — Fase 1: UI só, não afeta query */}
<ObjetivoSection />
```

- [ ] **Step 3: Adicionar `SemanticScopeToggle` na renderização da aba Semântico**

Localize o bloco:

```tsx
{filterView === 'semantico' && (
  <div className="pt-2 pb-2">
    <QuestoesSearchBar />
  </div>
)}
```

E substitua por:

```tsx
{filterView === 'semantico' && (
  <div className="pt-2 pb-2">
    <QuestoesSearchBar />
    {/* Fase 1: visível, mas sem lógica real — Fase 2 fornece countFora e incluirFora */}
    <SemanticScopeToggle
      visible={false}
      incluirFora={false}
      onToggle={() => { /* noop — Fase 2 */ }}
    />
  </div>
)}
```

Obs: `visible={false}` na Fase 1 — o toggle só renderiza quando Fase 2 passar `true` baseado em "há foco ativo + query digitada". Manter o componente montado com `visible` hardcoded facilita validação visual durante o dev (pode trocar pra `true` temporariamente).

- [ ] **Step 4: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verificar visualmente no dev server**

```bash
npm run dev
```

Abra `http://localhost:3000/questoes` (após login). Confirme:
- Título "Banco de Questões." em serifa com ponto azul
- Tabs `Filtros / Filtro semântico / Cadernos` à direita do título como segmented pill control
- Abaixo do header, a seção OBJETIVO com:
  - Label "OBJETIVO" + busca "Filtrar carreiras"
  - Tabs de área (Policial ativa; contagens mostram 0 enquanto não há dados)
  - Carrossel apenas com card "TODAS" (sem carreiras ativas ainda)
- Pills abaixo continuam intactos

- [ ] **Step 6: Commit**

```bash
git add src/views/QuestoesPage.tsx
git commit -m "feat(objetivo): integrar ObjetivoSection + header refinado na QuestoesPage"
```

---

## Task 12: Componente `ObjetivoFotoUpload` (drop-zone + resize)

**Files:**
- Create: `src/components/moderation/objetivos/ObjetivoFotoUpload.tsx`

- [ ] **Step 1: Instalar `browser-image-compression` se não estiver**

Verifique `package.json`:

```bash
grep browser-image-compression "D:/meta novo/Metav2/package.json"
```

Se não existir, instale:

```bash
npm install browser-image-compression
```

- [ ] **Step 2: Criar componente de upload**

```tsx
// src/components/moderation/objetivos/ObjetivoFotoUpload.tsx
'use client';

import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ObjetivoFotoUploadProps {
  slug: string;               // usado como path no bucket
  fotoUrl: string | null;
  onChange: (url: string | null) => void;
}

const MAX_BYTES_ORIGINAL = 5 * 1024 * 1024; // 5MB antes do resize

/**
 * Drop-zone de foto. Recebe imagem, redimensiona client-side pra 400×400,
 * faz upload ao bucket `carreira-images` e retorna a URL pública.
 */
export function ObjetivoFotoUpload({ slug, fotoUrl, onChange }: ObjetivoFotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > MAX_BYTES_ORIGINAL) {
      toast.error('Imagem maior que 5MB. Envie uma menor.');
      return;
    }
    setUploading(true);
    try {
      const resized = await imageCompression(file, {
        maxWidthOrHeight: 400,
        maxSizeMB: 0.3,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const path = `${slug}-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage
        .from('carreira-images')
        .upload(path, resized, { contentType: 'image/webp', upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('carreira-images').getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success('Foto atualizada');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro no upload: ${err.message ?? 'desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        Foto do cargo
      </label>

      {fotoUrl ? (
        <div className="relative inline-block">
          <img
            src={fotoUrl}
            alt=""
            className="h-[120px] w-[120px] rounded-lg object-cover border border-slate-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-500 shadow hover:bg-white"
            aria-label="Remover foto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subindo…
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" /> {fotoUrl ? 'Trocar foto' : 'Enviar foto'}
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-slate-400">
        JPG/PNG/WebP até 5MB. Redimensiona pra 400×400 automaticamente.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/moderation/objetivos/ObjetivoFotoUpload.tsx package.json package-lock.json
git commit -m "feat(objetivo): componente de upload de foto com resize pra 400x400 webp"
```

---

## Task 13: Hook admin `useCarreirasAdmin`

**Files:**
- Create: `src/components/moderation/objetivos/useCarreirasAdmin.ts`

- [ ] **Step 1: Criar hook CRUD**

```typescript
// src/components/moderation/objetivos/useCarreirasAdmin.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Carreira, CarreiraInput } from '@/types/carreira';

export function useCarreirasAll() {
  return useQuery({
    queryKey: ['carreiras', 'admin', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreiras')
        .select('*')
        .order('area', { ascending: true })
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Carreira[];
    },
  });
}

export function useCreateCarreira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CarreiraInput) => {
      const { data, error } = await supabase
        .from('carreiras')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Carreira;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carreiras'] });
      toast.success('Carreira criada');
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateCarreira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CarreiraInput> }) => {
      const { data, error } = await supabase
        .from('carreiras')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Carreira;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carreiras'] });
      toast.success('Carreira atualizada');
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteCarreira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('carreiras').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carreiras'] });
      toast.success('Carreira removida');
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/objetivos/useCarreirasAdmin.ts
git commit -m "feat(objetivo): hooks CRUD admin para carreiras"
```

---

## Task 14: Drawer de edição `ObjetivoDrawer`

**Files:**
- Create: `src/components/moderation/objetivos/ObjetivoDrawer.tsx`

- [ ] **Step 1: Criar drawer seguindo padrão do projeto**

```tsx
// src/components/moderation/objetivos/ObjetivoDrawer.tsx
'use client';

import { useEffect, useState } from 'react';
import { ModerationDrawer } from '@/components/moderation/shared/ModerationDrawer';
import { AREAS, AREA_LABELS, type Area, type Carreira } from '@/types/carreira';
import { ObjetivoFotoUpload } from './ObjetivoFotoUpload';
import { useCreateCarreira, useUpdateCarreira } from './useCarreirasAdmin';

interface ObjetivoDrawerProps {
  open: boolean;
  mode: 'create' | 'edit';
  carreira: Carreira | null;
  onClose: () => void;
}

function slugify(nome: string) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ObjetivoDrawer({ open, mode, carreira, onClose }: ObjetivoDrawerProps) {
  const create = useCreateCarreira();
  const update = useUpdateCarreira();

  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [area, setArea] = useState<Area>('policial');
  const [ordem, setOrdem] = useState(0);
  const [ativa, setAtiva] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && carreira) {
      setNome(carreira.nome);
      setSlug(carreira.slug);
      setArea(carreira.area);
      setOrdem(carreira.ordem);
      setAtiva(carreira.ativa);
      setFotoUrl(carreira.foto_url);
      setSlugTouched(true);
    } else {
      setNome('');
      setSlug('');
      setArea('policial');
      setOrdem(0);
      setAtiva(false);
      setFotoUrl(null);
      setSlugTouched(false);
    }
  }, [mode, carreira, open]);

  // Auto-slug até que o usuário edite manualmente o campo slug
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(nome));
  }, [nome, slugTouched]);

  const handleSave = async () => {
    const payload = {
      nome: nome.trim(),
      slug: slug.trim(),
      area,
      ordem,
      ativa,
      foto_url: fotoUrl,
    };
    if (!payload.nome || !payload.slug) return;

    if (mode === 'create') {
      await create.mutateAsync(payload);
    } else if (carreira) {
      await update.mutateAsync({ id: carreira.id, patch: payload });
    }
    onClose();
  };

  const saving = create.isPending || update.isPending;
  const title = mode === 'create' ? 'Nova carreira' : 'Editar carreira';
  const canSave = nome.trim().length > 0 && slug.trim().length > 0;

  return (
    <ModerationDrawer
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <ObjetivoFotoUpload
          slug={slug || 'novo'}
          fotoUrl={fotoUrl}
          onChange={setFotoUrl}
        />

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1">
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: PF · Agente"
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-violet-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="ex: pf-agente"
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-mono outline-none focus:border-violet-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1">
            Área
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as Area)}
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-violet-400"
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>{AREA_LABELS[a]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1">
            Ordem
          </label>
          <input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-violet-400"
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
          <div>
            <div className="text-[13px] font-medium text-slate-800">Ativa</div>
            <div className="text-[11px] text-slate-500">
              Carreiras ativas aparecem no carrossel da página de questões.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAtiva((v) => !v)}
            className={[
              'relative h-5 w-9 rounded-full transition-colors',
              ativa ? 'bg-violet-500' : 'bg-slate-300',
            ].join(' ')}
            aria-pressed={ativa}
          >
            <span
              className={[
                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                ativa ? 'translate-x-[18px]' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>
      </div>
    </ModerationDrawer>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/objetivos/ObjetivoDrawer.tsx
git commit -m "feat(objetivo): drawer admin pra criar/editar carreiras (sem cargos vinculados — Fase 2)"
```

---

## Task 15: Listagem `ObjetivoTable` + página `ObjetivosModerationPage`

**Files:**
- Create: `src/components/moderation/objetivos/ObjetivoTable.tsx`
- Create: `src/components/moderation/objetivos/ObjetivosModerationPage.tsx`

- [ ] **Step 1: Criar ObjetivoTable**

```tsx
// src/components/moderation/objetivos/ObjetivoTable.tsx
'use client';

import { Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { AREA_LABELS, type Carreira } from '@/types/carreira';
import { useDeleteCarreira, useUpdateCarreira } from './useCarreirasAdmin';

interface ObjetivoTableProps {
  carreiras: Carreira[];
  loading: boolean;
  onEdit: (carreira: Carreira) => void;
}

export function ObjetivoTable({ carreiras, loading, onEdit }: ObjetivoTableProps) {
  const update = useUpdateCarreira();
  const del = useDeleteCarreira();

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">Carregando…</div>
    );
  }

  if (carreiras.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Nenhuma carreira cadastrada ainda. Clique em <strong>+ Nova carreira</strong> pra começar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2">Foto</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Área</th>
            <th className="px-3 py-2">Ordem</th>
            <th className="px-3 py-2">Ativa</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {carreiras.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">
                {c.foto_url ? (
                  <img src={c.foto_url} alt="" className="h-9 w-9 rounded object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-slate-400">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800">{c.nome}</div>
                <div className="font-mono text-[11px] text-slate-400">{c.slug}</div>
              </td>
              <td className="px-3 py-2 text-slate-600">{AREA_LABELS[c.area]}</td>
              <td className="px-3 py-2 text-slate-600">{c.ordem}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() =>
                    update.mutate({ id: c.id, patch: { ativa: !c.ativa } })
                  }
                  className={[
                    'relative h-5 w-9 rounded-full transition-colors',
                    c.ativa ? 'bg-emerald-500' : 'bg-slate-300',
                  ].join(' ')}
                  aria-pressed={c.ativa}
                  aria-label="Alternar ativa"
                >
                  <span
                    className={[
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                      c.ativa ? 'translate-x-[18px]' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </button>
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(c)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remover "${c.nome}"? Essa ação não pode ser desfeita.`)) {
                      del.mutate(c.id);
                    }
                  }}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Criar ObjetivosModerationPage**

```tsx
// src/components/moderation/objetivos/ObjetivosModerationPage.tsx
'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AREAS, AREA_LABELS, type Area, type Carreira } from '@/types/carreira';
import { ObjetivoTable } from './ObjetivoTable';
import { ObjetivoDrawer } from './ObjetivoDrawer';
import { useCarreirasAll } from './useCarreirasAdmin';

export function ObjetivosModerationPage() {
  const { data: carreiras = [], isLoading } = useCarreirasAll();

  const [areaFilter, setAreaFilter] = useState<Area | 'todas'>('todas');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerItem, setDrawerItem] = useState<Carreira | null>(null);

  const filtered = useMemo(() => {
    return carreiras.filter((c) => {
      if (areaFilter !== 'todas' && c.area !== areaFilter) return false;
      if (statusFilter === 'ativas' && !c.ativa) return false;
      if (statusFilter === 'inativas' && c.ativa) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.nome.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [carreiras, areaFilter, statusFilter, search]);

  const openCreate = () => {
    setDrawerMode('create');
    setDrawerItem(null);
    setDrawerOpen(true);
  };

  const openEdit = (c: Carreira) => {
    setDrawerMode('edit');
    setDrawerItem(c);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Objetivos</h1>
          <p className="text-sm text-slate-500">
            Gerencie as carreiras que aparecem na seção "Objetivo" da página de questões.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova carreira
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]">
          <Search className="h-3 w-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="w-52 bg-transparent outline-none"
          />
        </div>

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value as any)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
        >
          <option value="todas">Todas áreas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{AREA_LABELS[a]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
        >
          <option value="todas">Todos status</option>
          <option value="ativas">Só ativas</option>
          <option value="inativas">Só inativas</option>
        </select>

        <div className="ml-auto text-[11px] text-slate-400">
          {filtered.length} de {carreiras.length}
        </div>
      </div>

      <ObjetivoTable carreiras={filtered} loading={isLoading} onEdit={openEdit} />

      <ObjetivoDrawer
        open={drawerOpen}
        mode={drawerMode}
        carreira={drawerItem}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/moderation/objetivos/ObjetivoTable.tsx src/components/moderation/objetivos/ObjetivosModerationPage.tsx
git commit -m "feat(objetivo): listagem e página admin de Objetivos com filtros e CRUD"
```

---

## Task 16: Registrar rota + entrada na sidebar de moderação

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/moderation/layout/ModerationSidebar.tsx`

- [ ] **Step 1: Adicionar import + rota em App.tsx**

No topo do arquivo (após os outros imports de moderation):

```tsx
import { ObjetivosModerationPage } from './components/moderation/objetivos/ObjetivosModerationPage';
```

Localize o bloco `<Route path="/moderacao">` (linha ~216–232). Adicione a rota `objetivos` junto das irmãs `editais`, `questoes`, etc:

```tsx
<Route path="editais" element={<EditaisModerationPage />} />
<Route path="objetivos" element={<ObjetivosModerationPage />} />   {/* ← adicionar */}
```

- [ ] **Step 2: Adicionar entrada na ModerationSidebar**

No `navItems` (linha ~36–70), adicione o item Objetivos após Editais:

```tsx
import { Target } from 'lucide-react';   // ← adicionar ao import
// ...
{
  label: 'Editais',
  href: '/moderacao/editais',
  icon: <ClipboardList className="h-[15px] w-[15px]" />,
},
{
  label: 'Objetivos',
  href: '/moderacao/objetivos',
  icon: <Target className="h-[15px] w-[15px]" />,
},
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificar navegação no dev server**

```bash
npm run dev
```

- Vá pra `/moderacao`. Na sidebar deve aparecer o item **Objetivos** (ícone de alvo).
- Clique nele → rota `/moderacao/objetivos` abre a `ObjetivosModerationPage`
- Botão **+ Nova carreira** abre o drawer. Preencha e salve.
- Depois de salvar com `ativa=true` e uma foto, vá para `/questoes` → a carreira deve aparecer no carrossel da área correspondente.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/moderation/layout/ModerationSidebar.tsx
git commit -m "feat(objetivo): rota /moderacao/objetivos + entrada na sidebar de moderação"
```

---

## Task 17: QA end-to-end + ajustes visuais

**Files:**
- Potencialmente: qualquer componente da seção OBJETIVO para refinamentos

- [ ] **Step 1: Checklist de verificação**

Com `npm run dev` rodando, abra como admin:

1. `/moderacao/objetivos`
   - [ ] Listagem carrega sem erros
   - [ ] Botão "+ Nova carreira" abre drawer
   - [ ] Upload de foto funciona (WebP 400×400 gerado)
   - [ ] Slug auto-preenche ao digitar nome
   - [ ] Toggle Ativa funciona direto na tabela
   - [ ] Edit carrega valores existentes no drawer
   - [ ] Delete pede confirmação e remove

2. `/questoes` (como aluno comum)
   - [ ] Header mostra "Banco de Questões." em serifa com ponto azul
   - [ ] Tabs `Filtros / Filtro semântico / Cadernos` em pill segmented, ativo em branco
   - [ ] Seção OBJETIVO aparece entre header e pills
   - [ ] Label "OBJETIVO" uppercase, busca "Filtrar carreiras" à direita
   - [ ] Tabs de área mostram contagens corretas (só de carreiras `ativa=true`)
   - [ ] Carrossel mostra card "Todas" + carreiras da área ativa
   - [ ] Ao clicar num card, borda azul + ✓ aparece
   - [ ] Até 3 focos simultâneos; 4º desativa o mais antigo
   - [ ] Clicar no card "Todas" desativa todos os focos
   - [ ] Botão "Limpar objetivo" aparece só com foco ativo
   - [ ] Busca "Filtrar carreiras" filtra o carrossel por substring
   - [ ] Seta `›` está fora do carrossel e rola ~3 cards
   - [ ] Pills abaixo continuam intactos (funcionam como antes)

3. Mobile (DevTools, 375px de largura)
   - [ ] Tabs de modo empilham abaixo do título se necessário (ou continuam inline)
   - [ ] Tabs de área têm scroll horizontal
   - [ ] Carrossel tem scroll horizontal suave

- [ ] **Step 2: Ajustes pontuais**

Liste aqui qualquer desvio visual e ajuste nos arquivos `src/components/questoes/objetivo/*.tsx` antes de commit final.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Corrigir qualquer erro de lint introduzido.

- [ ] **Step 4: Build final**

```bash
npm run build:dev
```

Deve concluir sem erros.

- [ ] **Step 5: Commit final (se houve ajustes)**

```bash
git add -A
git commit -m "chore(objetivo): QA pass — ajustes visuais finais da Fase 1"
```

---

## Self-review (realizada)

**Spec coverage:**
- Header refinado → Task 11
- Seção OBJETIVO (header+tabs+carrossel+busca) → Tasks 5–9
- SemanticScopeToggle → Task 10
- Tabela `carreiras` + bucket + RLS → Task 1
- Hooks de fetch e estado → Tasks 3, 4
- Types e enum de áreas → Task 2
- Painel admin CRUD básico + foto → Tasks 12–15
- Rota + entrada sidebar → Task 16
- QA end-to-end → Task 17

**Placeholder scan:** nenhuma referência a TBD/TODO/"implement later".

**Consistência de tipos:** `Carreira`, `CarreiraInput`, `Area`, `AREAS`, `AREA_LABELS`, `useCarreiras`, `useAreaCounts`, `useFocoObjetivo`, `useCarreirasAll`, `useCreateCarreira`, `useUpdateCarreira`, `useDeleteCarreira` — todos definidos em Tasks 2–4 e 13; referenciados coerentemente em Tasks 5–15.

**Fase 2 explicitamente fora:** nenhum task tenta integrar `useQuestoesV2`, pills ou FK `cargos.carreira_id`. `SemanticScopeToggle` é visual-only (`visible={false}` no hardcoded). Nenhum hook persiste focos entre sessões.

# Questões · Objetivo (Fase 1A — Visual) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a UI da seção OBJETIVO na página de questões (título serifa, tabs segmented, tabs de área, carrossel de cards, busca, toggle semântico visual). Dados vêm de mock estático; zero Supabase, zero painel admin, zero integração com pills/query.

**Architecture:** Componentes novos em `src/components/questoes/objetivo/`, hooks em `src/hooks/`, dados mockados em `src/data/carreiras-mock.ts`. `useCarreiras` lê do mock com a mesma assinatura que terá depois em 1B (apenas a implementação muda — `useQuery(queryFn: () => MOCK)` vs `useQuery(queryFn: () => supabase...)`). Foco é estado local via React state (não persiste entre páginas).

**Tech Stack:** React 19, Tailwind CSS v4, @tanstack/react-query, lucide-react, React Router DOM.

**Spec:** `docs/superpowers/specs/2026-04-20-questoes-objetivo-design.md`

**Escopo explícito:**
- ✅ Toda a UI da seção OBJETIVO + header refinado
- ✅ Estado local de focos (até 3 simultâneos, FIFO no 4º)
- ✅ Mock estático de carreiras (fotos usam fallback CSS por padrão; trocar por URLs reais é opcional)
- ❌ Tabela `carreiras` no Supabase (Fase 1B)
- ❌ Painel admin `/moderacao/objetivos` (Fase 1B)
- ❌ Upload de foto (Fase 1B)
- ❌ Integração com pills / `useQuestoesV2` / toggle semântico funcional (Fase 2)

**Testing note:** O projeto não tem test runner configurado. Cada task usa verificação manual via `npm run dev`.

---

## File Structure

### Novos

```
src/types/carreira.ts                           — tipos e enum de áreas
src/data/carreiras-mock.ts                      — ~15 carreiras hardcoded pra demo
src/hooks/useCarreiras.ts                       — fetch (mock; 1B troca pra Supabase)
src/hooks/useFocoObjetivo.ts                    — estado local dos focos ativos
src/components/questoes/objetivo/
  ├─ ObjetivoSection.tsx                        — container
  ├─ ObjetivoHeader.tsx                         — label + limpar + busca
  ├─ AreaTabs.tsx                               — tabs de área
  ├─ CarreiraCarousel.tsx                       — scroll + seta
  ├─ CarreiraCard.tsx                           — card individual + TodasCard
  └─ SemanticScopeToggle.tsx                    — toggle visual
```

### Modificados

```
src/views/QuestoesPage.tsx   — refinar header, inserir ObjetivoSection, renderizar SemanticScopeToggle na aba Semântico
```

---

## Task 1: Types + enum de áreas

**Files:**
- Create: `src/types/carreira.ts`

- [ ] **Step 1: Criar arquivo**

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
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/carreira.ts
git commit -m "feat(objetivo): tipos de Carreira e enum de áreas"
```

---

## Task 2: Mock de carreiras

**Files:**
- Create: `src/data/carreiras-mock.ts`

- [ ] **Step 1: Criar arquivo de mock**

```typescript
// src/data/carreiras-mock.ts
//
// Dados temporários da Fase 1A. Na Fase 1B, `useCarreiras` troca a fonte
// pra Supabase e este arquivo pode ser deletado ou mantido como seed.
//
// foto_url = null pra usar o fallback (gradiente + sigla). Se quiser
// testar com imagens reais, troque por URLs Unsplash (ex:
// https://images.unsplash.com/photo-XXXX?w=400&h=400&fit=crop&auto=format&q=80).

import type { Carreira } from '@/types/carreira';

const now = new Date().toISOString();

export const MOCK_CARREIRAS: Carreira[] = [
  // ─── Policial ───────────────────────────────────────────────
  { id: 'mock-pf-agente',     area: 'policial',    nome: 'PF · Agente',        slug: 'pf-agente',     foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pf-escrivao',   area: 'policial',    nome: 'PF · Escrivão',      slug: 'pf-escrivao',   foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pf-delegado',   area: 'policial',    nome: 'PF · Delegado',      slug: 'pf-delegado',   foto_url: null, ordem: 3,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-prf',           area: 'policial',    nome: 'PRF · Policial',     slug: 'prf-policial',  foto_url: null, ordem: 4,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pc-sp-invest',  area: 'policial',    nome: 'PC-SP · Investigador', slug: 'pc-sp-investigador', foto_url: null, ordem: 5,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-pc-rj-inspet',  area: 'policial',    nome: 'PC-RJ · Inspetor',   slug: 'pc-rj-inspetor', foto_url: null, ordem: 6,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-depen',         area: 'policial',    nome: 'DEPEN · Agente',     slug: 'depen-agente',  foto_url: null, ordem: 7,  ativa: true, created_at: now, updated_at: now },

  // ─── Fiscal ─────────────────────────────────────────────────
  { id: 'mock-afrfb',         area: 'fiscal',      nome: 'RFB · Auditor',      slug: 'rfb-auditor',   foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-tcu-aud',       area: 'fiscal',      nome: 'TCU · Auditor',      slug: 'tcu-auditor',   foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-icms-sp',       area: 'fiscal',      nome: 'ICMS-SP · AFT',      slug: 'icms-sp-aft',   foto_url: null, ordem: 3,  ativa: true, created_at: now, updated_at: now },

  // ─── Jurídica ───────────────────────────────────────────────
  { id: 'mock-oab',           area: 'juridica',    nome: 'OAB · Exame',        slug: 'oab-exame',     foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-mp-fed',        area: 'juridica',    nome: 'MPF · Procurador',   slug: 'mpf-procurador', foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-def-pub',       area: 'juridica',    nome: 'Defensoria · Defensor', slug: 'def-defensor', foto_url: null, ordem: 3,  ativa: true, created_at: now, updated_at: now },

  // ─── Tribunais ──────────────────────────────────────────────
  { id: 'mock-trt-tec',       area: 'tribunais',   nome: 'TRT · Técnico',      slug: 'trt-tecnico',   foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-tre-anal',      area: 'tribunais',   nome: 'TRE · Analista',     slug: 'tre-analista',  foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },

  // ─── Saúde ──────────────────────────────────────────────────
  { id: 'mock-enf-mun',       area: 'saude',       nome: 'Prefeitura · Enfermeiro', slug: 'pref-enfermeiro', foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },

  // ─── Controle ───────────────────────────────────────────────
  { id: 'mock-cgu',           area: 'controle',    nome: 'CGU · Analista',     slug: 'cgu-analista',  foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },

  // ─── Bancária ───────────────────────────────────────────────
  { id: 'mock-bb',            area: 'bancaria',    nome: 'BB · Escriturário',  slug: 'bb-escriturario', foto_url: null, ordem: 1,  ativa: true, created_at: now, updated_at: now },
  { id: 'mock-caixa',         area: 'bancaria',    nome: 'Caixa · Técnico',    slug: 'caixa-tecnico', foto_url: null, ordem: 2,  ativa: true, created_at: now, updated_at: now },
];
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/data/carreiras-mock.ts
git commit -m "feat(objetivo): mock de carreiras da Fase 1A (19 cargos em 7 áreas)"
```

---

## Task 3: Hook `useCarreiras` (lê do mock)

**Files:**
- Create: `src/hooks/useCarreiras.ts`

- [ ] **Step 1: Criar hook**

```typescript
// src/hooks/useCarreiras.ts
//
// Fase 1A: fonte = mock estático em `@/data/carreiras-mock`.
// Fase 1B: mesma API, mas `queryFn` passa a bater no Supabase.
// Componentes consumidores não mudam entre fases.

'use client';

import { useQuery } from '@tanstack/react-query';
import { MOCK_CARREIRAS } from '@/data/carreiras-mock';
import type { Area, Carreira } from '@/types/carreira';

export function useCarreiras(area?: Area) {
  return useQuery({
    queryKey: ['carreiras', 'ativas', area ?? 'todas'],
    queryFn: async () => {
      let list = MOCK_CARREIRAS.filter((c) => c.ativa);
      if (area) list = list.filter((c) => c.area === area);
      return [...list].sort(
        (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
      ) as Carreira[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAreaCounts() {
  return useQuery({
    queryKey: ['carreiras', 'area-counts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const c of MOCK_CARREIRAS) {
        if (!c.ativa) continue;
        counts[c.area] = (counts[c.area] ?? 0) + 1;
      }
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
git commit -m "feat(objetivo): hook useCarreiras lendo do mock (Fase 1A)"
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
 * Fase 1A: estado em memória apenas (não persiste entre navegações).
 * Página abre sempre com nenhum foco ativo (card TODAS selecionado).
 */
export function useFocoObjetivo() {
  const [focos, setFocos] = useState<string[]>([]);

  const toggleFoco = useCallback((carreiraId: string) => {
    setFocos((prev) => {
      if (prev.includes(carreiraId)) {
        return prev.filter((id) => id !== carreiraId);
      }
      if (prev.length >= MAX_FOCOS) {
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
git commit -m "feat(objetivo): hook useFocoObjetivo com limite de 3 focos (FIFO)"
```

---

## Task 5: Componente `CarreiraCard` + `TodasCard`

**Files:**
- Create: `src/components/questoes/objetivo/CarreiraCard.tsx`

- [ ] **Step 1: Criar componente**

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

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.1) 40%, rgba(15,23,42,0.88) 100%)',
        }}
      />

      {active && (
        <span className="absolute top-[6px] right-[6px] inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <Check className="h-[10px] w-[10px]" strokeWidth={3} />
        </span>
      )}

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

function FallbackBackground({ nome }: { nome: string }) {
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
git commit -m "feat(objetivo): CarreiraCard + TodasCard + fallback por sigla"
```

---

## Task 6: Componente `CarreiraCarousel`

**Files:**
- Create: `src/components/questoes/objetivo/CarreiraCarousel.tsx`

- [ ] **Step 1: Criar componente**

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

const SCROLL_STEP = 360;

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
git commit -m "feat(objetivo): CarreiraCarousel com seta separada e TodasCard fixo"
```

---

## Task 7: Componente `AreaTabs`

**Files:**
- Create: `src/components/questoes/objetivo/AreaTabs.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// src/components/questoes/objetivo/AreaTabs.tsx
'use client';

import { AREAS, AREA_LABELS, type Area } from '@/types/carreira';

interface AreaTabsProps {
  value: Area;
  onChange: (area: Area) => void;
  counts: Record<string, number>;
}

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

- [ ] **Step 1: Criar componente**

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
git commit -m "feat(objetivo): ObjetivoHeader com label, limpar condicional e busca"
```

---

## Task 9: Container `ObjetivoSection`

**Files:**
- Create: `src/components/questoes/objetivo/ObjetivoSection.tsx`

- [ ] **Step 1: Criar container**

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
 *  - estado da área selecionada
 *  - filtro por texto (busca "Filtrar carreiras")
 *  - focos ativos (useFocoObjetivo)
 *  - carreiras da área (useCarreiras)
 *  - contagens por área (useAreaCounts)
 *
 * Fase 1A: os focos não têm efeito nos pills ou na query de questões —
 * só destacam os cards visualmente.
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
git commit -m "feat(objetivo): ObjetivoSection container (header + tabs + carrossel)"
```

---

## Task 10: `SemanticScopeToggle` (visual-only)

**Files:**
- Create: `src/components/questoes/objetivo/SemanticScopeToggle.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// src/components/questoes/objetivo/SemanticScopeToggle.tsx
'use client';

/**
 * Toggle "Incluir fora do foco" da aba Filtro semântico.
 *
 * Fase 1A: só a UI. `visible={false}` por default → não aparece até Fase 2
 * conectar a lógica real de contagem `fora_foco` via useQuestoesV2.
 */

interface SemanticScopeToggleProps {
  visible: boolean;
  incluirFora: boolean;
  onToggle: () => void;
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
git commit -m "feat(objetivo): SemanticScopeToggle visual-only (Fase 1A)"
```

---

## Task 11: Integrar na `QuestoesPage.tsx`

**Files:**
- Modify: `src/views/QuestoesPage.tsx`

- [ ] **Step 1: Ler a região atual do header**

```bash
sed -n '90,150p' "D:/meta novo/Metav2/src/views/QuestoesPage.tsx"
```

Confirme que você vê o bloco com `<h1>` "Banco de Questões" e a `<nav>` com tabs de modo.

- [ ] **Step 2: Adicionar imports no topo**

No bloco de imports existente (linhas 1–19), adicione:

```tsx
import { ObjetivoSection } from "@/components/questoes/objetivo/ObjetivoSection";
import { SemanticScopeToggle } from "@/components/questoes/objetivo/SemanticScopeToggle";
```

- [ ] **Step 3: Substituir o bloco título+tabs pelo header refinado + inserir ObjetivoSection**

Localize o bloco que começa com:

```tsx
<div className="flex items-end gap-4 pt-2 pb-1 border-b border-blue-100/60">
```

e termina com o `</div>` que fecha esse wrapper (incluindo o `<h1>` e a `<nav>` das tabs de modo). Substitua por:

```tsx
{/* Header refinado: título serifa + tabs como segmented control */}
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

{/* Seção OBJETIVO — Fase 1A: UI só, foco não afeta query ainda */}
<ObjetivoSection />
```

- [ ] **Step 4: Adicionar `SemanticScopeToggle` na aba Semântico**

Localize o bloco:

```tsx
{filterView === 'semantico' && (
  <div className="pt-2 pb-2">
    <QuestoesSearchBar />
  </div>
)}
```

Substitua por:

```tsx
{filterView === 'semantico' && (
  <div className="pt-2 pb-2">
    <QuestoesSearchBar />
    {/* Fase 1A: visible=false → não renderiza. Fase 2 ativa baseado em foco+query. */}
    <SemanticScopeToggle
      visible={false}
      incluirFora={false}
      onToggle={() => { /* noop — Fase 2 */ }}
    />
  </div>
)}
```

- [ ] **Step 5: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Subir dev server e validar visualmente**

```bash
npm run dev
```

Abra `http://localhost:3000/questoes` (após login). Confirme o checklist:

- [ ] Título **"Banco de Questões."** em serifa, ponto azul, sem sobretítulo
- [ ] Tabs **`Filtros / Filtro semântico / Cadernos`** à direita do título como segmented pill (ativo em branco com sombra sutil)
- [ ] Abaixo do header, seção **OBJETIVO** com:
  - Label `OBJETIVO` uppercase à esquerda com ícone de alvo concêntrico
  - Busca `Filtrar carreiras` à direita
- [ ] Tabs de área: `Policial (7) · Fiscal (3) · Jurídica (3) · Tribunais (2) · Saúde (1) · Controle (1) · Legislativo (0) · Bancária (2) · Militar (0)`
- [ ] Carrossel mostra card **Todas** + cargos da Policial (7 cards com fallback gradient + sigla)
- [ ] Clicar num card: borda azul + ✓ no canto superior direito
- [ ] 4º clique: o mais antigo desativa automaticamente (FIFO)
- [ ] Clicar em **Todas** desativa todos os focos
- [ ] Botão **"Limpar objetivo"** aparece só quando há foco ativo
- [ ] Busca filtra o carrossel por substring (ex: digitar "escri" mostra só PF-Escrivão)
- [ ] Seta `›` está em uma caixinha **à direita do carrossel** (fora dos cards) e rola horizontal ao clicar
- [ ] Trocar tab de área: carrossel muda; focos em áreas diferentes continuam ativos
- [ ] Pills abaixo (Bancas, Matérias, etc.) continuam funcionando como antes
- [ ] Lista de questões abaixo não muda ao ativar foco (correto pra Fase 1A)

- [ ] **Step 7: Ajustes pontuais**

Qualquer desvio visual, ajuste nos componentes correspondentes. Prefira pequenos patches a grandes refactors.

- [ ] **Step 8: Commit final**

```bash
git add src/views/QuestoesPage.tsx
git commit -m "feat(objetivo): integrar ObjetivoSection + header refinado na QuestoesPage"
```

---

## Self-review

**Spec coverage (Fase 1A):**
- Header refinado → Task 11
- Label `OBJETIVO` + busca + limpar → Task 8
- Tabs de área com contagem → Task 7
- Carrossel + card TODAS + seta separada → Tasks 5, 6
- Estado de focos (até 3, FIFO) → Task 4
- Dados mockados → Task 2
- Hook com API igual à Fase 1B → Task 3
- `SemanticScopeToggle` renderizado mas visible=false → Tasks 10, 11

**Fora do escopo (confirmado):**
- Migração Supabase, bucket, RLS — Fase 1B
- Painel admin, upload, CRUD — Fase 1B
- Integração foco→pills→query, toggle funcional — Fase 2

**Placeholder scan:** nenhum TBD / TODO / "handle edge cases".

**Type consistency:** `Carreira`, `Area`, `AREAS`, `AREA_LABELS`, `useCarreiras(area?)`, `useAreaCounts()`, `useFocoObjetivo()`, `MOCK_CARREIRAS` — todos definidos em Tasks 1–4 e usados coerentemente em Tasks 5–11.

**Fase 1B (próxima iteração):**
Depois que você aprovar a 1A visualmente, abro um plano curto só pra:
1. Migração SQL (tabela `carreiras` + bucket + RLS)
2. Trocar `useCarreiras`/`useAreaCounts` pra ler do Supabase
3. Painel admin `/moderacao/objetivos` (CRUD + upload)
4. Rota + entrada sidebar
5. Remover `src/data/carreiras-mock.ts`

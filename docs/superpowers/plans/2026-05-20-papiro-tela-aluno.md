# PAPIRO — Tela do Aluno (V1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a tela do aluno PAPIRO V1 — 4 telas hierárquicas (`/estudar` → disciplina → macro_area → tema) que consomem `papiro.*` via `supabase.schema('papiro')` + React Query.

**Architecture:** Pages finas em `views/papiro/`, lógica visual em `components/papiro/`, queries isoladas em `hooks/papiro/`, utilities puros em `lib/papiro/`. Tipos de tabela gerados automaticamente; tipos derivados manuais. Reuso de `src/v3/components/resumos/ResumoLeitor.tsx` (Plate readOnly, 36 linhas, estável). Mobile focal full-screen apenas no leitor via CSS-only (sem mexer no `isStudyMode` global).

**Tech Stack:** Next.js 16 + react-router-dom (híbrido), React Query (`@tanstack/react-query`), Supabase JS v2 (com `.schema('papiro')`), TypeScript estrito, Tailwind v4, shadcn/ui, Plate editor (`ResumoLeitor` v3), vitest pra testes puros.

**Spec base:** [`docs/superpowers/specs/2026-05-20-papiro-tela-aluno-design.md`](../specs/2026-05-20-papiro-tela-aluno-design.md)

---

## File Structure

```
src/
├─ types/
│   └─ database.papiro.ts            (NEW — gerado por supabase CLI)
├─ lib/papiro/
│   ├─ slug.ts                       (NEW — build/parse/url helpers + validações)
│   ├─ slug.test.ts                  (NEW — vitest TDD)
│   └─ types.ts                      (NEW — tipos derivados manuais + re-exports)
├─ hooks/papiro/
│   ├─ usePapiroDisciplinas.ts       (NEW)
│   ├─ usePapiroDisciplina.ts        (NEW)
│   ├─ usePapiroTrilha.ts            (NEW)
│   └─ usePapiroTema.ts              (NEW)
├─ components/papiro/
│   ├─ DisciplinaCard.tsx            (NEW)
│   ├─ MacroAreaCard.tsx             (NEW)
│   ├─ TrilhaHeader.tsx              (NEW)
│   ├─ TrilhaItem.tsx                (NEW)
│   ├─ TemaSemResumoPreview.tsx      (NEW)
│   ├─ LeitorTopbar.tsx              (NEW — visível só em mobile via CSS)
│   ├─ LeitorNavRodape.tsx           (NEW)
│   └─ papiro.css                    (NEW — CSS-only focal mobile + scope local)
├─ views/papiro/
│   ├─ PapiroIndexPage.tsx           (NEW — /estudar)
│   ├─ PapiroDisciplinaPage.tsx      (NEW — /estudar/:disciplinaSlug)
│   ├─ PapiroTrilhaPage.tsx          (NEW — /estudar/:disciplinaSlug/:macroAreaTail)
│   └─ PapiroLeitorPage.tsx          (NEW — /estudar/:disciplinaSlug/:macroAreaTail/:temaTail)
├─ App.tsx                            (MODIFY — adicionar 4 rotas)
├─ components/AppTopNav.tsx          (MODIFY — adicionar item "Estudar")
└─ index.css                          (MODIFY — importar papiro.css)

package.json                          (MODIFY — adicionar script "papiro:types")
```

---

## Task 1: Gerar `database.papiro.ts` e adicionar npm script

**Files:**
- Create: `src/types/database.papiro.ts` (via supabase CLI)
- Modify: `package.json` (adicionar `papiro:types` em `scripts`)

- [ ] **Step 1: Gerar `database.papiro.ts`**

Run:
```bash
node_modules/.bin/supabase gen types typescript --project-id xmtleqquivcukwgdexhc --schema papiro > src/types/database.papiro.ts
```

Expected: arquivo criado com ~339 linhas, sem warnings de npm dentro (porque usa o binário direto, não `npx --yes`).

- [ ] **Step 2: Verificar conteúdo do arquivo gerado**

Run: `head -20 src/types/database.papiro.ts`

Expected (primeiras linhas):
```
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { ... }
  papiro: {
    Tables: {
      disciplina: { Row: {...}, Insert: {...}, ... }
      macro_area: { ... }
      tema: { ... }
      tema_prereq: { ... }
      resumo: { ... }
    }
    ...
  }
}
```

- [ ] **Step 3: Adicionar script `papiro:types` em `package.json`**

Modify `package.json` (em `scripts`, depois de `"papiro:seed"`):

```json
"papiro:seed": "tsx scripts/papiro/generate-seed.ts",
"papiro:types": "supabase gen types typescript --project-id xmtleqquivcukwgdexhc --schema papiro > src/types/database.papiro.ts"
```

- [ ] **Step 4: Commit**

```bash
git add src/types/database.papiro.ts package.json
git commit -m "feat(papiro): tipos gerados de papiro.* + npm script papiro:types"
```

---

## Task 2: Criar `lib/papiro/slug.ts` (TDD)

**Files:**
- Create: `src/lib/papiro/slug.test.ts`
- Create: `src/lib/papiro/slug.ts`

- [ ] **Step 1: Escrever os testes (failing)**

Create `src/lib/papiro/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isValidSlug,
  validateSlug,
  buildMacroAreaSlug,
  buildTemaSlug,
  parseMacroAreaSlug,
  parseTemaSlug,
  disciplinaUrl,
  macroAreaUrl,
  temaUrl,
} from './slug';

describe('isValidSlug', () => {
  it('aceita slug com letras minúsculas, dígitos, ponto e underscore', () => {
    expect(isValidSlug('informatica')).toBe(true);
    expect(isValidSlug('informatica.redes_internet')).toBe(true);
    expect(isValidSlug('informatica.redes_internet.fundamentos_redes')).toBe(true);
    expect(isValidSlug('a1.b2_c3')).toBe(true);
  });

  it('rejeita slug com maiúscula, espaço, acento ou caractere especial', () => {
    expect(isValidSlug('Informatica')).toBe(false);
    expect(isValidSlug('informática')).toBe(false);
    expect(isValidSlug('redes internet')).toBe(false);
    expect(isValidSlug('redes-internet')).toBe(false);
    expect(isValidSlug('redes/internet')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('validateSlug', () => {
  it('joga Error quando inválido', () => {
    expect(() => validateSlug('Foo')).toThrow();
    expect(() => validateSlug('')).toThrow();
  });
  it('não joga quando válido', () => {
    expect(() => validateSlug('informatica.redes_internet')).not.toThrow();
  });
});

describe('buildMacroAreaSlug', () => {
  it('concatena disciplina + macroAreaTail com ponto', () => {
    expect(buildMacroAreaSlug('informatica', 'redes_internet'))
      .toBe('informatica.redes_internet');
  });
});

describe('buildTemaSlug', () => {
  it('concatena os 3 segmentos com pontos', () => {
    expect(buildTemaSlug('informatica', 'redes_internet', 'fundamentos_redes'))
      .toBe('informatica.redes_internet.fundamentos_redes');
  });
});

describe('parseMacroAreaSlug', () => {
  it('faz split em 2 partes pelos pontos', () => {
    expect(parseMacroAreaSlug('informatica.redes_internet'))
      .toEqual({ disciplinaSlug: 'informatica', macroAreaTail: 'redes_internet' });
  });
  it('joga Error se não tiver exatamente 2 segmentos', () => {
    expect(() => parseMacroAreaSlug('informatica')).toThrow();
    expect(() => parseMacroAreaSlug('a.b.c')).toThrow();
  });
});

describe('parseTemaSlug', () => {
  it('faz split em 3 partes', () => {
    expect(parseTemaSlug('informatica.redes_internet.fundamentos_redes'))
      .toEqual({
        disciplinaSlug: 'informatica',
        macroAreaTail: 'redes_internet',
        temaTail: 'fundamentos_redes',
      });
  });
  it('joga Error se não tiver exatamente 3 segmentos', () => {
    expect(() => parseTemaSlug('informatica.redes_internet')).toThrow();
  });
});

describe('URL helpers', () => {
  it('disciplinaUrl gera /estudar/<slug>', () => {
    expect(disciplinaUrl('informatica')).toBe('/estudar/informatica');
  });
  it('macroAreaUrl converte ponto → barra', () => {
    expect(macroAreaUrl('informatica.redes_internet'))
      .toBe('/estudar/informatica/redes_internet');
  });
  it('temaUrl converte 2 pontos → 2 barras', () => {
    expect(temaUrl('informatica.redes_internet.fundamentos_redes'))
      .toBe('/estudar/informatica/redes_internet/fundamentos_redes');
  });
});

describe('roundtrip', () => {
  it('buildTemaSlug ↔ parseTemaSlug invertem-se', () => {
    const original = { disciplinaSlug: 'informatica', macroAreaTail: 'redes_internet', temaTail: 'fundamentos_redes' };
    const slug = buildTemaSlug(original.disciplinaSlug, original.macroAreaTail, original.temaTail);
    expect(parseTemaSlug(slug)).toEqual(original);
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

Run: `npx vitest run src/lib/papiro/slug.test.ts`

Expected: todos os testes falham com "Cannot find module './slug'" ou similar.

- [ ] **Step 3: Implementar `slug.ts`**

Create `src/lib/papiro/slug.ts`:

```ts
/**
 * PAPIRO — utilities de slug.
 *
 * Convenções (decisões da spec):
 *   - disciplina.slug         = 1º segmento (ex: "informatica")
 *   - macro_area.slug         = "<disciplina>.<tail>" (ex: "informatica.redes_internet")
 *   - tema.slug_hierarquico   = "<disciplina>.<tail>.<temaTail>" (ex: "informatica.redes_internet.fundamentos_redes")
 *   - URL                     = "/estudar/<disciplina>/<tail>/<temaTail>" (pontos viram barras)
 *
 * Tudo puro, sem dependência de React/router. Testado em slug.test.ts.
 */

const SLUG_PATTERN = /^[a-z0-9_.]+$/;

export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length > 0 && SLUG_PATTERN.test(slug);
}

export function validateSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(`PAPIRO: slug inválido "${slug}" (esperado /^[a-z0-9_.]+$/)`);
  }
}

export function buildMacroAreaSlug(disciplinaSlug: string, macroAreaTail: string): string {
  validateSlug(disciplinaSlug);
  validateSlug(macroAreaTail);
  return `${disciplinaSlug}.${macroAreaTail}`;
}

export function buildTemaSlug(disciplinaSlug: string, macroAreaTail: string, temaTail: string): string {
  validateSlug(disciplinaSlug);
  validateSlug(macroAreaTail);
  validateSlug(temaTail);
  return `${disciplinaSlug}.${macroAreaTail}.${temaTail}`;
}

export function parseMacroAreaSlug(slug: string): { disciplinaSlug: string; macroAreaTail: string } {
  validateSlug(slug);
  const parts = slug.split('.');
  if (parts.length !== 2) {
    throw new Error(`PAPIRO: macro_area.slug deve ter 2 segmentos: "${slug}"`);
  }
  return { disciplinaSlug: parts[0], macroAreaTail: parts[1] };
}

export function parseTemaSlug(slug: string): { disciplinaSlug: string; macroAreaTail: string; temaTail: string } {
  validateSlug(slug);
  const parts = slug.split('.');
  if (parts.length !== 3) {
    throw new Error(`PAPIRO: tema.slug_hierarquico deve ter 3 segmentos: "${slug}"`);
  }
  return { disciplinaSlug: parts[0], macroAreaTail: parts[1], temaTail: parts[2] };
}

export function disciplinaUrl(disciplinaSlug: string): string {
  validateSlug(disciplinaSlug);
  return `/estudar/${disciplinaSlug}`;
}

export function macroAreaUrl(macroAreaSlug: string): string {
  const { disciplinaSlug, macroAreaTail } = parseMacroAreaSlug(macroAreaSlug);
  return `/estudar/${disciplinaSlug}/${macroAreaTail}`;
}

export function temaUrl(temaSlugHierarquico: string): string {
  const { disciplinaSlug, macroAreaTail, temaTail } = parseTemaSlug(temaSlugHierarquico);
  return `/estudar/${disciplinaSlug}/${macroAreaTail}/${temaTail}`;
}
```

- [ ] **Step 4: Rodar os testes e verificar passam**

Run: `npx vitest run src/lib/papiro/slug.test.ts`

Expected: todos os ~12 testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/papiro/slug.ts src/lib/papiro/slug.test.ts
git commit -m "feat(papiro): slug.ts com build/parse/url helpers + validação (TDD)"
```

---

## Task 3: Criar `lib/papiro/types.ts` (tipos derivados + re-exports)

**Files:**
- Create: `src/lib/papiro/types.ts`

- [ ] **Step 1: Criar arquivo**

Create `src/lib/papiro/types.ts`:

```ts
/**
 * PAPIRO — tipos derivados manuais.
 *
 * Tipos brutos das tabelas são gerados por `npm run papiro:types`
 * em src/types/database.papiro.ts. Aqui re-exportamos com nomes ergonômicos
 * + definimos composições usadas como retorno dos hooks.
 */

import type { Database } from '@/types/database.papiro';

// --- Re-exports ergonômicos ---
export type PapiroDisciplina = Database['papiro']['Tables']['disciplina']['Row'];
export type PapiroMacroArea = Database['papiro']['Tables']['macro_area']['Row'];
export type PapiroTema = Database['papiro']['Tables']['tema']['Row'];
export type PapiroResumo = Database['papiro']['Tables']['resumo']['Row'];
export type PapiroTemaPrereq = Database['papiro']['Tables']['tema_prereq']['Row'];

export type StatusResumo = 'rascunho' | 'revisao' | 'publicado';

// --- Composições ---

export interface PapiroPrereqResolvido {
  slug_hierarquico: string;
  nome: string;
}

export interface PapiroTemaComStatus extends PapiroTema {
  temResumoPublicado: boolean;
  prereqs: PapiroPrereqResolvido[];
}

export interface PapiroStats {
  temasTotal: number;
  tempoTotalMin: number;
  temasDisponiveis: number;
}

// usePapiroDisciplinas() retorno
export interface PapiroDisciplinaResumo {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  stats: PapiroStats;
  macroAreasCount: number;
}
export interface PapiroDisciplinasData {
  disponiveis: PapiroDisciplinaResumo[];
  emProducao: PapiroDisciplinaResumo[];
}

// usePapiroDisciplina(slug) retorno
export interface PapiroMacroAreaResumo {
  id: string;
  nome: string;
  slug: string; // ex: "informatica.redes_internet"
  ordem: number;
  stats: PapiroStats;
}
export interface PapiroDisciplinaData {
  disciplina: PapiroDisciplina;
  macroAreasDisponiveis: PapiroMacroAreaResumo[];
  macroAreasEmProducao: PapiroMacroAreaResumo[];
}

// usePapiroTrilha(slug) retorno
export interface PapiroTrilhaData {
  id: string;
  slug: string;
  nome: string;
  disciplinaSlug: string;
  disciplinaNome: string;
  stats: PapiroStats;
  temas: PapiroTemaComStatus[];
}

// usePapiroTema(slug) retorno
export interface PapiroTemaSibling {
  slug_hierarquico: string;
  nome: string;
  ordem_curricular: number;
}
export interface PapiroTemaData {
  tema: PapiroTema;
  resumo: PapiroResumo | null;
  prev: PapiroTemaSibling | null;
  next: PapiroTemaSibling | null;
  prereqs: PapiroPrereqResolvido[];
  indice: { atual: number; total: number };
  macroAreaNome: string;
  macroAreaSlug: string;
  disciplinaNome: string;
  disciplinaSlug: string;
  macroAreaTail: string;
}
```

- [ ] **Step 2: Verificar TypeScript aceita**

Run: `npx tsc --noEmit`

Expected: sem erros (database.papiro.ts exporta `Database` e o import resolve).

- [ ] **Step 3: Commit**

```bash
git add src/lib/papiro/types.ts
git commit -m "feat(papiro): types.ts com composições derivadas + re-exports"
```

---

## Task 4: Criar `usePapiroDisciplinas()`

**Files:**
- Create: `src/hooks/papiro/usePapiroDisciplinas.ts`

- [ ] **Step 1: Implementar o hook**

Create `src/hooks/papiro/usePapiroDisciplinas.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PapiroDisciplinasData, PapiroDisciplinaResumo } from '@/lib/papiro/types';

interface RawDisciplina {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  macro_area: Array<{
    id: string;
    tema: Array<{
      id: string;
      tempo_estudo_min: number | null;
      resumo: Array<{ status: string }>;
    }>;
  }>;
}

export function usePapiroDisciplinas() {
  return useQuery<PapiroDisciplinasData>({
    queryKey: ['papiro', 'disciplinas'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('papiro')
        .from('disciplina')
        .select(`
          id, nome, slug, ordem,
          macro_area:macro_area!disciplina_id (
            id,
            tema:tema!macro_area_id (
              id,
              tempo_estudo_min,
              resumo:resumo!tema_id ( status )
            )
          )
        `)
        .order('ordem');

      if (error) throw error;
      const rows = (data ?? []) as RawDisciplina[];

      const disponiveis: PapiroDisciplinaResumo[] = [];
      const emProducao: PapiroDisciplinaResumo[] = [];

      for (const d of rows) {
        let temasTotal = 0;
        let tempoTotalMin = 0;
        let temasDisponiveis = 0;
        for (const ma of d.macro_area) {
          for (const t of ma.tema) {
            temasTotal++;
            tempoTotalMin += t.tempo_estudo_min ?? 0;
            // RLS já filtra status='publicado'; embed vem [] se bloqueado.
            if (t.resumo.length > 0) temasDisponiveis++;
          }
        }
        const resumo: PapiroDisciplinaResumo = {
          id: d.id,
          nome: d.nome,
          slug: d.slug,
          ordem: d.ordem,
          macroAreasCount: d.macro_area.length,
          stats: { temasTotal, tempoTotalMin, temasDisponiveis },
        };
        if (temasDisponiveis > 0) disponiveis.push(resumo);
        else emProducao.push(resumo);
      }

      return { disponiveis, emProducao };
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/papiro/usePapiroDisciplinas.ts
git commit -m "feat(papiro): usePapiroDisciplinas — lista disciplinas + agregação por status"
```

---

## Task 5: Criar `usePapiroDisciplina(disciplinaSlug)`

**Files:**
- Create: `src/hooks/papiro/usePapiroDisciplina.ts`

- [ ] **Step 1: Implementar o hook**

Create `src/hooks/papiro/usePapiroDisciplina.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PapiroDisciplinaData, PapiroMacroAreaResumo } from '@/lib/papiro/types';

interface RawDisciplina {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  criado_em: string;
  macro_area: Array<{
    id: string;
    nome: string;
    slug: string;
    ordem: number;
    tema: Array<{
      id: string;
      tempo_estudo_min: number | null;
      resumo: Array<{ status: string }>;
    }>;
  }>;
}

export function usePapiroDisciplina(disciplinaSlug: string | undefined) {
  return useQuery<PapiroDisciplinaData | null>({
    queryKey: ['papiro', 'disciplina', disciplinaSlug],
    staleTime: 5 * 60 * 1000,
    enabled: !!disciplinaSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('papiro')
        .from('disciplina')
        .select(`
          id, nome, slug, ordem, criado_em,
          macro_area:macro_area!disciplina_id (
            id, nome, slug, ordem,
            tema:tema!macro_area_id (
              id,
              tempo_estudo_min,
              resumo:resumo!tema_id ( status )
            )
          )
        `)
        .eq('slug', disciplinaSlug!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      const d = data as unknown as RawDisciplina;

      const macroAreasDisponiveis: PapiroMacroAreaResumo[] = [];
      const macroAreasEmProducao: PapiroMacroAreaResumo[] = [];

      for (const ma of d.macro_area.sort((a, b) => a.ordem - b.ordem)) {
        let temasTotal = 0;
        let tempoTotalMin = 0;
        let temasDisponiveis = 0;
        for (const t of ma.tema) {
          temasTotal++;
          tempoTotalMin += t.tempo_estudo_min ?? 0;
          if (t.resumo.length > 0) temasDisponiveis++;
        }
        const resumo: PapiroMacroAreaResumo = {
          id: ma.id,
          nome: ma.nome,
          slug: ma.slug,
          ordem: ma.ordem,
          stats: { temasTotal, tempoTotalMin, temasDisponiveis },
        };
        if (temasDisponiveis > 0) macroAreasDisponiveis.push(resumo);
        else macroAreasEmProducao.push(resumo);
      }

      return {
        disciplina: { id: d.id, nome: d.nome, slug: d.slug, ordem: d.ordem, criado_em: d.criado_em },
        macroAreasDisponiveis,
        macroAreasEmProducao,
      };
    },
  });
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/hooks/papiro/usePapiroDisciplina.ts
git commit -m "feat(papiro): usePapiroDisciplina — macro_areas de uma disciplina"
```

---

## Task 6: Criar `usePapiroTrilha(macroAreaSlug)`

**Files:**
- Create: `src/hooks/papiro/usePapiroTrilha.ts`

- [ ] **Step 1: Implementar o hook**

Create `src/hooks/papiro/usePapiroTrilha.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PapiroTrilhaData, PapiroTemaComStatus, PapiroPrereqResolvido } from '@/lib/papiro/types';

interface RawMacroAreaTrilha {
  id: string;
  nome: string;
  slug: string;
  disciplina: { slug: string; nome: string } | null;
  tema: Array<{
    id: string;
    macro_area_id: string;
    slug_hierarquico: string;
    nome: string;
    descricao_breve: string | null;
    objetivo_pedagogico: string | null;
    ordem_curricular: number;
    tempo_estudo_min: number | null;
    profundidade_estrat: string | null;
    profundidade_gran: string | null;
    conceitos_principais: unknown;
    mapeamento_paginas: unknown;
    criado_em: string;
    resumo: Array<{ status: string }>;
  }>;
}

interface RawPrereq {
  tema_id: string;
  prereq: { id: string; slug_hierarquico: string; nome: string } | null;
}

export function usePapiroTrilha(macroAreaSlug: string | undefined) {
  return useQuery<PapiroTrilhaData | null>({
    queryKey: ['papiro', 'trilha', macroAreaSlug],
    staleTime: 5 * 60 * 1000,
    enabled: !!macroAreaSlug,
    queryFn: async () => {
      // Q1: macro_area + disciplina + temas (com flag de resumo publicado via embed RLS)
      const { data: macroArea, error: e1 } = await supabase
        .schema('papiro')
        .from('macro_area')
        .select(`
          id, nome, slug,
          disciplina:disciplina!disciplina_id ( slug, nome ),
          tema:tema!macro_area_id (
            id, macro_area_id, slug_hierarquico, nome, descricao_breve,
            objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
            profundidade_estrat, profundidade_gran,
            conceitos_principais, mapeamento_paginas, criado_em,
            resumo:resumo!tema_id ( status )
          )
        `)
        .eq('slug', macroAreaSlug!)
        .maybeSingle();

      if (e1) throw e1;
      if (!macroArea) return null;
      const ma = macroArea as unknown as RawMacroAreaTrilha;

      // Q2: prereqs (todos os temas dessa macro_area)
      const temaIds = ma.tema.map((t) => t.id);
      let prereqsByTema = new Map<string, PapiroPrereqResolvido[]>();
      if (temaIds.length > 0) {
        const { data: rawPrereqs, error: e2 } = await supabase
          .schema('papiro')
          .from('tema_prereq')
          .select(`
            tema_id,
            prereq:tema!prereq_tema_id ( id, slug_hierarquico, nome )
          `)
          .in('tema_id', temaIds);
        if (e2) throw e2;
        for (const p of (rawPrereqs ?? []) as unknown as RawPrereq[]) {
          if (!p.prereq) continue;
          const arr = prereqsByTema.get(p.tema_id) ?? [];
          arr.push({ slug_hierarquico: p.prereq.slug_hierarquico, nome: p.prereq.nome });
          prereqsByTema.set(p.tema_id, arr);
        }
      }

      const temas: PapiroTemaComStatus[] = ma.tema
        .sort((a, b) => a.ordem_curricular - b.ordem_curricular)
        .map((t) => ({
          ...t,
          conceitos_principais: t.conceitos_principais as never,
          mapeamento_paginas: t.mapeamento_paginas as never,
          temResumoPublicado: t.resumo.length > 0,
          prereqs: prereqsByTema.get(t.id) ?? [],
        }));

      const temasTotal = temas.length;
      const tempoTotalMin = temas.reduce((acc, t) => acc + (t.tempo_estudo_min ?? 0), 0);
      const temasDisponiveis = temas.filter((t) => t.temResumoPublicado).length;

      return {
        id: ma.id,
        slug: ma.slug,
        nome: ma.nome,
        disciplinaSlug: ma.disciplina?.slug ?? '',
        disciplinaNome: ma.disciplina?.nome ?? '',
        stats: { temasTotal, tempoTotalMin, temasDisponiveis },
        temas,
      };
    },
  });
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/hooks/papiro/usePapiroTrilha.ts
git commit -m "feat(papiro): usePapiroTrilha — 2 queries paralelas (temas + prereqs)"
```

---

## Task 7: Criar `usePapiroTema(temaSlug)`

**Files:**
- Create: `src/hooks/papiro/usePapiroTema.ts`

- [ ] **Step 1: Implementar o hook**

Create `src/hooks/papiro/usePapiroTema.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  PapiroTemaData,
  PapiroPrereqResolvido,
  PapiroTema,
  PapiroResumo,
  PapiroTemaSibling,
} from '@/lib/papiro/types';

interface RawTema extends PapiroTema {
  macro_area: {
    id: string;
    nome: string;
    slug: string;
    disciplina: { slug: string; nome: string } | null;
    tema: Array<{ id: string; slug_hierarquico: string; nome: string; ordem_curricular: number }>;
  } | null;
  resumo: PapiroResumo[];
}

interface RawPrereqTema {
  prereq: { slug_hierarquico: string; nome: string } | null;
}

export function usePapiroTema(temaSlug: string | undefined) {
  return useQuery<PapiroTemaData | null>({
    queryKey: ['papiro', 'tema', temaSlug],
    staleTime: 5 * 60 * 1000,
    enabled: !!temaSlug,
    queryFn: async () => {
      // Q1: tema + resumo + macro_area + disciplina + irmãos (pra prev/next)
      const { data: rawTema, error: e1 } = await supabase
        .schema('papiro')
        .from('tema')
        .select(`
          *,
          macro_area:macro_area!macro_area_id (
            id, nome, slug,
            disciplina:disciplina!disciplina_id ( slug, nome ),
            tema:tema!macro_area_id ( id, slug_hierarquico, nome, ordem_curricular )
          ),
          resumo:resumo!tema_id ( id, tema_id, conteudo_md, conteudo_plate, status, versao, atualizado_em )
        `)
        .eq('slug_hierarquico', temaSlug!)
        .maybeSingle();

      if (e1) throw e1;
      if (!rawTema) return null;
      const tema = rawTema as unknown as RawTema;

      // Q2: prereqs deste tema
      const { data: rawPrereqs, error: e2 } = await supabase
        .schema('papiro')
        .from('tema_prereq')
        .select(`prereq:tema!prereq_tema_id ( slug_hierarquico, nome )`)
        .eq('tema_id', tema.id);
      if (e2) throw e2;
      const prereqs: PapiroPrereqResolvido[] = ((rawPrereqs ?? []) as unknown as RawPrereqTema[])
        .filter((p) => p.prereq !== null)
        .map((p) => ({ slug_hierarquico: p.prereq!.slug_hierarquico, nome: p.prereq!.nome }));

      // Prev/Next pela ordem_curricular dos irmãos
      const irmaos = (tema.macro_area?.tema ?? [])
        .slice()
        .sort((a, b) => a.ordem_curricular - b.ordem_curricular);
      const idx = irmaos.findIndex((t) => t.id === tema.id);
      const prev: PapiroTemaSibling | null = idx > 0 ? irmaos[idx - 1] : null;
      const next: PapiroTemaSibling | null = idx >= 0 && idx < irmaos.length - 1 ? irmaos[idx + 1] : null;

      const resumo: PapiroResumo | null = tema.resumo.length > 0 ? tema.resumo[0] : null;
      const macroAreaSlug = tema.macro_area?.slug ?? '';
      const macroAreaTail = macroAreaSlug.includes('.') ? macroAreaSlug.split('.').slice(1).join('.') : macroAreaSlug;

      // Strip nested arrays do tema "puro"
      const { macro_area: _, resumo: __, ...puro } = tema;

      return {
        tema: puro as PapiroTema,
        resumo,
        prev,
        next,
        prereqs,
        indice: { atual: idx + 1, total: irmaos.length },
        macroAreaNome: tema.macro_area?.nome ?? '',
        macroAreaSlug,
        macroAreaTail,
        disciplinaNome: tema.macro_area?.disciplina?.nome ?? '',
        disciplinaSlug: tema.macro_area?.disciplina?.slug ?? '',
      };
    },
  });
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/hooks/papiro/usePapiroTema.ts
git commit -m "feat(papiro): usePapiroTema — tema + resumo + prev/next + prereqs"
```

---

## Task 8: Criar `components/papiro/papiro.css`

**Files:**
- Create: `src/components/papiro/papiro.css`
- Modify: `src/index.css` (import)

- [ ] **Step 1: Criar arquivo CSS**

Create `src/components/papiro/papiro.css`:

```css
/* PAPIRO — estilos locais escopados em .papiro-* */

/* Cores PAPIRO (sage/cream) — usadas via classes Tailwind arbitrary nos componentes,
   mas algumas precisam aqui pelo cascade do focal mobile. */

/* === Mobile focal do leitor === */
@media (max-width: 768px) {
  .papiro-leitor-mobile-focal {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #fff;
    overflow-y: auto;
  }
  body.papiro-leitor-open {
    overflow: hidden;
  }
}
@media (min-width: 769px) {
  .papiro-leitor-topbar { display: none !important; }
}

/* === Linha conectora da trilha (otimizada pra grid layout) === */
.papiro-trilha-list {
  position: relative;
}
.papiro-trilha-list::before {
  content: '';
  position: absolute;
  left: 60px;
  top: 18px;
  bottom: 18px;
  width: 1px;
  background: #e5e7eb;
}
@media (max-width: 640px) {
  .papiro-trilha-list::before {
    left: 44px;
  }
}
```

- [ ] **Step 2: Importar no `src/index.css`**

Abrir `src/index.css`. No topo do arquivo, após o `@import "tailwindcss";` (ou na primeira linha se este não existir), adicionar:

```css
@import './components/papiro/papiro.css';
```

Se já houver outros `@import` de CSS locais (ex: `@import './styles/v2-nordic.css';`), agrupar o novo `@import` com eles.

- [ ] **Step 3: Type-check (CSS não bloqueia, mas garantir que index.css ainda carrega)**

Run: `npm run build` — para verificar.

Expected: build passa.

- [ ] **Step 4: Commit**

```bash
git add src/components/papiro/papiro.css src/index.css
git commit -m "feat(papiro): CSS local com mobile focal + trilha connector"
```

---

## Task 9: Criar `components/papiro/TrilhaHeader.tsx` e `TrilhaItem.tsx`

**Files:**
- Create: `src/components/papiro/TrilhaHeader.tsx`
- Create: `src/components/papiro/TrilhaItem.tsx`

- [ ] **Step 1: Criar `TrilhaHeader.tsx`**

Create `src/components/papiro/TrilhaHeader.tsx`:

```tsx
import type { PapiroStats } from '@/lib/papiro/types';

interface Props {
  kicker?: string;
  title: string;
  sub?: string;
  stats: PapiroStats;
}

function formatTempo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function TrilhaHeader({ kicker, title, sub, stats }: Props) {
  const pct = stats.temasTotal > 0
    ? Math.round((stats.temasDisponiveis / stats.temasTotal) * 100)
    : 0;

  return (
    <header className="mb-8">
      {kicker && (
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {kicker}
        </div>
      )}
      <h1 className="m-0 mb-3 text-3xl font-semibold leading-tight tracking-tight text-stone-950">
        {title}
      </h1>
      {sub && <p className="mb-6 max-w-lg text-sm leading-relaxed text-stone-600">{sub}</p>}

      <div className="mb-3 flex flex-wrap gap-6 text-[13px] text-stone-500">
        <div><span className="font-semibold text-stone-900">{stats.temasTotal}</span> temas</div>
        <div><span className="font-semibold text-stone-900">{formatTempo(stats.tempoTotalMin)}</span> de conteúdo</div>
        <div><span className="font-semibold text-stone-900">{stats.temasDisponiveis}</span> disponível agora</div>
      </div>
      <div className="mb-2 h-[3px] w-full overflow-hidden rounded-full bg-stone-100">
        <span className="block h-full rounded-full bg-[#6b8e5a]" style={{ width: `${pct}%` }} />
      </div>
      <p className="m-0 text-xs text-stone-400">
        {stats.temasDisponiveis} de {stats.temasTotal} publicados · a trilha cresce conforme novos resumos saem
      </p>
    </header>
  );
}
```

- [ ] **Step 2: Criar `TrilhaItem.tsx`**

Create `src/components/papiro/TrilhaItem.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { temaUrl } from '@/lib/papiro/slug';
import type { PapiroTemaComStatus } from '@/lib/papiro/types';

interface Props {
  tema: PapiroTemaComStatus;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2.5,6.5 5,9 9.5,3.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor">
      <polygon points="2,1 9,5 2,9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.4}>
      <circle cx="7" cy="7" r="5.5" />
      <polyline points="7,4 7,7 9.5,8.5" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <path d="M3.5 8.5 L8.5 3.5 M5 3.5 L8.5 3.5 L8.5 7" />
    </svg>
  );
}

export function TrilhaItem({ tema }: Props) {
  const ord = String(tema.ordem_curricular).padStart(2, '0');
  const href = temaUrl(tema.slug_hierarquico);
  return (
    <li className="grid items-start gap-3.5 py-1.5" style={{ gridTemplateColumns: '34px 26px 1fr' }}>
      <div className="pt-[18px] text-right text-xs font-medium tracking-[0.02em] tabular-nums text-stone-400">
        {ord}
      </div>
      <div
        className={`relative z-[2] mt-3 flex h-[26px] w-[26px] items-center justify-center rounded-full ${
          tema.temResumoPublicado ? 'bg-[#6b8e5a]' : 'border-[1.5px] border-stone-200 bg-white'
        }`}
      >
        {tema.temResumoPublicado && <CheckIcon />}
      </div>
      <Link
        to={href}
        className="block rounded-lg border border-[#f1f5f4] bg-white px-[18px] py-3.5 transition-colors hover:border-stone-200 hover:shadow-sm"
      >
        <h3 className="m-0 mb-2 text-[14.5px] font-semibold leading-tight tracking-tight text-stone-950">
          {tema.nome}
        </h3>
        <div className="flex flex-wrap items-center gap-3.5 text-xs">
          {tema.temResumoPublicado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f0e2] px-2 py-0.5 text-[11.5px] font-medium text-[#4a7050]">
              <PlayIcon /> disponível
            </span>
          ) : (
            <span className="text-[11.5px] font-medium text-stone-500">em breve</span>
          )}
          <span className="inline-flex items-center gap-1.5 tabular-nums text-stone-500">
            <ClockIcon />
            {tema.tempo_estudo_min ?? '?'} min
          </span>
          {tema.prereqs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-stone-500">
              <ArrowUpRight />
              apoia-se em{' '}
              {tema.prereqs.map((p, i) => (
                <span key={p.slug_hierarquico}>
                  <Link
                    to={temaUrl(p.slug_hierarquico)}
                    className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-500"
                  >
                    {p.nome}
                  </Link>
                  {i < tema.prereqs.length - 1 ? ', ' : ''}
                </span>
              ))}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/papiro/TrilhaHeader.tsx src/components/papiro/TrilhaItem.tsx
git commit -m "feat(papiro): TrilhaHeader + TrilhaItem (trilha v4 — branco, número fora, prereqs)"
```

---

## Task 10: Criar `components/papiro/DisciplinaCard.tsx` e `MacroAreaCard.tsx`

**Files:**
- Create: `src/components/papiro/DisciplinaCard.tsx`
- Create: `src/components/papiro/MacroAreaCard.tsx`

- [ ] **Step 1: Criar `DisciplinaCard.tsx`**

Create `src/components/papiro/DisciplinaCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { disciplinaUrl } from '@/lib/papiro/slug';
import type { PapiroDisciplinaResumo } from '@/lib/papiro/types';

interface Props {
  disciplina: PapiroDisciplinaResumo;
  coming?: boolean;
}

export function DisciplinaCard({ disciplina, coming = false }: Props) {
  const meta = coming
    ? 'curadoria em andamento'
    : `${disciplina.macroAreasCount} área${disciplina.macroAreasCount === 1 ? '' : 's'} · ${disciplina.stats.temasTotal} temas`;

  const content = (
    <>
      <div className="flex-1">
        <h4 className="m-0 text-[16px] font-semibold tracking-tight text-stone-950">
          {disciplina.nome}
        </h4>
        <div className="mt-1 text-[11.5px] text-stone-500">
          {meta}
          {!coming && disciplina.stats.temasDisponiveis > 0 && (
            <>
              {' · '}
              <span className="font-medium text-[#4a7050]">
                {disciplina.stats.temasDisponiveis} disponível
              </span>
            </>
          )}
        </div>
      </div>
      {coming ? (
        <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-stone-500">
          em breve
        </span>
      ) : (
        <span className="text-base text-stone-300">›</span>
      )}
    </>
  );

  const classes =
    'flex items-center justify-between rounded-lg border px-[22px] py-[18px] transition-all';

  if (coming) {
    return (
      <div className={`${classes} cursor-default border-dashed border-stone-200 bg-stone-50`}>
        {content}
      </div>
    );
  }
  return (
    <Link
      to={disciplinaUrl(disciplina.slug)}
      className={`${classes} border-[#ece8de] bg-white hover:-translate-y-px hover:border-[#c8d6c3] hover:shadow-sm`}
    >
      {content}
    </Link>
  );
}
```

- [ ] **Step 2: Criar `MacroAreaCard.tsx`**

Create `src/components/papiro/MacroAreaCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { macroAreaUrl } from '@/lib/papiro/slug';
import type { PapiroMacroAreaResumo } from '@/lib/papiro/types';

interface Props {
  macroArea: PapiroMacroAreaResumo;
  coming?: boolean;
}

function formatTempo(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function MacroAreaCard({ macroArea, coming = false }: Props) {
  const { stats } = macroArea;
  const pct = stats.temasTotal > 0
    ? Math.round((stats.temasDisponiveis / stats.temasTotal) * 100)
    : 0;

  const inner = (
    <>
      <div className="flex-1">
        <h4 className="m-0 text-[16px] font-semibold tracking-tight text-stone-950">
          {macroArea.nome}
        </h4>
        {coming ? (
          <div className="mt-1 text-[11.5px] text-stone-500">curadoria em andamento</div>
        ) : (
          <>
            <div className="mt-1.5 flex flex-wrap gap-2.5 text-[11px] text-stone-500">
              <span><strong className="font-semibold text-stone-950">{stats.temasTotal}</strong> temas</span>
              <span className="text-stone-300">·</span>
              <span><strong className="font-semibold text-stone-950">{formatTempo(stats.tempoTotalMin)}</strong></span>
              <span className="text-stone-300">·</span>
              <span><strong className="font-semibold text-[#4a7050]">{stats.temasDisponiveis}</strong> disponível</span>
            </div>
            <div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-stone-100">
              <span className="block h-full bg-[#6b8e5a]" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>
      {coming ? (
        <span className="ml-3 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-stone-500">em breve</span>
      ) : (
        <span className="ml-3.5 text-base text-stone-300">›</span>
      )}
    </>
  );

  const base = 'flex items-center justify-between rounded-lg border px-[22px] py-[18px] transition-all';
  if (coming) {
    return <div className={`${base} cursor-default border-dashed border-stone-200 bg-stone-50`}>{inner}</div>;
  }
  return (
    <Link
      to={macroAreaUrl(macroArea.slug)}
      className={`${base} border-[#ece8de] bg-white hover:-translate-y-px hover:border-[#c8d6c3] hover:shadow-sm`}
    >
      {inner}
    </Link>
  );
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/papiro/DisciplinaCard.tsx src/components/papiro/MacroAreaCard.tsx
git commit -m "feat(papiro): DisciplinaCard + MacroAreaCard com estados disponível/coming"
```

---

## Task 11: Criar `components/papiro/TemaSemResumoPreview.tsx`

**Files:**
- Create: `src/components/papiro/TemaSemResumoPreview.tsx`

- [ ] **Step 1: Criar componente**

Create `src/components/papiro/TemaSemResumoPreview.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { PapiroTema, PapiroPrereqResolvido } from '@/lib/papiro/types';
import { temaUrl } from '@/lib/papiro/slug';

interface Props {
  tema: PapiroTema;
  prereqs: PapiroPrereqResolvido[];
}

export function TemaSemResumoPreview({ tema, prereqs }: Props) {
  const conceitos = Array.isArray(tema.conceitos_principais)
    ? (tema.conceitos_principais as unknown as string[])
    : [];

  return (
    <div className="space-y-6">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-500">
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={1.4}>
          <circle cx="6" cy="6" r="4.5" />
        </svg>
        em breve
      </span>

      {prereqs.length > 0 && (
        <section>
          <h4 className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Apoia-se em
          </h4>
          <p className="m-0 text-[13px] leading-relaxed text-stone-700">
            {prereqs.map((p, i) => (
              <span key={p.slug_hierarquico}>
                <Link
                  to={temaUrl(p.slug_hierarquico)}
                  className="text-stone-800 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-500"
                >
                  {p.nome}
                </Link>
                {i < prereqs.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        </section>
      )}

      {tema.objetivo_pedagogico && (
        <section>
          <h4 className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Objetivo
          </h4>
          <p className="m-0 text-[13.5px] leading-relaxed text-stone-700">
            {tema.objetivo_pedagogico}
          </p>
        </section>
      )}

      {conceitos.length > 0 && (
        <section>
          <h4 className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            O que vai cobrir
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {conceitos.map((c, i) => (
              <span
                key={i}
                className="rounded-full border border-stone-100 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-700"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/papiro/TemaSemResumoPreview.tsx
git commit -m "feat(papiro): TemaSemResumoPreview — preview rico SEM fontes (admin only)"
```

---

## Task 12: Criar `LeitorTopbar.tsx` e `LeitorNavRodape.tsx`

**Files:**
- Create: `src/components/papiro/LeitorTopbar.tsx`
- Create: `src/components/papiro/LeitorNavRodape.tsx`

- [ ] **Step 1: Criar `LeitorTopbar.tsx`**

Create `src/components/papiro/LeitorTopbar.tsx`:

```tsx
import { Link } from 'react-router-dom';

interface Props {
  onExitHref: string;       // pra onde o × leva (rota da trilha)
  indice: { atual: number; total: number };
}

/**
 * Visível somente em mobile (via media query em papiro.css).
 * Em desktop tem `display: none !important`.
 */
export function LeitorTopbar({ onExitHref, indice }: Props) {
  return (
    <div className="papiro-leitor-topbar flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5 text-[11px] text-stone-600">
      <Link to={onExitHref} aria-label="Sair do leitor" className="text-base text-stone-900 hover:text-stone-700">
        ×
      </Link>
      <span>
        Tema <strong className="font-semibold text-stone-900">{indice.atual}</strong> de {indice.total}
      </span>
      <span className="w-4" />
    </div>
  );
}
```

- [ ] **Step 2: Criar `LeitorNavRodape.tsx`**

Create `src/components/papiro/LeitorNavRodape.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { temaUrl } from '@/lib/papiro/slug';
import type { PapiroTemaSibling } from '@/lib/papiro/types';

interface Props {
  prev: PapiroTemaSibling | null;
  next: PapiroTemaSibling | null;
}

export function LeitorNavRodape({ prev, next }: Props) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-[11px] text-stone-500">
      <div className="flex flex-col gap-px">
        <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400">
          ‹ Anterior
        </span>
        {prev ? (
          <Link
            to={temaUrl(prev.slug_hierarquico)}
            className="font-medium text-stone-800 hover:text-stone-950"
          >
            {String(prev.ordem_curricular).padStart(2, '0')} · {prev.nome}
          </Link>
        ) : (
          <span className="font-medium text-stone-400">—</span>
        )}
      </div>
      <div className="flex flex-col gap-px text-right">
        <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400">
          Próximo ›
        </span>
        {next ? (
          <Link
            to={temaUrl(next.slug_hierarquico)}
            className="font-medium text-stone-800 hover:text-stone-950"
          >
            {String(next.ordem_curricular).padStart(2, '0')} · {next.nome}
          </Link>
        ) : (
          <span className="font-medium text-stone-400">—</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/papiro/LeitorTopbar.tsx src/components/papiro/LeitorNavRodape.tsx
git commit -m "feat(papiro): LeitorTopbar (mobile-only) + LeitorNavRodape (prev/next)"
```

---

## Task 13: Criar `PapiroIndexPage.tsx`

**Files:**
- Create: `src/views/papiro/PapiroIndexPage.tsx`

- [ ] **Step 1: Criar a page**

Create `src/views/papiro/PapiroIndexPage.tsx`:

```tsx
import { usePapiroDisciplinas } from '@/hooks/papiro/usePapiroDisciplinas';
import { DisciplinaCard } from '@/components/papiro/DisciplinaCard';

export default function PapiroIndexPage() {
  const { data, isLoading, error } = usePapiroDisciplinas();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-stone-500">Carregando…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-red-600">Erro ao carregar disciplinas.</div>
      </div>
    );
  }
  const { disponiveis, emProducao } = data;

  return (
    <div className="mx-auto max-w-[880px] rounded-2xl bg-white px-14 pb-16 pt-12">
      <header className="mb-11">
        <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Papiro
        </div>
        <h1 className="m-0 mb-3 text-4xl font-semibold leading-tight tracking-tight text-stone-950">
          Estudar
        </h1>
        <p className="m-0 max-w-xl text-[15px] leading-relaxed text-stone-600">
          Trilhas curadas por disciplina, com resumos integrados às fontes do seu edital.
        </p>
      </header>

      <Section title="Disponíveis" count={disponiveis.length}>
        {disponiveis.map((d) => (
          <DisciplinaCard key={d.id} disciplina={d} />
        ))}
      </Section>

      {emProducao.length > 0 && (
        <Section title="Em produção" count={emProducao.length}>
          {emProducao.map((d) => (
            <DisciplinaCard key={d.id} disciplina={d} coming />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-12 last:mb-0">
      <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3.5">
        <h3 className="m-0 text-[13px] font-semibold tracking-tight text-stone-700">{title}</h3>
        <span className="text-[11px] tabular-nums text-stone-400">
          {count} {count === 1 ? 'matéria' : 'matérias'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/views/papiro/PapiroIndexPage.tsx
git commit -m "feat(papiro): PapiroIndexPage — /estudar com disponíveis + em produção"
```

---

## Task 14: Criar `PapiroDisciplinaPage.tsx`

**Files:**
- Create: `src/views/papiro/PapiroDisciplinaPage.tsx`

- [ ] **Step 1: Criar a page**

Create `src/views/papiro/PapiroDisciplinaPage.tsx`:

```tsx
import { Navigate, useParams, Link } from 'react-router-dom';
import { isValidSlug } from '@/lib/papiro/slug';
import { usePapiroDisciplina } from '@/hooks/papiro/usePapiroDisciplina';
import { MacroAreaCard } from '@/components/papiro/MacroAreaCard';

export default function PapiroDisciplinaPage() {
  const { disciplinaSlug } = useParams<{ disciplinaSlug: string }>();

  if (!disciplinaSlug || !isValidSlug(disciplinaSlug)) {
    return <Navigate to="/estudar" replace />;
  }

  const { data, isLoading, error } = usePapiroDisciplina(disciplinaSlug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-stone-500">Carregando…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-red-600">Erro ao carregar disciplina.</div>
      </div>
    );
  }
  if (!data) {
    return <Navigate to="/estudar" replace />;
  }

  const { disciplina, macroAreasDisponiveis, macroAreasEmProducao } = data;

  return (
    <div className="mx-auto max-w-[880px] rounded-2xl bg-white px-14 pb-16 pt-12">
      <header className="mb-11">
        <div className="mb-1.5 text-[11px] text-stone-400">
          <Link to="/estudar" className="text-stone-600 hover:text-stone-900">‹ Estudar</Link>
        </div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Disciplina
        </div>
        <h1 className="m-0 mb-3 text-3xl font-semibold leading-tight tracking-tight text-stone-950">
          {disciplina.nome}
        </h1>
        <p className="m-0 max-w-lg text-[15px] leading-relaxed text-stone-600">
          Áreas de estudo cobertas pela trilha de {disciplina.nome}.
        </p>
      </header>

      <Section title="Disponíveis" count={macroAreasDisponiveis.length}>
        {macroAreasDisponiveis.map((m) => (
          <MacroAreaCard key={m.id} macroArea={m} />
        ))}
      </Section>

      {macroAreasEmProducao.length > 0 && (
        <Section title="Em produção" count={macroAreasEmProducao.length}>
          {macroAreasEmProducao.map((m) => (
            <MacroAreaCard key={m.id} macroArea={m} coming />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-12 last:mb-0">
      <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3.5">
        <h3 className="m-0 text-[13px] font-semibold tracking-tight text-stone-700">{title}</h3>
        <span className="text-[11px] tabular-nums text-stone-400">
          {count} {count === 1 ? 'área' : 'áreas'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/views/papiro/PapiroDisciplinaPage.tsx
git commit -m "feat(papiro): PapiroDisciplinaPage — /estudar/:disciplinaSlug"
```

---

## Task 15: Criar `PapiroTrilhaPage.tsx`

**Files:**
- Create: `src/views/papiro/PapiroTrilhaPage.tsx`

- [ ] **Step 1: Criar a page**

Create `src/views/papiro/PapiroTrilhaPage.tsx`:

```tsx
import { Navigate, useParams, Link } from 'react-router-dom';
import { isValidSlug, buildMacroAreaSlug } from '@/lib/papiro/slug';
import { usePapiroTrilha } from '@/hooks/papiro/usePapiroTrilha';
import { TrilhaHeader } from '@/components/papiro/TrilhaHeader';
import { TrilhaItem } from '@/components/papiro/TrilhaItem';

export default function PapiroTrilhaPage() {
  const { disciplinaSlug, macroAreaTail } = useParams<{ disciplinaSlug: string; macroAreaTail: string }>();

  if (
    !disciplinaSlug || !macroAreaTail ||
    !isValidSlug(disciplinaSlug) || !isValidSlug(macroAreaTail)
  ) {
    return <Navigate to="/estudar" replace />;
  }

  const slug = buildMacroAreaSlug(disciplinaSlug, macroAreaTail);
  const { data, isLoading, error } = usePapiroTrilha(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[760px] px-14 py-12">
        <div className="text-sm text-stone-500">Carregando trilha…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[760px] px-14 py-12">
        <div className="text-sm text-red-600">Erro ao carregar a trilha.</div>
      </div>
    );
  }
  if (!data) {
    return <Navigate to={`/estudar/${disciplinaSlug}`} replace />;
  }

  return (
    <div className="mx-auto max-w-[760px] rounded-2xl bg-white px-11 pb-14 pt-10">
      <div className="mb-3 text-[11px] text-stone-400">
        <Link to="/estudar" className="text-stone-600 hover:text-stone-900">Estudar</Link>
        {' › '}
        <Link to={`/estudar/${data.disciplinaSlug}`} className="text-stone-600 hover:text-stone-900">
          {data.disciplinaNome}
        </Link>
      </div>
      <TrilhaHeader
        kicker={data.disciplinaNome}
        title={data.nome}
        sub={`${data.stats.temasTotal} temas · trilha curada a partir das fontes do edital.`}
        stats={data.stats}
      />
      <ol className="papiro-trilha-list m-0 list-none p-0">
        {data.temas.map((t) => (
          <TrilhaItem key={t.id} tema={t} />
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/views/papiro/PapiroTrilhaPage.tsx
git commit -m "feat(papiro): PapiroTrilhaPage — trilha v4 dos temas da macro_area"
```

---

## Task 16: Criar `PapiroLeitorPage.tsx`

**Files:**
- Create: `src/views/papiro/PapiroLeitorPage.tsx`

- [ ] **Step 1: Criar a page**

Create `src/views/papiro/PapiroLeitorPage.tsx`:

```tsx
import { useEffect } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { isValidSlug, buildTemaSlug } from '@/lib/papiro/slug';
import { usePapiroTema } from '@/hooks/papiro/usePapiroTema';
import { TemaSemResumoPreview } from '@/components/papiro/TemaSemResumoPreview';
import { LeitorTopbar } from '@/components/papiro/LeitorTopbar';
import { LeitorNavRodape } from '@/components/papiro/LeitorNavRodape';
import { ResumoLeitor } from '@/v3/components/resumos/ResumoLeitor';
import type { Value } from 'platejs';

export default function PapiroLeitorPage() {
  const { disciplinaSlug, macroAreaTail, temaTail } = useParams<{
    disciplinaSlug: string;
    macroAreaTail: string;
    temaTail: string;
  }>();

  // Aplica .papiro-leitor-open no body só enquanto montado (overflow:hidden no mobile)
  useEffect(() => {
    document.body.classList.add('papiro-leitor-open');
    return () => document.body.classList.remove('papiro-leitor-open');
  }, []);

  if (
    !disciplinaSlug || !macroAreaTail || !temaTail ||
    !isValidSlug(disciplinaSlug) || !isValidSlug(macroAreaTail) || !isValidSlug(temaTail)
  ) {
    return <Navigate to="/estudar" replace />;
  }

  const slug = buildTemaSlug(disciplinaSlug, macroAreaTail, temaTail);
  const { data, isLoading, error } = usePapiroTema(slug);

  const trilhaHref = `/estudar/${disciplinaSlug}/${macroAreaTail}`;

  if (isLoading) {
    return (
      <article className="papiro-leitor-mobile-focal mx-auto max-w-[760px] px-8 py-10">
        <div className="text-sm text-stone-500">Carregando tema…</div>
      </article>
    );
  }
  if (error) {
    return (
      <article className="papiro-leitor-mobile-focal mx-auto max-w-[760px] px-8 py-10">
        <div className="text-sm text-red-600">Erro ao carregar tema.</div>
      </article>
    );
  }
  if (!data) {
    return <Navigate to={trilhaHref} replace />;
  }

  const { tema, resumo, prev, next, prereqs, indice, macroAreaNome, disciplinaNome } = data;
  const temResumo = resumo !== null && resumo.conteudo_plate !== null;

  return (
    <article className="papiro-leitor-mobile-focal mx-auto max-w-[760px] bg-white">
      <LeitorTopbar onExitHref={trilhaHref} indice={indice} />
      <div className="px-8 pb-12 pt-7">
        <div className="mb-3 text-[11px] text-stone-400">
          <Link to="/estudar" className="text-stone-600 hover:text-stone-900">Estudar</Link>
          {' › '}
          <Link to={`/estudar/${disciplinaSlug}`} className="text-stone-600 hover:text-stone-900">
            {disciplinaNome}
          </Link>
          {' › '}
          <Link to={trilhaHref} className="text-stone-600 hover:text-stone-900">
            {macroAreaNome}
          </Link>
        </div>
        <h1 className="m-0 mb-1.5 text-2xl font-bold leading-tight tracking-tight text-stone-950">
          {tema.nome}
        </h1>
        <div className="mb-5 border-b border-stone-100 pb-4 text-[11px] text-stone-500">
          Tema {tema.ordem_curricular} · {tema.tempo_estudo_min ?? '?'} min
        </div>

        {temResumo ? (
          <ResumoLeitor conteudo={resumo.conteudo_plate as unknown as Value} />
        ) : (
          <TemaSemResumoPreview tema={tema} prereqs={prereqs} />
        )}

        <LeitorNavRodape prev={prev} next={next} />
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/views/papiro/PapiroLeitorPage.tsx
git commit -m "feat(papiro): PapiroLeitorPage — leitor focal mobile + ResumoLeitor v3 reusado"
```

---

## Task 17: Adicionar 4 rotas em `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Adicionar imports**

Em `src/App.tsx`, perto dos outros imports de views (próximo à linha 60), adicione:

```tsx
import PapiroIndexPage from './views/papiro/PapiroIndexPage';
import PapiroDisciplinaPage from './views/papiro/PapiroDisciplinaPage';
import PapiroTrilhaPage from './views/papiro/PapiroTrilhaPage';
import PapiroLeitorPage from './views/papiro/PapiroLeitorPage';
```

- [ ] **Step 2: Adicionar as 4 rotas**

No `<Routes>` (dentro do `<Route path="/" element={<AppContent />}>`), adicione próximo às outras rotas (sugestão: depois da rota `flashcards`):

```tsx
<Route path="estudar" element={<PrivateRoute><PapiroIndexPage /></PrivateRoute>} />
<Route path="estudar/:disciplinaSlug" element={<PrivateRoute><PapiroDisciplinaPage /></PrivateRoute>} />
<Route path="estudar/:disciplinaSlug/:macroAreaTail" element={<PrivateRoute><PapiroTrilhaPage /></PrivateRoute>} />
<Route path="estudar/:disciplinaSlug/:macroAreaTail/:temaTail" element={<PrivateRoute><PapiroLeitorPage /></PrivateRoute>} />
```

- [ ] **Step 3: Build pra validar**

Run: `npm run build`

Expected: build completa sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(papiro): registra 4 rotas /estudar/* em App.tsx"
```

---

## Task 18: Adicionar item "Estudar" no `AppTopNav`

**Files:**
- Modify: `src/components/AppTopNav.tsx`

- [ ] **Step 1: Adicionar import do ícone**

Em `src/components/AppTopNav.tsx`, no bloco de imports de `@tabler/icons-react` (linhas 5-26), adicione:

```tsx
IconBook2,
```

(Coloque junto aos outros, em ordem alfabética ou no fim do bloco.)

- [ ] **Step 2: Adicionar item no `mainNavigation`**

No array `mainNavigation` (linhas 59-74), adicione como 2º item:

```tsx
const mainNavigation: NavItem[] = [
  { label: "Início", href: "/", icon: <IconHome className="h-4 w-4" /> },
  { label: "Estudar", href: "/estudar", icon: <IconBook2 className="h-4 w-4" /> },   // ← NOVO
  {
    label: "Flashcards",
    href: "/flashcards",
    icon: <IconPlayerPlay className="h-4 w-4" />,
    subItems: [
      { label: "Meus Decks", href: "/flashcards" },
      { label: "Modo Estudo", href: "/study" },
    ],
  },
  // ... resto inalterado
];
```

- [ ] **Step 3: Build pra validar**

Run: `npm run build`

Expected: build completa sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppTopNav.tsx
git commit -m "feat(papiro): item 'Estudar' no AppTopNav (2ª posição, IconBook2)"
```

---

## Task 19: Smoke manual end-to-end

**Files:** nenhum modificado nesta task — validação manual.

- [ ] **Step 1: Iniciar dev server**

Run: `npm run dev`

Expected: server up em http://localhost:3000.

- [ ] **Step 2: Login**

Abrir http://localhost:3000/auth, logar com `aldemirlima.adv@gmail.com` / `Groov@123` (ou outro user de teste). Verificar que cai na home.

- [ ] **Step 3: Navegação esperada**

Cliques esperados (em http://localhost:3000):

1. Clicar em **"Estudar"** no AppTopNav → vai pra `/estudar`. Vê: 1 card "Informática" disponível, 0 em produção.
2. Clicar no card **"Informática"** → vai pra `/estudar/informatica`. Vê: 1 card "Redes e Internet" disponível, 0 em produção (com stats "22 temas · 17h 30min · 0 disponível"), 0 em produção.
3. Clicar no card **"Redes e Internet"** → vai pra `/estudar/informatica/redes_internet`. Vê: header "Redes e Internet" + barra de progresso (0%) + 22 temas em ordem, todos "em breve", com prereqs como "apoia-se em *X*".
4. Clicar no tema **"01 · Fundamentos de Redes"** → vai pra `/estudar/informatica/redes_internet/fundamentos_redes`. Vê: breadcrumb + título + meta + tag "em breve" + sections "Objetivo" + "O que vai cobrir" (chips com `conceitos_principais`). Sem fontes. Sem ResumoLeitor renderizado (porque `resumo` é null).
5. Clicar em **"Próximo › 02 · Classificação"** → vai pro próximo tema. Verifica que prev/next funciona.

- [ ] **Step 4: Rotas inválidas**

Testar manualmente as URLs:
- `/estudar/foo` → redirect pra `/estudar`
- `/estudar/informatica/bar` → redirect pra `/estudar/informatica`
- `/estudar/informatica/redes_internet/baz` → redirect pra `/estudar/informatica/redes_internet`
- `/estudar/INFORMATICA` (caps) → redirect pra `/estudar` (isValidSlug false)

- [ ] **Step 5: Estado "disponível" via INSERT manual**

Conectar no Supabase Studio (https://supabase.com/dashboard/project/xmtleqquivcukwgdexhc/sql/new) e rodar:

```sql
INSERT INTO papiro.resumo (tema_id, conteudo_plate, status)
SELECT id, '[{"type":"p","children":[{"text":"Resumo de teste do tema Fundamentos de Redes."}]}]'::jsonb, 'publicado'
FROM papiro.tema
WHERE slug_hierarquico = 'informatica.redes_internet.fundamentos_redes';
```

Voltar ao browser, recarregar `/estudar/informatica/redes_internet`. Esperado:
- Header mostra "1 disponível agora"
- Barra de progresso ≈ 4.5%
- Nodo do tema 01 fica verde com ✓; chip "▶ disponível"
- Demais 21 temas continuam "em breve"

Abrir `/estudar/informatica/redes_internet/fundamentos_redes` — agora vê `<ResumoLeitor>` renderizando "Resumo de teste do tema..." em vez do preview pedagógico.

Verificar que tela `/estudar` mostra Informática como disponível (já estava), e `/estudar/informatica` mostra Redes como disponível.

- [ ] **Step 6: Mobile focal**

Abrir DevTools (F12) → Device Toolbar → emular iPhone (375×812).

- `/estudar`, `/estudar/informatica`, `/estudar/informatica/redes_internet` — visíveis com AppTopNav (responsivo).
- `/estudar/informatica/redes_internet/fundamentos_redes` — vira full-screen: AppTopNav coberto, LeitorTopbar visível com "× sair" e "Tema 1 de 22". Body não scrolla atrás.
- Clicar no "×" — volta pra `/estudar/informatica/redes_internet`.

- [ ] **Step 7: Regressão**

Validar que rotas existentes continuam funcionando:
- `/` → Home OK
- `/flashcards` → OK
- `/lei-seca` → OK
- `/cronograma` → OK
- `/resumos-list` (legacy) → OK
- `/cadernos` → OK

- [ ] **Step 8: Limpar dado de teste**

No SQL Editor:
```sql
DELETE FROM papiro.resumo
WHERE tema_id = (SELECT id FROM papiro.tema WHERE slug_hierarquico = 'informatica.redes_internet.fundamentos_redes');
```

Confirmar contagem `papiro.resumo` = 0 de novo.

- [ ] **Step 9: Build final**

Run: `npm run build`

Expected: build completa sem erros TS.

- [ ] **Step 10: Commit final (se houver ajustes do smoke)**

Se algum ajuste de bug surgir no smoke, fazer commits separados pequenos antes deste passo.

```bash
git status
# se houver mudanças residuais (ex: import faltando):
git add <files>
git commit -m "fix(papiro): ajustes do smoke manual"
```

Se nada residual, pular. O commit do "papiro: tela do aluno V1 completa" não é necessário porque cada Task fez seu próprio commit semântico.

---

## Notas finais

- **Sem testes E2E nesta V1** — esperar a tela assentar; agora seria testar algo que ainda pode ajustar.
- **Sem mexer no `isStudyMode`** em `App.tsx` — o focal mobile é puramente CSS, decisão deliberada da spec.
- **Item legacy "Resumos"** (`/resumos-list` em `moreItems`) continua intacto — destino fica pra quando o editor PAPIRO entrar.
- **Próxima fase**: editor admin PAPIRO. Brainstorm + spec + plano próprios.

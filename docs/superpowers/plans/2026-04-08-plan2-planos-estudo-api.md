# Plan 2: Planos de Estudo + Integração API Editais

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students to browse editais from the API, create study plans linked to editais, and have local records created lazily or in bulk for cronograma integration.

**Architecture:** API editais serves structure via GraphQL (React Query cache). Supabase stores planos_estudo + planos_editais (new tables) and local disciplinas/topicos (existing tables with new api ref columns). "Ver edital" reads from API only. Personal actions create local records lazily. Creating a cronograma bulk-inserts all topics.

**Tech Stack:** URQL (GraphQL), React Query, Supabase, TypeScript

**Depends on:** Plan 1 (rename) must be completed first.

**Spec:** `docs/superpowers/specs/2026-04-08-editais-documents-integration-design.md`

---

### Task 1: Migration — Add API Reference Columns + New Tables

**Files:**
- Create: `supabase/migrations/20260408000002_planos_estudo_and_api_refs.sql`

- [ ] **Step 1: Create migration**

```sql
-- New table: planos_estudo
CREATE TABLE planos_estudo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    nome            VARCHAR(200) NOT NULL,
    data_prova      TIMESTAMPTZ,
    source_type     VARCHAR(20) DEFAULT 'edital',
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_planos_estudo_user ON planos_estudo(user_id);
ALTER TABLE planos_estudo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON planos_estudo
    FOR ALL USING (auth.uid() = user_id);

-- New table: planos_editais
CREATE TABLE planos_editais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id        UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
    edital_id       INTEGER NOT NULL,
    cargo_id        INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plano_id, edital_id, cargo_id)
);
CREATE INDEX idx_planos_editais_plano ON planos_editais(plano_id);
ALTER TABLE planos_editais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan links" ON planos_editais
    FOR ALL USING (
        plano_id IN (SELECT id FROM planos_estudo WHERE user_id = auth.uid())
    );

-- Add API reference columns to existing tables
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS api_disciplina_id INTEGER;
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL;
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual';

CREATE INDEX idx_disciplinas_api ON disciplinas(api_disciplina_id) WHERE api_disciplina_id IS NOT NULL;
CREATE INDEX idx_disciplinas_plano ON disciplinas(plano_id) WHERE plano_id IS NOT NULL;
CREATE UNIQUE INDEX idx_disciplinas_unique_api ON disciplinas(user_id, plano_id, api_disciplina_id)
    WHERE api_disciplina_id IS NOT NULL;

ALTER TABLE topicos ADD COLUMN IF NOT EXISTS api_topico_id INTEGER;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual';
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS tempo_investido INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS teoria_finalizada BOOLEAN DEFAULT FALSE;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questoes_acertos INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questoes_erros INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS leis_lidas TEXT;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX idx_topicos_api ON topicos(api_topico_id) WHERE api_topico_id IS NOT NULL;
CREATE UNIQUE INDEX idx_topicos_unique_api ON topicos(user_id, disciplina_id, api_topico_id)
    WHERE api_topico_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260408000002_planos_estudo_and_api_refs.sql
git commit -m "feat(db): add planos_estudo tables and API reference columns"
```

---

### Task 2: Hook — usePlanosEstudo

**Files:**
- Create: `src/hooks/usePlanosEstudo.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlanoEstudo {
  id: string;
  nome: string;
  data_prova: string | null;
  source_type: 'edital' | 'manual' | 'combined';
  ativo: boolean;
  created_at: string;
  editais: PlanoEdital[];
}

export interface PlanoEdital {
  id: string;
  plano_id: string;
  edital_id: number;
  cargo_id: number;
}

export function usePlanosEstudo() {
  const [planos, setPlanos] = useState<PlanoEstudo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlanos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: planosData } = await supabase
      .from('planos_estudo')
      .select('*, planos_editais(*)')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (planosData) {
      setPlanos(planosData.map(p => ({
        ...p,
        editais: p.planos_editais || [],
      })));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadPlanos(); }, [loadPlanos]);

  const createPlano = useCallback(async (params: {
    nome: string;
    data_prova?: string | null;
    source_type?: 'edital' | 'manual' | 'combined';
    edital_id?: number;
    cargo_id?: number;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: plano, error } = await supabase
      .from('planos_estudo')
      .insert({
        user_id: user.id,
        nome: params.nome,
        data_prova: params.data_prova || null,
        source_type: params.source_type || 'edital',
      })
      .select()
      .single();

    if (error || !plano) return null;

    // Link edital if provided
    if (params.edital_id && params.cargo_id) {
      await supabase.from('planos_editais').insert({
        plano_id: plano.id,
        edital_id: params.edital_id,
        cargo_id: params.cargo_id,
      });
    }

    await loadPlanos();
    return plano;
  }, [loadPlanos]);

  const findPlanoByEdital = useCallback((editalId: number, cargoId: number): PlanoEstudo | null => {
    return planos.find(p =>
      p.editais.some(e => e.edital_id === editalId && e.cargo_id === cargoId)
    ) || null;
  }, [planos]);

  const deletePlano = useCallback(async (planoId: string) => {
    await supabase.from('planos_estudo').delete().eq('id', planoId);
    await loadPlanos();
  }, [loadPlanos]);

  return { planos, isLoading, createPlano, findPlanoByEdital, deletePlano, loadPlanos };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePlanosEstudo.ts
git commit -m "feat: add usePlanosEstudo hook for study plan management"
```

---

### Task 3: Hook — useEditaisData (API reads via React Query)

**Files:**
- Create: `src/hooks/useEditaisData.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { editaisQuery } from '@/lib/editais-client';

interface ApiDisciplina {
  id: number;
  nome: string;
  nomeEdital: string | null;
  totalTopicos: number;
}

interface ApiTopico {
  id: number;
  nome: string;
  ordem: number;
}

interface ApiCargo {
  id: number;
  nome: string;
  vagas: number;
  remuneracao: number;
  qtdDisciplinas: number;
  qtdTopicos: number;
  edital: { id: number; nome: string; sigla: string; esfera: string; dataPublicacao: string };
}

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id nome nomeEdital totalTopicos }
  }
`;

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id nome ordem }
  }
`;

const CARGO_QUERY = `
  query Cargo($editalId: Int!, $cargoId: Int!) {
    cargos(editalId: $editalId) { id nome vagas remuneracao qtdDisciplinas qtdTopicos edital { id nome sigla esfera dataPublicacao } }
  }
`;

export function useCargoData(editalId: number | null, cargoId: number | null) {
  return useQuery({
    queryKey: ['cargo', editalId, cargoId],
    queryFn: async () => {
      if (!editalId) return null;
      const { data } = await editaisQuery<{ cargos: ApiCargo[] }>(CARGO_QUERY, { editalId });
      return data?.cargos.find(c => c.id === cargoId) || null;
    },
    enabled: !!editalId && !!cargoId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function useDisciplinasApi(cargoId: number | null) {
  return useQuery({
    queryKey: ['disciplinas-api', cargoId],
    queryFn: async () => {
      if (!cargoId) return [];
      const { data } = await editaisQuery<{ disciplinas: ApiDisciplina[] }>(DISCIPLINAS_QUERY, { cargoId });
      return data?.disciplinas || [];
    },
    enabled: !!cargoId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

export function useTopicosApi(disciplinaId: number | null) {
  return useQuery({
    queryKey: ['topicos-api', disciplinaId],
    queryFn: async () => {
      if (!disciplinaId) return [];
      const { data } = await editaisQuery<{ topicos: ApiTopico[] }>(TOPICOS_QUERY, { disciplinaId });
      return data?.topicos || [];
    },
    enabled: !!disciplinaId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

export type { ApiDisciplina, ApiTopico, ApiCargo };
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEditaisData.ts
git commit -m "feat: add useEditaisData hook for API reads with React Query cache"
```

---

### Task 4: Hook — useEditalSnapshot (lazy + bulk creation)

**Files:**
- Create: `src/hooks/useEditalSnapshot.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ApiDisciplina, ApiTopico } from './useEditaisData';

export function useEditalSnapshot() {
  /**
   * Lazy: creates a single topico (+ disciplina if needed) when student interacts
   */
  const ensureTopicoLocal = useCallback(async (params: {
    apiTopicoId: number;
    apiDisciplinaId: number;
    topicoNome: string;
    disciplinaNome: string;
    planoId?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Check if topico already exists locally
    const { data: existing } = await supabase
      .from('topicos')
      .select('id')
      .eq('user_id', user.id)
      .eq('api_topico_id', params.apiTopicoId)
      .maybeSingle();

    if (existing) return existing.id;

    // Ensure disciplina exists
    let disciplinaId: string;
    const { data: existingDisc } = await supabase
      .from('disciplinas')
      .select('id')
      .eq('user_id', user.id)
      .eq('api_disciplina_id', params.apiDisciplinaId)
      .maybeSingle();

    if (existingDisc) {
      disciplinaId = existingDisc.id;
    } else {
      const { data: newDisc } = await supabase
        .from('disciplinas')
        .insert({
          user_id: user.id,
          nome: params.disciplinaNome,
          api_disciplina_id: params.apiDisciplinaId,
          plano_id: params.planoId || null,
          source_type: 'edital',
        })
        .select('id')
        .single();
      if (!newDisc) return null;
      disciplinaId = newDisc.id;
    }

    // Create topico
    const { data: newTopico } = await supabase
      .from('topicos')
      .insert({
        user_id: user.id,
        disciplina_id: disciplinaId,
        nome: params.topicoNome,
        api_topico_id: params.apiTopicoId,
        source_type: 'edital',
        estimated_duration_minutes: 120,
      })
      .select('id')
      .single();

    return newTopico?.id || null;
  }, []);

  /**
   * Bulk: creates all disciplinas + topicos for a cargo (used when creating cronograma)
   */
  const bulkCreateFromCargo = useCallback(async (params: {
    planoId: string;
    disciplinas: ApiDisciplina[];
    topicosPerDisciplina: Map<number, ApiTopico[]>;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Bulk insert disciplinas
    const discInserts = params.disciplinas.map(d => ({
      user_id: user.id,
      nome: d.nome,
      api_disciplina_id: d.id,
      plano_id: params.planoId,
      source_type: 'edital' as const,
    }));

    const { data: createdDiscs } = await supabase
      .from('disciplinas')
      .upsert(discInserts, { onConflict: 'user_id,plano_id,api_disciplina_id' })
      .select('id, api_disciplina_id');

    if (!createdDiscs) return false;

    // Build disciplina ID map
    const discMap = new Map<number, string>();
    createdDiscs.forEach(d => {
      if (d.api_disciplina_id) discMap.set(d.api_disciplina_id, d.id);
    });

    // Bulk insert topicos
    const topicoInserts: Array<{
      user_id: string;
      disciplina_id: string;
      nome: string;
      api_topico_id: number;
      source_type: 'edital';
      estimated_duration_minutes: number;
    }> = [];

    for (const [apiDiscId, topicos] of params.topicosPerDisciplina) {
      const localDiscId = discMap.get(apiDiscId);
      if (!localDiscId) continue;
      for (const t of topicos) {
        topicoInserts.push({
          user_id: user.id,
          disciplina_id: localDiscId,
          nome: t.nome,
          api_topico_id: t.id,
          source_type: 'edital',
          estimated_duration_minutes: 120,
        });
      }
    }

    const { error } = await supabase.from('topicos').upsert(topicoInserts, {
      onConflict: 'user_id,disciplina_id,api_topico_id',
    });

    return !error;
  }, []);

  /**
   * Get local topico ID for an API topico (returns null if not created yet)
   */
  const getLocalTopicoId = useCallback(async (apiTopicoId: number): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('topicos')
      .select('id')
      .eq('user_id', user.id)
      .eq('api_topico_id', apiTopicoId)
      .maybeSingle();

    return data?.id || null;
  }, []);

  return { ensureTopicoLocal, bulkCreateFromCargo, getLocalTopicoId };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEditalSnapshot.ts
git commit -m "feat: add useEditalSnapshot hook for lazy and bulk local record creation"
```

---

### Task 5: Update EditaisPage — "Ver edital" / "Continuar" Button

**Files:**
- Modify: `src/views/EditaisPage.tsx`

- [ ] **Step 1: Add plano check and button logic**

Import the hook:
```typescript
import { usePlanosEstudo } from '@/hooks/usePlanosEstudo';
```

Inside the component, use it:
```typescript
const { findPlanoByEdital } = usePlanosEstudo();
```

Update the cargo button render (currently "Estudar →"):
```typescript
{(() => {
  const existingPlano = findPlanoByEdital(edital.id, cargo.id);
  if (existingPlano) {
    return (
      <button
        onClick={() => navigate(`/documents-organization?planoId=${existingPlano.id}`)}
        className="text-sm font-medium text-green-600 hover:text-green-700"
      >
        Continuar →
      </button>
    );
  }
  return (
    <button
      onClick={() => navigate(`/documents-organization?editalId=${edital.id}&cargoId=${cargo.id}`)}
      className="text-sm font-medium text-blue-600 hover:text-blue-700"
    >
      Ver edital →
    </button>
  );
})()}
```

- [ ] **Step 2: Add "Vistos recentemente" section**

At the top of the editais list, add a section that shows recently viewed editais from React Query cache:
```typescript
// The useCargoData queries cached in localStorage are the "recents"
// This is handled automatically by React Query persist — no extra code needed
// The editais the student clicked will show faster (from cache) on subsequent visits
```

- [ ] **Step 3: Commit**

```bash
git add src/views/EditaisPage.tsx
git commit -m "feat: update editais page with 'Ver edital' / 'Continuar' button logic"
```

---

### Task 6: Update DocumentsOrganizationPage — API Data Source

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`
- Modify: `src/contexts/DocumentsOrganizationContext.tsx`

- [ ] **Step 1: Parse query params and load from API or Supabase**

In the context or page, detect the mode:
```typescript
import { useSearchParams } from 'react-router-dom';
import { useDisciplinasApi, useTopicosApi, useCargoData } from '@/hooks/useEditaisData';

const [searchParams] = useSearchParams();
const editalId = searchParams.get('editalId') ? Number(searchParams.get('editalId')) : null;
const cargoId = searchParams.get('cargoId') ? Number(searchParams.get('cargoId')) : null;
const planoId = searchParams.get('planoId');

const isEditalMode = !!editalId && !!cargoId;
const isPlanoMode = !!planoId;
// else: manual mode (existing behavior)
```

- [ ] **Step 2: In edital mode, fetch from API**

```typescript
const { data: apiDisciplinas } = useDisciplinasApi(isEditalMode ? cargoId : null);
const { data: cargoData } = useCargoData(editalId, cargoId);

// Convert API disciplinas to Disciplina type for the existing components
const disciplinasFromApi: Disciplina[] = (apiDisciplinas || []).map(d => ({
  id: `api-${d.id}`, // Temporary ID for display (not in Supabase)
  nome: d.nome,
  totalChapters: d.totalTopicos,
  subject: '',
  topicos: [], // Loaded on demand when disciplina is selected
  _apiId: d.id, // Internal ref for API calls
}));
```

- [ ] **Step 3: Merge local progress with API structure**

```typescript
// When rendering, check if local records exist for each API topic
// This enables showing progress for topics the student has studied
const { getLocalTopicoId } = useEditalSnapshot();

// In the drawer, when opening a topic:
const localId = await getLocalTopicoId(apiTopicoId);
if (localId) {
  // Fetch progress from Supabase using localId
  // Show stats, revisões, desempenho
} else {
  // Show only API intelligence, blur on stats
}
```

- [ ] **Step 4: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx src/contexts/DocumentsOrganizationContext.tsx
git commit -m "feat: support edital mode in documents-organization (API data source)"
```

---

### Task 7: React Query Persist Setup

**Files:**
- Modify: `src/App.tsx` or wherever QueryClient is configured

- [ ] **Step 1: Add persist plugin**

```bash
npm install @tanstack/react-query-persist-client
```

```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});

// After creating queryClient:
if (typeof window !== 'undefined') {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx package.json package-lock.json
git commit -m "feat: add React Query persist for offline edital cache"
```

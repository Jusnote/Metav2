# Plan 5: Inteligência do Edital no Drawer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show edital intelligence data in the TopicDetailDrawer — "O que mais cai" with frequency bars, editais that cover the topic, linked legislation, bancas, and progress segmented dots (4 dots per topic).

**Architecture:** Intelligence data comes from the API editais via React Query hooks. The drawer merges API data (intelligence) with Supabase data (progress). When no progress exists, stats panel shows with blur. New API queries may be needed for frequency/cross-reference data.

**Tech Stack:** URQL (GraphQL), React Query, Tailwind CSS

**Depends on:** Plan 1 (rename), Plan 2 (API integration)

**Spec:** `docs/superpowers/specs/2026-04-08-editais-documents-integration-design.md` (sections "Inteligência do Edital" + "Progresso Segmentado" + "Drawer — Design Action-First")

---

### Task 1: Create Intelligence Section Component

**Files:**
- Create: `src/components/documents-organization/TopicoIntelligence.tsx`

- [ ] **Step 1: Create component**

```tsx
interface IntelligenceData {
  // "O que mais cai" — subtopic frequency
  subtopicosFrequentes: Array<{ nome: string; frequencia: number }>;
  // Cross-reference editais
  editaisQueCobram: Array<{ nome: string; sigla: string }>;
  // Linked legislation
  legislacao: Array<{ referencia: string; descricao?: string }>;
  // Bancas
  bancas: string[];
  // Stats
  frequenciaProvas: number; // percentage
  pesoMedio: number; // percentage
  rankingEdital: { posicao: number; total: number };
}

interface Props {
  data: IntelligenceData | null;
  isLoading: boolean;
}

export function TopicoIntelligence({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-[#f8f9ff] border border-[#e0e7ff] rounded-xl p-3 animate-pulse">
        <div className="h-4 bg-[#e0e7ff] rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-[#e0e7ff] rounded w-full" />
          <div className="h-3 bg-[#e0e7ff] rounded w-4/5" />
          <div className="h-3 bg-[#e0e7ff] rounded w-3/5" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-[#f8f9ff] to-[#eef2ff] border border-[#ddd6fe] rounded-xl p-3 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-[-20px] right-[-20px] w-[60px] h-[60px] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_70%)] rounded-full" />

      {/* O que mais cai */}
      {data.subtopicosFrequentes.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-[#4338ca] uppercase tracking-wide mb-2">
            O que mais cai
          </div>
          <div className="space-y-1.5">
            {data.subtopicosFrequentes.slice(0, 4).map((sub, i) => (
              <div key={i}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-xs text-[#1e1b4b]">{sub.nome}</span>
                  <span className="text-[10px] font-bold text-[#4338ca]">{sub.frequencia}%</span>
                </div>
                <div className="h-1 bg-[#e0e7ff] rounded-full">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${sub.frequencia}%`,
                      background: `linear-gradient(90deg, #4338ca ${100 - i * 20}%, #818cf8)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editais + Legislação + Bancas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {/* Editais que cobram */}
          {data.editaisQueCobram.length > 0 && (
            <div className="mb-2">
              <div className="text-[9px] text-muted-foreground mb-1">
                Presente em <strong className="text-[#4338ca]">{data.editaisQueCobram.length} editais</strong>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.editaisQueCobram.slice(0, 6).map((e, i) => (
                  <span
                    key={i}
                    className="text-[9px] bg-[#4f46e5] text-white px-1.5 py-0.5 rounded"
                    style={{ opacity: 1 - i * 0.1 }}
                  >
                    {e.sigla || e.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legislação */}
          {data.legislacao.length > 0 && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-1">Legislação</div>
              <div className="flex flex-wrap gap-1">
                {data.legislacao.map((l, i) => (
                  <span
                    key={i}
                    className="text-[9px] bg-white border border-[#c7d2fe] text-[#3730a3] px-1.5 py-0.5 rounded cursor-pointer hover:bg-[#eef2ff]"
                  >
                    ⚖️ {l.referencia}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {/* Bancas */}
          {data.bancas.length > 0 && (
            <div className="mb-2">
              <div className="text-[9px] text-muted-foreground mb-1">Bancas</div>
              <div className="flex flex-wrap gap-1">
                {data.bancas.map((b, i) => (
                  <span key={i} className="text-[9px] bg-[#ddd6fe] text-[#4338ca] px-1.5 py-0.5 rounded">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats compactos */}
          <div className="text-[9px] text-[#818cf8]">
            {data.frequenciaProvas}% das provas · peso {data.pesoMedio}% · #{data.rankingEdital.posicao}/{data.rankingEdital.total}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { IntelligenceData };
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/TopicoIntelligence.tsx
git commit -m "feat: create TopicoIntelligence component with frequency bars and cross-ref"
```

---

### Task 2: Create Progress Segmented Dots Component

**Files:**
- Create: `src/components/documents-organization/ProgressDots.tsx`

- [ ] **Step 1: Create component**

```tsx
interface ProgressDotsProps {
  estudo: 'completed' | 'partial' | 'none';
  revisao: 'completed' | 'partial' | 'none';
  questoes: 'completed' | 'partial' | 'none';
  leiSeca: 'completed' | 'partial' | 'none';
  size?: 'sm' | 'md';
}

const COLOR_MAP = {
  completed: 'bg-green-500',
  partial: 'bg-amber-500',
  none: 'bg-zinc-200',
};

const LABELS = ['Estudo', 'Revisão', 'Questões', 'Lei Seca'];

export function ProgressDots({ estudo, revisao, questoes, leiSeca, size = 'sm' }: ProgressDotsProps) {
  const dots = [estudo, revisao, questoes, leiSeca];
  const px = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className="flex gap-0.5" title={dots.map((d, i) => `${LABELS[i]}: ${d}`).join(' · ')}>
      {dots.map((status, i) => (
        <div key={i} className={`${px} rounded-sm ${COLOR_MAP[status]}`} />
      ))}
    </div>
  );
}

/**
 * Calculate dot states from topico progress data
 */
export function calculateProgressDots(topico: {
  teoria_finalizada?: boolean;
  completed_at?: string;
  questoes_acertos?: number;
  questoes_erros?: number;
  leis_lidas?: string;
  tempo_investido?: number;
}, scheduleStatus?: {
  hasCompletedRevision: boolean;
  hasPendingRevision: boolean;
}): ProgressDotsProps {
  // Estudo
  let estudo: 'completed' | 'partial' | 'none' = 'none';
  if (topico.completed_at || topico.teoria_finalizada) estudo = 'completed';
  else if ((topico.tempo_investido || 0) > 0) estudo = 'partial';

  // Revisão
  let revisao: 'completed' | 'partial' | 'none' = 'none';
  if (scheduleStatus?.hasCompletedRevision) revisao = 'completed';
  else if (scheduleStatus?.hasPendingRevision) revisao = 'partial';

  // Questões
  const totalQ = (topico.questoes_acertos || 0) + (topico.questoes_erros || 0);
  let questoes: 'completed' | 'partial' | 'none' = 'none';
  if (totalQ >= 10) questoes = 'completed';
  else if (totalQ > 0) questoes = 'partial';

  // Lei Seca
  let leiSeca: 'completed' | 'partial' | 'none' = 'none';
  if (topico.leis_lidas) leiSeca = 'completed';

  return { estudo, revisao, questoes, leiSeca };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/ProgressDots.tsx
git commit -m "feat: create ProgressDots component with 4 segmented indicators"
```

---

### Task 3: Hook for Intelligence Data

**Files:**
- Create: `src/hooks/useTopicoIntelligence.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { editaisQuery } from '@/lib/editais-client';
import type { IntelligenceData } from '@/components/documents-organization/TopicoIntelligence';

// NOTE: Some of these queries may need to be created in the API.
// For now, we use existing queries where possible and stub the rest.

const RANKING_DISCIPLINAS_QUERY = `
  query RankingDisciplinas($esfera: String, $limite: Int) {
    rankingDisciplinas(esfera: $esfera, limite: $limite) { nome totalEditais totalCargos }
  }
`;

const EDITAIS_POR_DISCIPLINA_QUERY = `
  query EditaisPorDisciplina($nome: String!) {
    editaisPorDisciplina(nome: $nome) { id nome sigla esfera }
  }
`;

export function useTopicoIntelligence(
  disciplinaNome: string | null,
  topicoNome: string | null,
  editalEsfera: string | null,
) {
  return useQuery({
    queryKey: ['topico-intelligence', disciplinaNome, topicoNome],
    queryFn: async (): Promise<IntelligenceData> => {
      if (!disciplinaNome || !topicoNome) {
        return {
          subtopicosFrequentes: [],
          editaisQueCobram: [],
          legislacao: [],
          bancas: [],
          frequenciaProvas: 0,
          pesoMedio: 0,
          rankingEdital: { posicao: 0, total: 0 },
        };
      }

      // Fetch editais that cover this disciplina
      const { data: editaisData } = await editaisQuery<{
        editaisPorDisciplina: Array<{ id: number; nome: string; sigla: string; esfera: string }>;
      }>(EDITAIS_POR_DISCIPLINA_QUERY, { nome: disciplinaNome });

      // Fetch ranking
      const { data: rankingData } = await editaisQuery<{
        rankingDisciplinas: Array<{ nome: string; totalEditais: number; totalCargos: number }>;
      }>(RANKING_DISCIPLINAS_QUERY, { esfera: editalEsfera, limite: 50 });

      const editais = editaisData?.editaisPorDisciplina || [];
      const ranking = rankingData?.rankingDisciplinas || [];
      const rankPos = ranking.findIndex(r => r.nome === disciplinaNome) + 1;

      return {
        // TODO: Subtopicos frequentes need a new API query
        // For now, return empty — will be populated when API is enriched
        subtopicosFrequentes: [],
        editaisQueCobram: editais.map(e => ({ nome: e.nome, sigla: e.sigla })),
        // TODO: Legislação mapping needs to be created (manual or AI-based)
        legislacao: [],
        // TODO: Bancas data needs to be added to API
        bancas: [],
        frequenciaProvas: editais.length > 0 ? Math.round((editais.length / 167) * 100) : 0,
        pesoMedio: 0, // TODO: Needs API enrichment
        rankingEdital: { posicao: rankPos || 0, total: ranking.length },
      };
    },
    enabled: !!disciplinaNome && !!topicoNome,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTopicoIntelligence.ts
git commit -m "feat: add useTopicoIntelligence hook for API intelligence data"
```

---

### Task 4: Integrate Intelligence + Dots into TopicDetailDrawer

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Add intelligence section**

Import components:
```typescript
import { TopicoIntelligence } from './TopicoIntelligence';
import { ProgressDots, calculateProgressDots } from './ProgressDots';
import { useTopicoIntelligence } from '@/hooks/useTopicoIntelligence';
```

In the drawer content, add intelligence section after the header:
```tsx
const { data: intelligence, isLoading: intelligenceLoading } = useTopicoIntelligence(
  disciplinaNome,
  topico.nome,
  editalEsfera,
);

// In the render, after header and before stats:
<TopicoIntelligence data={intelligence} isLoading={intelligenceLoading} />
```

- [ ] **Step 2: Add progress dots to drawer header**

```tsx
<div className="flex items-center gap-2">
  <h3 className="text-base font-bold">{topico.nome}</h3>
  <ProgressDots {...calculateProgressDots(topicoProgress || {})} />
</div>
```

- [ ] **Step 3: Add blur to stats panel when no progress**

Wrap the stats/revisões/desempenho/IA section:
```tsx
<div className={`relative ${!hasProgress ? 'select-none' : ''}`}>
  {!hasProgress && (
    <div className="absolute inset-0 z-10 backdrop-blur-[3px] bg-white/30 rounded-xl flex items-center justify-center">
      <div className="text-center">
        <div className="text-xs font-semibold text-muted-foreground">Estude para desbloquear</div>
      </div>
    </div>
  )}
  {/* Existing stats/revisões/desempenho/IA content */}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/documents-organization/TopicDetailDrawer.tsx
git commit -m "feat: integrate intelligence, progress dots, and blur into drawer"
```

---

### Task 5: Add Progress Dots to Topic Cards in Central Area

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Add dots to each topic row**

Import and use in the topic card render:
```tsx
import { ProgressDots, calculateProgressDots } from '@/components/documents-organization/ProgressDots';

// In the topic row render, after the topic name:
<ProgressDots
  {...calculateProgressDots(localProgress || {}, scheduleStatus)}
  size="sm"
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx
git commit -m "feat: add segmented progress dots to topic cards"
```

---

### Task 6: Verify

- [ ] **Step 1: Test intelligence in drawer**

1. Navigate to `/documents-organization?editalId=75&cargoId=520`
2. Click a topic → drawer opens
3. Intelligence section shows (editais that cover, ranking)
4. Stats panel shows with blur (no progress yet)
5. Progress dots show all gray

- [ ] **Step 2: Test after registering study**

1. Click "Registrar Estudo" → complete form
2. Blur lifts on stats panel
3. Progress dots update (estudo dot turns green/yellow)

- [ ] **Step 3: Build check**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete edital intelligence integration in drawer"
```

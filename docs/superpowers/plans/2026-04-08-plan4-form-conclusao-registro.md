# Plan 4: Form de Conclusão + Registrar Estudo Manual

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a completion form (rápido + detalhado) when finishing cronograma items, and a "Registrar Estudo" button in the drawer for manual study logging. Both create/update local topico records and integrate with FSRS for revision scheduling.

**Architecture:** Single form component with two modes. Completion form triggered from CronogramaDayView. Manual registration triggered from TopicDetailDrawer. Both call the same save logic that updates topicos table and triggers FSRS.

**Tech Stack:** React, Supabase, ts-fsrs, shadcn/ui Dialog

**Depends on:** Plan 1 (rename), Plan 3 (cronograma mode)

**Spec:** `docs/superpowers/specs/2026-04-08-editais-documents-integration-design.md` (sections "Form de Conclusão de Atividade" + "Registro de Estudo Manual")

---

### Task 1: Create StudyCompletionForm Component

**Files:**
- Create: `src/components/documents-organization/StudyCompletionForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  topicoNome: string;
  disciplinaNome: string;
  sessionType?: 'part1' | 'part2' | 'revision' | 'questions' | 'lei-seca';
  estimatedMinutes?: number;
  onSave: (data: CompletionData) => void;
  onCancel: () => void;
}

export interface CompletionData {
  autoAvaliacao: 'facil' | 'medio' | 'dificil';
  tempoReal?: number;
  resumosCriados?: number;
  questoesAcertos?: number;
  questoesErros?: number;
  leisLidas?: string;
  teoriaFinalizada?: boolean;
  comentarios?: string;
}

export function StudyCompletionForm({
  topicoNome,
  disciplinaNome,
  sessionType,
  estimatedMinutes,
  onSave,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<'rapido' | 'detalhado'>('rapido');
  const [autoAvaliacao, setAutoAvaliacao] = useState<'facil' | 'medio' | 'dificil' | null>(null);
  const [tempoReal, setTempoReal] = useState(estimatedMinutes || 0);
  const [resumosCriados, setResumosCriados] = useState(0);
  const [questoesAcertos, setQuestoesAcertos] = useState(0);
  const [questoesErros, setQuestoesErros] = useState(0);
  const [leisLidas, setLeisLidas] = useState('');
  const [teoriaFinalizada, setTeoriaFinalizada] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [proximaRevisao, setProximaRevisao] = useState<string | null>(null);

  const handleSave = () => {
    if (!autoAvaliacao) return;

    const data: CompletionData = { autoAvaliacao };

    if (mode === 'detalhado') {
      data.tempoReal = tempoReal;
      data.resumosCriados = resumosCriados;
      data.questoesAcertos = questoesAcertos;
      data.questoesErros = questoesErros;
      data.leisLidas = leisLidas || undefined;
      data.teoriaFinalizada = teoriaFinalizada;
      data.comentarios = comentarios || undefined;
    }

    onSave(data);
  };

  // Calculate combined FSRS rating preview when in detailed mode
  const previewRating = () => {
    if (mode !== 'detalhado' || !autoAvaliacao) return null;
    const totalQ = questoesAcertos + questoesErros;
    if (totalQ === 0) return null;

    const qScore = questoesAcertos / totalQ;
    const autoScore = autoAvaliacao === 'facil' ? 1.0 : autoAvaliacao === 'medio' ? 0.6 : 0.3;
    const timeScore = tempoReal <= (estimatedMinutes || 120) ? 0.8 : 0.5;
    const combined = timeScore * 0.25 + qScore * 0.35 + autoScore * 0.30 + (teoriaFinalizada ? 0.1 : 0);

    // Map to approximate days
    if (combined >= 0.8) return '7 dias';
    if (combined >= 0.6) return '3 dias';
    if (combined >= 0.4) return '1 dia';
    return 'amanhã';
  };

  const avaliacaoButtons = [
    { value: 'facil' as const, label: 'Fácil', emoji: '😊', color: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' },
    { value: 'medio' as const, label: 'Médio', emoji: '😐', color: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { value: 'dificil' as const, label: 'Difícil', emoji: '😓', color: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-foreground">{topicoNome}</div>
            <div className="text-xs text-muted-foreground">{disciplinaNome}</div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Auto-avaliação — always visible */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-foreground mb-2">Como foi o estudo?</div>
            <div className="grid grid-cols-3 gap-2">
              {avaliacaoButtons.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setAutoAvaliacao(btn.value)}
                  className={`py-3 rounded-xl border-2 text-center transition-all ${
                    autoAvaliacao === btn.value
                      ? `${btn.color} ring-2 ring-offset-1 ring-current scale-105`
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <div className="text-xl">{btn.emoji}</div>
                  <div className="text-xs font-semibold mt-1">{btn.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Expand toggle */}
          {mode === 'rapido' && (
            <button
              onClick={() => setMode('detalhado')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              Adicionar detalhes ›
            </button>
          )}

          {/* Detailed fields */}
          {mode === 'detalhado' && (
            <div className="space-y-3 mb-4 pt-3 border-t">
              {/* Tempo real */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Tempo real (min)</label>
                <input
                  type="number"
                  value={tempoReal}
                  onChange={(e) => setTempoReal(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
              </div>

              {/* Questões */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Acertos</label>
                  <input
                    type="number" min={0}
                    value={questoesAcertos}
                    onChange={(e) => setQuestoesAcertos(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Erros</label>
                  <input
                    type="number" min={0}
                    value={questoesErros}
                    onChange={(e) => setQuestoesErros(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  />
                </div>
              </div>

              {/* Lei Seca */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Artigos lidos</label>
                <input
                  type="text"
                  placeholder="Ex: Art. 121-129"
                  value={leisLidas}
                  onChange={(e) => setLeisLidas(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
              </div>

              {/* Teoria finalizada */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teoriaFinalizada}
                  onChange={(e) => setTeoriaFinalizada(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs text-foreground">Teoria finalizada</span>
              </label>

              {/* Comentários */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Comentários</label>
                <textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
                />
              </div>

              {/* FSRS preview */}
              {previewRating() && (
                <div className="text-xs text-muted-foreground italic">
                  Baseado no seu desempenho, próxima revisão em ~{previewRating()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!autoAvaliacao}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/StudyCompletionForm.tsx
git commit -m "feat: create StudyCompletionForm with quick and detailed modes"
```

---

### Task 2: Create useStudyCompletion Hook

**Files:**
- Create: `src/hooks/useStudyCompletion.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEditalSnapshot } from './useEditalSnapshot';
import type { CompletionData } from '@/components/documents-organization/StudyCompletionForm';
import { Rating } from 'ts-fsrs';

function mapAutoAvaliacaoToRating(auto: 'facil' | 'medio' | 'dificil'): Rating {
  switch (auto) {
    case 'facil': return Rating.Easy;
    case 'medio': return Rating.Good;
    case 'dificil': return Rating.Hard;
  }
}

function calculateCombinedRating(data: CompletionData, estimatedMinutes: number): Rating {
  const totalQ = (data.questoesAcertos || 0) + (data.questoesErros || 0);
  if (totalQ === 0) return mapAutoAvaliacaoToRating(data.autoAvaliacao);

  const qScore = (data.questoesAcertos || 0) / totalQ;
  const autoScore = data.autoAvaliacao === 'facil' ? 1.0 : data.autoAvaliacao === 'medio' ? 0.6 : 0.3;
  const timeScore = (data.tempoReal || estimatedMinutes) <= estimatedMinutes ? 0.8 : 0.5;
  const completionScore = data.teoriaFinalizada ? 1.0 : 0.5;

  const combined = timeScore * 0.25 + qScore * 0.35 + completionScore * 0.30 + autoScore * 0.10;

  if (combined >= 0.75) return Rating.Easy;
  if (combined >= 0.5) return Rating.Good;
  if (combined >= 0.25) return Rating.Hard;
  return Rating.Again;
}

export function useStudyCompletion() {
  const { ensureTopicoLocal } = useEditalSnapshot();

  const completeStudy = useCallback(async (params: {
    apiTopicoId?: number;
    apiDisciplinaId?: number;
    localTopicoId?: string;
    topicoNome: string;
    disciplinaNome: string;
    planoId?: string;
    scheduleItemId?: string;
    estimatedMinutes: number;
    data: CompletionData;
  }) => {
    // Ensure local topico exists (lazy creation)
    let topicoId = params.localTopicoId;
    if (!topicoId && params.apiTopicoId && params.apiDisciplinaId) {
      topicoId = await ensureTopicoLocal({
        apiTopicoId: params.apiTopicoId,
        apiDisciplinaId: params.apiDisciplinaId,
        topicoNome: params.topicoNome,
        disciplinaNome: params.disciplinaNome,
        planoId: params.planoId,
      });
    }
    if (!topicoId) return false;

    // Update topico progress
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_access: new Date().toISOString(),
    };

    if (params.data.tempoReal) {
      // Increment tempo_investido
      const { data: current } = await supabase
        .from('topicos')
        .select('tempo_investido')
        .eq('id', topicoId)
        .single();
      updates.tempo_investido = (current?.tempo_investido || 0) + params.data.tempoReal;
    }

    if (params.data.questoesAcertos !== undefined) {
      const { data: current } = await supabase
        .from('topicos')
        .select('questoes_acertos, questoes_erros')
        .eq('id', topicoId)
        .single();
      updates.questoes_acertos = (current?.questoes_acertos || 0) + params.data.questoesAcertos;
      updates.questoes_erros = (current?.questoes_erros || 0) + (params.data.questoesErros || 0);
    }

    if (params.data.leisLidas) updates.leis_lidas = params.data.leisLidas;
    if (params.data.teoriaFinalizada) {
      updates.teoria_finalizada = true;
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }

    await supabase.from('topicos').update(updates).eq('id', topicoId);

    // Mark schedule_item as completed if applicable
    if (params.scheduleItemId) {
      await supabase
        .from('schedule_items')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          actual_duration: params.data.tempoReal || params.estimatedMinutes,
        })
        .eq('id', params.scheduleItemId);
    }

    // Calculate FSRS rating
    const rating = params.data.questoesAcertos !== undefined && params.data.questoesErros !== undefined
      ? calculateCombinedRating(params.data, params.estimatedMinutes)
      : mapAutoAvaliacaoToRating(params.data.autoAvaliacao);

    // TODO: Trigger FSRS revision scheduling using existing useFSRSScheduler
    // This will be connected when the FSRS integration is wired up

    return true;
  }, [ensureTopicoLocal]);

  /**
   * Check if a manual study registration conflicts with a scheduled item
   * and adapt the cronograma accordingly
   */
  const adaptCronograma = useCallback(async (apiTopicoId: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find scheduled items for this topic that are in the future
    const { data: scheduledItems } = await supabase
      .from('schedule_items')
      .select('id, scheduled_date, item_type, revision_type')
      .eq('user_id', user.id)
      .eq('completed', false)
      .gte('scheduled_date', new Date().toISOString().split('T')[0]);

    // TODO: Match by local topico_id → api_topico_id
    // For now, this is a placeholder that will be connected
    // when schedule_items are linked to API topic IDs
  }, []);

  return { completeStudy, adaptCronograma };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useStudyCompletion.ts
git commit -m "feat: add useStudyCompletion hook with FSRS rating calculation"
```

---

### Task 3: Add "Registrar Estudo" to TopicDetailDrawer

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Add button and form state**

Import the form and hook:
```typescript
import { StudyCompletionForm, type CompletionData } from './StudyCompletionForm';
import { useStudyCompletion } from '@/hooks/useStudyCompletion';
```

Add state:
```typescript
const [showCompletionForm, setShowCompletionForm] = useState(false);
const { completeStudy } = useStudyCompletion();
```

Add the "Registrar Estudo" button in the drawer content (always present):
```tsx
<button
  onClick={() => setShowCompletionForm(true)}
  className="w-full py-2.5 rounded-xl bg-foreground text-background text-xs font-bold mt-3"
>
  📝 Registrar Estudo
</button>

{showCompletionForm && (
  <StudyCompletionForm
    topicoNome={topico.nome}
    disciplinaNome={disciplinaNome}
    estimatedMinutes={topico.estimated_duration_minutes || 120}
    onCancel={() => setShowCompletionForm(false)}
    onSave={async (data) => {
      await completeStudy({
        apiTopicoId: topico._apiId,
        apiDisciplinaId: disciplina._apiId,
        localTopicoId: topico._localId,
        topicoNome: topico.nome,
        disciplinaNome: disciplinaNome,
        estimatedMinutes: topico.estimated_duration_minutes || 120,
        data,
      });
      setShowCompletionForm(false);
      // Refresh data
    }}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/TopicDetailDrawer.tsx
git commit -m "feat: add 'Registrar Estudo' button with completion form to drawer"
```

---

### Task 4: Wire Completion Form to CronogramaDayView

**Files:**
- Modify: `src/components/documents-organization/CronogramaDayView.tsx`

- [ ] **Step 1: Add completion flow**

Add state for showing the form:
```typescript
const [completingItem, setCompletingItem] = useState<ActivityItem | null>(null);
const { completeStudy } = useStudyCompletion();
```

When "Iniciar" is clicked and activity finishes, show the form:
```tsx
{completingItem && (
  <StudyCompletionForm
    topicoNome={completingItem.title}
    disciplinaNome={completingItem.disciplina}
    sessionType={completingItem.type}
    estimatedMinutes={completingItem.durationMinutes}
    onCancel={() => setCompletingItem(null)}
    onSave={async (data) => {
      await completeStudy({
        topicoNome: completingItem.title,
        disciplinaNome: completingItem.disciplina,
        scheduleItemId: completingItem.id,
        estimatedMinutes: completingItem.durationMinutes,
        data,
      });
      setCompletingItem(null);
      // Refresh activities list
    }}
  />
)}
```

Add a "Finalizar" button to the active activity card (alongside "Iniciar"):
```tsx
<button
  onClick={() => setCompletingItem(item)}
  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold"
>
  ✓ Finalizar
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaDayView.tsx
git commit -m "feat: wire completion form to cronograma day view activities"
```

---

### Task 5: Verify

- [ ] **Step 1: Test completion form**

1. Open drawer for a topic → click "Registrar Estudo" → form opens
2. Quick mode: select avaliação → confirm → saves
3. Detailed mode: expand → fill fields → confirm → saves with combined rating preview

- [ ] **Step 2: Test cronograma completion**

1. Switch to cronograma mode → select day → click "Finalizar" on activity
2. Form opens with session type context → complete → activity marked as done

- [ ] **Step 3: Build check**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete study completion and manual registration flow"
```

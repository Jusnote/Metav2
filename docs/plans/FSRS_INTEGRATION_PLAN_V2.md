# 📋 FSRS Integration Plan v2.0
**Sistema de Revisão Inteligente com Flexibilidade Total**

Status: Phase 2 Completa ✅ | Atualizado: 2025-01-15

---

## 🎯 Visão Geral

Sistema de agendamento de estudos com **3 modos de operação**:

1. **Manual Puro**: Usuário controla tudo, sem automação
2. **Auto-Revision Avulso**: Revisões automáticas sem meta formal (FSRS ou intervalo fixo)
3. **Metas com Templates**: Planejamento completo com geração automática de cronograma

---

## ✅ Phase 1: Database Infrastructure (COMPLETO)

### Tabelas Criadas
- ✅ `goal_templates` - Templates do sistema e usuário
- ✅ `study_goals` - Metas de estudo
- ✅ `schedule_items` - Itens do cronograma (com campos FSRS)
- ✅ `sync_history` - Histórico de sincronizações

### Campos FSRS em schedule_items
- ✅ `revision_type` - Tipo de revisão (6 tipos)
- ✅ `revision_number` - Contador de revisões
- ✅ `performance_data` - Métricas de desempenho (JSONB)
- ✅ `fsrs_state` - Estado do card FSRS (JSONB)
- ✅ `document_id` - Link para documento
- ✅ `parent_item_id` - Item original (cadeia de revisões)
- ✅ `next_revision_id` - Próxima revisão agendada

### Novo Campo (adicionar)
- ⏳ `metadata` - JSONB para configurações extras:
  ```json
  {
    "auto_revision_enabled": true,
    "revision_mode": "fsrs" | "simple" | null,
    "simple_interval_days": 7,
    "converted_from_manual": false
  }
  ```

### Templates do Sistema
- ✅ Preparação Rápida (7 dias, intensive)
- ✅ Estudo Equilibrado (14 dias, moderate)
- ✅ Aprendizado Profundo (30 dias, light)
- ✅ Preparação para Concurso (90 dias, moderate)

---

## ✅ Phase 2: Core Hooks (COMPLETO)

### Hooks Implementados

#### `useFSRSScheduler.ts` ✅
- `generateSchedule()` - Gera cronograma completo com FSRS
- `calculateNextRevision()` - Calcula próxima revisão
- `getRevisionType()` - Determina tipo baseado em rating
- `performanceToRating()` - Converte performance em Rating FSRS

#### `useScheduleItems.ts` ✅
- CRUD completo de schedule_items
- `completeItem()` - Marca completo + cria próxima revisão
- `scheduleItem()` - Cria novo item
- `reschedule()` - Remarca data
- `softDelete()` - Exclusão lógica
- Estatísticas: `stats`, `itemsByDate`

#### `useStudyGoals.ts` ✅
- CRUD de metas
- `createGoalWithSchedule()` - Cria meta + schedule completo
- `updateGoalProgress()` - Atualiza % de conclusão
- Busca customizada de templates (sistema + usuário)
- Filtros: `activeGoals`, `completedGoals`, `systemTemplates`

**Adicionar em Phase 3:**
- `detectTopicConflicts()` - Detecta tópicos com itens manuais existentes
- `convertManualItemsToGoal()` - Converte itens manuais para meta
- `resolveConflicts()` - Aplica resolução de conflitos

### Performance Rating System
Combinação ponderada de 4 fatores:
- ⏱️ **Tempo** (25%): Comparação estimado vs real
- 🃏 **Flashcards** (30%): Acertos/facilidade
- ❓ **Questões** (35%): Desempenho
- ✅ **Conclusão** (10%): Completou tudo?

**Rating Final (0-4):**
- 3.5+ = Easy → flashcards_only
- 2.5-3.5 = Good → alterna flashcards/questions
- 1.5-2.5 = Hard → reading_and_flashcards
- <1.5 = Again → reading_and_questions

### Two-Part Initial Study
- **Part 1 (Dia 1)**: Leitura + Flashcards (40min)
- **Part 2 (Dia 2)**: Questões (15min) - spacing effect
- Após Part 2, FSRS calcula revisões baseado em performance combinada

---

## ⏳ Phase 3: UI Components (PRÓXIMA)

### 3.1 - GoalCreationDialog
**Arquivo:** `src/components/goals/GoalCreationDialog.tsx`

**Features:**
- Form com validação (react-hook-form + zod)
- Seleção de tópicos REAIS da tabela `topics`
- Filtro por unidade
- Preview: "Serão criados ~15 itens"
- Escolha de template opcional
- **Detecção de conflitos automática**

**Mudança importante:**
- ✅ Usa `topicId` REAL (não NULL como nos testes)
- Busca hierarquia: `units → topics → subtopics`

**Preview Inteligente:**
```
📊 Preview da Meta

Tópicos selecionados: 5

✅ Tópicos novos (3):
  • Termodinâmica
  • Óptica
  • Ondulatória
  → Criará 12 novos itens

⚠️ Tópicos com agendamentos (2):
  • Mecânica Quântica (3 itens manuais)
  • Eletromagnetismo (1 item manual)
  → Será solicitada resolução de conflito

Total: ~16 itens de estudo
```

---

### 3.7 - TopicConflictDialog (NOVO)
**Arquivo:** `src/components/goals/TopicConflictDialog.tsx`

**Quando aparece:**
- Ao criar meta com tópico que já tem itens manuais não completados
- **Previne duplicação** (estudar 2x o mesmo tópico)

**Interface:**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Tópico já agendado manualmente               │
│                                                  │
│ "Mecânica Quântica" tem 3 itens manuais:        │
│   • 15/01 - Estudo inicial                      │
│   • 20/01 - Revisão                             │
│   • 27/01 - Revisão 2                           │
│                                                  │
│ Como deseja proceder?                           │
│                                                  │
│ ● Converter itens manuais para a meta           │
│   ✅ Itens se tornam parte da meta              │
│   ✅ Ativa FSRS automaticamente                 │
│   ✅ Progresso unificado                        │
│                                                  │
│ ○ Substituir por itens da meta                  │
│   Remove agendamentos manuais                   │
│   Cria novo cronograma pela meta                │
│   ⚠️ Perde histórico de itens manuais           │
│                                                  │
│ ○ Não incluir este tópico na meta               │
│   Mantém apenas itens manuais                   │
│   Tópico não fará parte da meta                 │
│                                                  │
│ ☑ Aplicar "Converter" para todos os conflitos  │
│                                                  │
│         [Cancelar]  [Aplicar a Todos]  [OK]     │
└─────────────────────────────────────────────────┘
```

**3 Opções de Resolução:**

| Opção | Ação | Itens Manuais | Itens da Meta | Recomendado |
|-------|------|---------------|---------------|-------------|
| **Converter** ⭐ | Migra manuais → meta | Preservados + viram parte da meta | Não cria novos | ✅ SIM (padrão) |
| **Substituir** | Deleta manuais | Deletados (soft delete) | Cria novos pela meta | Para recomeçar |
| **Pular** | Exclui tópico da meta | Mantém como estão | Não cria | Se quiser manual |

**Implementação:**
```typescript
interface ConflictResolution {
  topicId: string;
  topicName: string;
  existingItems: ScheduleItem[];
  action: 'convert' | 'replace' | 'skip';
}

async function resolveTopicConflicts(
  conflicts: ConflictResolution[]
): Promise<void> {
  for (const conflict of conflicts) {
    switch (conflict.action) {
      case 'convert':
        // Atualizar study_goal_id dos itens existentes
        await convertManualItemsToGoal(
          conflict.existingItems.map(i => i.id),
          goalId
        );
        break;

      case 'replace':
        // Soft delete dos itens manuais
        await deleteManualItems(
          conflict.existingItems.map(i => i.id)
        );
        // Criará novos itens normalmente
        break;

      case 'skip':
        // Remove tópico da lista de criação
        topics = topics.filter(t => t.id !== conflict.topicId);
        break;
    }
  }
}
```

**Validação Extra (opção "Substituir"):**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Confirmação Necessária                       │
│                                                  │
│ Você está prestes a DELETAR 3 itens manuais:    │
│   • 15/01 - Estudo inicial                      │
│   • 20/01 - Revisão                             │
│   • 27/01 - Revisão 2                           │
│                                                  │
│ ⚠️ Itens completados serão preservados          │
│ ⚠️ Esta ação não pode ser desfeita              │
│                                                  │
│         [Cancelar]  [Confirmar Exclusão]        │
└─────────────────────────────────────────────────┘
```

**Toast de Sucesso:**
```
✅ Meta criada com sucesso!

📊 Resumo:
  • 3 tópicos novos → 12 itens criados
  • 2 tópicos convertidos → 4 itens migrados
  • Total: 16 itens na meta
  • FSRS ativado em todos os itens
```

---

### 3.2 - ScheduleCalendar (Enhanced Design)
**Arquivo:** `src/components/schedule/ScheduleCalendar.tsx`

**Integração com Calendário Existente:**
- ✅ **Reutiliza seu calendário atual** - Não cria novo, apenas adiciona features
- ✅ Mostra eventos normais + schedule_items FSRS juntos
- ✅ Usa design de círculos duplos existente

**Sistema de Círculos Duplos com Transparência:**

```
┌──────────────────────────────────────────────┐
│  Círculo Externo (Progresso Geral):         │
│    • Cinza: Tarefas pendentes (0%)          │
│    • Verde: Tarefas completas (100%)        │
│    • Parcial: Gradiente cinza→verde         │
│                                              │
│  Círculo Interno (Revisões FSRS):           │
│    ANTES de completar:                       │
│      • Cores TRANSPARENTES (opacity: 0.3)   │
│      • Mostra tipos de revisão agendadas    │
│      • Preview visual do que vem            │
│                                              │
│    DEPOIS de completar:                      │
│      • Cores SÓLIDAS (opacity: 1.0)         │
│      • Mostra tipos concluídos              │
│      • Sensação de conquista                │
│                                              │
│  Cores por tipo de revisão:                 │
│    🟦 Azul: initial_study_part1             │
│    🟩 Verde: initial_study_part2            │
│    🟨 Amarelo: flashcards_only              │
│    🟧 Laranja: questions_only               │
│    🟥 Vermelho: reading_and_flashcards      │
│    🟪 Roxo: reading_and_questions           │
│                                              │
│  Círculo dividido (múltiplas revisões):     │
│    • Se 2 revisões no dia: 50% cada cor    │
│    • Se 3 revisões: 33% cada cor           │
│    • Arcos proporcionais ao número         │
└──────────────────────────────────────────────┘
```

**Exemplo Visual:**

```
Dia 15 - ANTES de estudar:
  ●●●●●●●●●● (externo: cinza 0%)
  ●   15   ● (interno: 🔴30% 🟡30% - transparente)
  ●●●●●●●●●●

Dia 15 - DEPOIS de estudar:
  ●●●●●●●●●● (externo: verde 100%)
  ●   15   ● (interno: 🔴50% 🟡50% - sólido)
  ●●●●●●●●●●
```

**Features:**
- Drag & drop para remarcar
- Click no dia → Lista detalhada de revisões
- Filtros:
  - Por meta
  - Por tipo (manual/goal)
  - Por tópico
  - Por status (pendente/completo)
  - Por tipo de revisão

**Implementação Técnica:**
```typescript
interface DayCircles {
  // Círculo externo
  completionPercentage: number; // 0-100

  // Círculo interno
  revisions: Array<{
    type: RevisionType;
    color: string;
    completed: boolean;
    opacity: number; // 0.3 se pendente, 1.0 se completo
  }>;
}

// Calcular proporção de cada cor
function calculateRevisionArcs(revisions: Revision[]) {
  const total = revisions.length;
  return revisions.map((rev, idx) => ({
    startAngle: (360 / total) * idx,
    endAngle: (360 / total) * (idx + 1),
    color: getRevisionColor(rev.type),
    opacity: rev.completed ? 1.0 : 0.3,
  }));
}
```

**Coexistência:**
- Itens manuais (`study_goal_id = NULL`)
- Itens de metas (`study_goal_id != NULL`)
- Eventos do calendário original
- Todos no mesmo calendário unificado

---

### 3.3 - StudyItemCard
**Arquivo:** `src/components/schedule/StudyItemCard.tsx`

**Exibe:**
- Título e tipo de revisão
- Datas (agendada vs realizada)
- Duração (estimada vs real)
- Prioridade (1-10)
- Estado FSRS (se tiver)
- Performance anterior (se revisão)

**Ações:**
- 🎯 **Iniciar Estudo** → timer + abre documento
- ✅ **Marcar Completo** → PerformanceDialog
- 📅 **Remarcar** → date picker
- ⚙️ **Configurar Revisões** → AutoRevisionSetupDialog (NOVO)
- 🗑️ **Excluir** → soft delete

---

### 3.4 - PerformanceDialog
**Arquivo:** `src/components/schedule/PerformanceDialog.tsx`

**Coleta:**
1. ⏱️ Tempo gasto (auto-fill se timer ativo)
2. 🃏 Score flashcards (slider 0-5)
3. ❓ Score questões (slider 0-5)
4. ✅ Completou tudo? (checkbox)

**Preview em tempo real:**
- Rating combinado (0-4)
- Próxima revisão estimada
- Tipo de revisão recomendado

**Fluxo especial para itens manuais:**
```
Se item.metadata.auto_revision_enabled === false:
  Mostrar pergunta adicional:
  "Deseja ativar revisões automáticas?"
  → Abre AutoRevisionSetupDialog
```

---

### 3.5 - AutoRevisionSetupDialog (NOVO)
**Arquivo:** `src/components/schedule/AutoRevisionSetupDialog.tsx`

**Quando aparece:**
- Ao completar item manual pela primeira vez
- OU ao clicar em "Configurar Revisões" no StudyItemCard

**Opções:**
```
○ Não, manter manual
  → Nenhuma revisão automática
  → Usuário cria manualmente quando quiser

● Sim, usar FSRS (recomendado)
  → Próxima revisão calculada por performance
  → Intervalo otimizado (1-30+ dias)
  → Benefícios: retenção +30%

○ Sim, usar intervalo fixo
  → Revisar a cada X dias
  → Simples e previsível
  [Input: _____ dias]
```

**Ação:**
- Chama `enableAutoRevisions(itemId, mode, interval?)`
- Atualiza `metadata` do item
- Se FSRS, inicializa `fsrs_state`
- Toast de confirmação

---

### 3.6 - GoalProgressDashboard
**Arquivo:** `src/components/goals/GoalProgressDashboard.tsx`

**Exibe:**
- Lista de metas (ativas + completas)
- Progress bar por meta
- Estatísticas:
  - Total de itens
  - Completos / Pendentes / Atrasados
  - Média de rating
  - Tempo total estudado

**Nova funcionalidade:**
```
🔄 Importar itens manuais para esta meta
  → Dialog com checkboxes
  → Seleciona itens manuais do mesmo tópico
  → Converte em itens da meta
  → Ativa FSRS automaticamente
```

---

## 🔄 Phase 4: Auto-Revision System (NOVA)

### 4.1 - Migration: Add metadata field
**Arquivo:** `supabase/migrations/20250115_add_metadata_field.sql`

```sql
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_schedule_items_auto_revision
  ON schedule_items((metadata->>'auto_revision_enabled'))
  WHERE (metadata->>'auto_revision_enabled')::boolean = true;
```

---

### 4.2 - Update useScheduleItems hook

**Adicionar funções:**

```typescript
// Ativar revisões automáticas em item manual
enableAutoRevisions(
  itemId: string,
  mode: 'fsrs' | 'simple',
  interval?: number
): Promise<void>

// Desativar revisões automáticas
disableAutoRevisions(itemId: string): Promise<void>

// Converter item manual em item de meta
convertToGoalItem(
  itemId: string,
  goalId: string
): Promise<void>

// Importar múltiplos itens manuais para meta
importManualItemsToGoal(
  itemIds: string[],
  goalId: string
): Promise<void>
```

**Modificar `completeItem`:**
- Verificar `metadata.auto_revision_enabled`
- Se `true` + `mode === 'fsrs'`: criar revisão com FSRS
- Se `true` + `mode === 'simple'`: criar revisão em X dias
- Se `false`: apenas marcar completo, sem próxima revisão

---

### 4.3 - Smart Suggestions

**Ao completar item manual:**
```typescript
if (!item.metadata?.auto_revision_enabled) {
  // Analisar padrão do usuário
  const userHasGoals = goals.length > 0;
  const hasCompletedWithGoodRating = /* histórico */;

  if (userHasGoals || hasCompletedWithGoodRating) {
    // Sugerir FSRS
    toast({
      title: "💡 Dica: Ative revisões automáticas",
      description: "Baseado no seu progresso, o FSRS pode otimizar suas revisões",
      action: <Button onClick={openAutoRevisionDialog}>Configurar</Button>
    });
  }
}
```

---

## 📊 Phase 5: Integration with Documents

### 5.1 - Document Actions
No DocumentViewer, adicionar botão:
```
📅 Agendar Estudo
  → Abre mini-dialog:
    ○ Criar agendamento manual
    ● Adicionar a meta existente
    ○ Criar nova meta
```

### 5.2 - Bidirectional Sync
```typescript
// Ao marcar schedule_item como completo
→ Atualizar document.last_studied_at
→ Incrementar document.study_count

// Ao abrir documento
→ Mostrar próximo item agendado
→ Botão "Iniciar revisão agendada"
```

---

## 🃏 Phase 6: Integration with Flashcards

### 6.1 - Study Session Tracking
```typescript
// Durante sessão de flashcards
const session = startFlashcardSession(scheduleItemId);

// Ao finalizar
const score = session.correct / session.total; // 0-1
const flashcard_score = score * 5; // 0-5

// Auto-preencher PerformanceDialog
performanceDialog.setFlashcardScore(flashcard_score);
```

### 6.2 - Flashcard-only Revisions
- Se `revision_type === 'flashcards_only'`
- Abrir direto no modo flashcards
- Não exigir leitura do documento

---

## ❓ Phase 7: Integration with Questions

### 7.1 - Question Session Tracking
Similar a flashcards:
```typescript
const session = startQuestionSession(scheduleItemId);
const questions_score = session.correct / session.total * 5;
performanceDialog.setQuestionsScore(questions_score);
```

### 7.2 - Questions-only Revisions
- Se `revision_type === 'questions_only'`
- Abrir direto no modo questões

---

## 🔗 Phase 8: Cronograma Integration

### 8.1 - Sync with External Calendar
Se você já tem um componente "Cronograma":
```typescript
// Importar eventos do Cronograma antigo
importFromLegacyCalendar(): Promise<ScheduleItem[]>

// Exportar para calendário externo (iCal)
exportToICalendar(goalId?: string): string
```

### 8.2 - Two-way Sync
- Mudanças no novo sistema → refletem no Cronograma antigo
- Vice-versa (se aplicável)

---

## 📈 Phase 9: Analytics & Reports (NOVA)

### 9.1 - Study Statistics Dashboard
**Arquivo:** `src/components/analytics/StudyStatsDashboard.tsx`

**Métricas:**
- 📊 Horas estudadas (dia/semana/mês)
- 🎯 Taxa de conclusão
- ⭐ Rating médio por tópico
- 🔥 Streak (dias consecutivos)
- 📈 Curva de retenção (FSRS)

**Gráficos:**
- Heatmap de estudos (estilo GitHub)
- Linha do tempo de ratings
- Pizza: distribuição de tipos de revisão
- Barra: tempo por unidade/tópico

### 9.2 - FSRS Insights
```
📊 Estatísticas FSRS:
  - Difficulty médio: 6.2
  - Stability médio: 12.5 dias
  - Intervalo médio: 8 dias
  - Retenção estimada: 87%

💡 Insights:
  - "Mecânica Quântica" está com difficulty alto (8.5)
    → Considere reestudo
  - Você está 23% mais rápido que a média
  - Melhor horário: 14h-16h (rating 3.8)
```

---

## 🗂️ Estrutura de Arquivos Atualizada

```
src/
├── components/
│   ├── goals/
│   │   ├── GoalCreationDialog.tsx          (3.1)
│   │   ├── TopicConflictDialog.tsx         (3.7 - NOVO)
│   │   ├── GoalProgressDashboard.tsx       (3.6)
│   │   ├── GoalCard.tsx
│   │   └── ImportManualItemsDialog.tsx     (NOVO)
│   │
│   ├── schedule/
│   │   ├── ScheduleCalendar.tsx            (3.2)
│   │   ├── StudyItemCard.tsx               (3.3)
│   │   ├── PerformanceDialog.tsx           (3.4)
│   │   ├── AutoRevisionSetupDialog.tsx     (3.5 - NOVO)
│   │   └── CalendarDay.tsx
│   │
│   ├── analytics/
│   │   ├── StudyStatsDashboard.tsx         (9.1)
│   │   ├── StudyHeatmap.tsx
│   │   └── FSRSInsights.tsx                (9.2)
│   │
│   └── TestScheduleHooks.tsx               (Phase 2)
│
├── hooks/
│   ├── useFSRSScheduler.ts                 ✅
│   ├── useScheduleItems.ts                 ✅ (atualizar Phase 4)
│   ├── useStudyGoals.ts                    ✅
│   ├── useStudySession.ts                  (Phase 6/7)
│   └── useStudyAnalytics.ts                (Phase 9)
│
└── lib/
    ├── fsrs.ts                              ✅
    └── analytics.ts                         (Phase 9)
```

---

## 📦 Dependências Necessárias

```bash
# Phase 3
npm install react-big-calendar date-fns
npm install react-hook-form zod @hookform/resolvers

# Phase 9
npm install recharts
npm install @tremor/react  # opcional, para gráficos bonitos
```

---

## 🎯 Modos de Uso - Tabela Comparativa

| Feature | Manual Puro | Auto-Revision Avulso | Meta com Template |
|---------|-------------|---------------------|-------------------|
| **Cria schedule** | Manual | Manual | Automático |
| **Revisões automáticas** | ❌ | ✅ | ✅ |
| **Usa FSRS** | ❌ | ✅ Opcional | ✅ Opcional |
| **Precisa de meta** | ❌ | ❌ | ✅ |
| **Tracking de progresso** | Individual | Individual | Por meta |
| **Flexibilidade** | Total | Alta | Média |
| **Complexidade** | Baixa | Média | Alta |
| **Recomendado para** | Testes rápidos | Tópicos avulsos | Preparação estruturada |

---

## ✅ Checklist Geral de Implementação

### Phase 1: Database ✅
- [x] Criar tabelas
- [x] Adicionar campos FSRS
- [x] RLS policies
- [x] Seed templates do sistema
- [ ] Adicionar campo `metadata`

### Phase 2: Core Hooks ✅
- [x] useFSRSScheduler
- [x] useScheduleItems (v1)
- [x] useStudyGoals
- [x] Testes unitários (5/5 passando)

### Phase 3: UI Components ⏳
- [ ] GoalCreationDialog (com detecção de conflitos)
- [ ] TopicConflictDialog (NOVO - prevenção de duplicação)
- [ ] ScheduleCalendar
- [ ] StudyItemCard
- [ ] PerformanceDialog
- [ ] AutoRevisionSetupDialog
- [ ] GoalProgressDashboard

### Phase 4: Auto-Revision System ⏳
- [ ] Migration: metadata field
- [ ] enableAutoRevisions()
- [ ] Atualizar completeItem()
- [ ] Smart suggestions

### Phase 5-9: Integrações ⏳
- [ ] Documents
- [ ] Flashcards
- [ ] Questions
- [ ] Cronograma legado
- [ ] Analytics

---

## 🚀 Próximo Passo Imediato

**Começar Phase 3.1:** GoalCreationDialog

1. Instalar dependências
2. Criar componente com form
3. Buscar tópicos reais da tabela `topics`
4. Integrar com `createGoalWithSchedule()`
5. Testar criação de meta com topic_id REAL

---

## 📝 Notas Importantes

### ⚠️ Lembrete: topic_id NULL é só para TESTES
- Nos testes: `topicId: null as any` (temporário)
- Na UI real: `topicId: realTopic.id` (obrigatório)
- Comentários TODO adicionados em TestScheduleHooks.tsx

### 🔄 Flexibilidade é Chave
- Usuário escolhe modo item por item
- Pode misturar manual + auto + metas
- Sistema sugere melhorias sem forçar
- **Prevenção de duplicação:** Conflitos detectados e resolvidos antes de criar meta

### 🚫 Política Anti-Duplicação
- ❌ Sistema **NUNCA** permite estudar o mesmo tópico 2x no mesmo período
- ✅ Detecção automática de conflitos ao criar meta
- ✅ 3 opções de resolução: Converter (padrão), Substituir, Pular
- ✅ Validação extra ao deletar itens manuais

### 📊 FSRS como Diferencial
- Retenção 30% melhor que Ebbinghaus
- Adapta ao padrão individual
- Otimiza tempo de estudo

---

**Versão:** 2.2
**Data:** 2025-01-15
**Status:** Phase 2 Completa, Phase 3 Pronta para Iniciar
**Próxima Atualização:** Após Phase 3.1

**Changelog v2.2:**
- ✅ Sistema de círculos duplos com transparência para calendário
- ✅ Círculo interno dividido em arcos (múltiplas revisões no mesmo dia)
- ✅ Opacity dinâmica: 0.3 (pendente) → 1.0 (completo)
- ✅ Integração com calendário existente (reutiliza, não substitui)
- ✅ 6 cores para tipos de revisão

**Changelog v2.1:**
- ✅ Adicionado TopicConflictDialog (3.7)
- ✅ Sistema de prevenção de duplicação
- ✅ 3 opções de resolução (Converter, Substituir, Pular)
- ✅ Validação extra para deletar itens
- ✅ Funções adicionadas em useStudyGoals (detectTopicConflicts, convertManualItemsToGoal, resolveConflicts)

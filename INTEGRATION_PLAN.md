# Plano de Integração: Documents Organization + Cronograma

## Visão Geral

Este documento detalha o plano completo de integração entre as páginas **Documents Organization** e **Cronograma**, permitindo agendamento manual, sincronização bidirecional, criação automatizada de metas de estudo com FSRS, e sistema de indicadores visuais.

**Duração Estimada:** 42-48 horas (5-6 dias)

**Princípio Fundamental:** Ambos os sistemas funcionam **independentemente**. A integração é **opcional** e ativada pelo usuário.

---

## Phase 1: Database Infrastructure (6h)

### 1.1 Criação de Tabelas

```sql
-- Tabela principal de itens agendados
CREATE TABLE schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Referências hierárquicas (NULL se for item externo)
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  subtopic_id UUID REFERENCES subtopics(id) ON DELETE SET NULL,

  -- Dados básicos
  title TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Sincronização
  sync_enabled BOOLEAN DEFAULT TRUE,

  -- Tipo de item
  item_type TEXT DEFAULT 'normal', -- 'normal', 'goal', 'external'
  study_goal_id UUID REFERENCES study_goals(id) ON DELETE SET NULL,

  -- Performance tracking
  estimated_duration INTEGER, -- minutos estimados
  actual_duration INTEGER, -- tempo real gasto
  priority INTEGER DEFAULT 5, -- 1-10
  notes TEXT,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de metas de estudo
CREATE TABLE study_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Escopo (NULL = meta global)
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Dados da meta
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,

  -- Configurações
  enable_fsrs BOOLEAN DEFAULT TRUE,
  intensity TEXT DEFAULT 'moderate', -- 'light', 'moderate', 'intensive'

  -- Progresso
  progress_percentage INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Templates
  template_id UUID REFERENCES goal_templates(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de templates de metas
CREATE TABLE goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  intensity TEXT DEFAULT 'moderate',
  is_system BOOLEAN DEFAULT FALSE, -- templates do sistema vs usuário
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL se for template do sistema

  -- Configurações de distribuição
  distribution_config JSONB, -- { reviewsPerWeek: 5, sessionsPerDay: 2, ... }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de sincronização
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schedule_item_id UUID REFERENCES schedule_items(id) ON DELETE CASCADE,

  changed_field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,

  sync_source TEXT, -- 'cronograma', 'documents', 'auto'
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Indexes para Performance

```sql
-- schedule_items indexes
CREATE INDEX idx_schedule_items_user_date ON schedule_items(user_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_items_user_completed ON schedule_items(user_id, completed) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_items_goal ON schedule_items(study_goal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_items_hierarchy ON schedule_items(user_id, unit_id, topic_id, subtopic_id) WHERE deleted_at IS NULL;

-- study_goals indexes
CREATE INDEX idx_study_goals_user_dates ON study_goals(user_id, start_date, target_date);
CREATE INDEX idx_study_goals_unit ON study_goals(unit_id) WHERE unit_id IS NOT NULL;

-- sync_history indexes (para debugging)
CREATE INDEX idx_sync_history_item ON sync_history(schedule_item_id, synced_at DESC);
CREATE INDEX idx_sync_history_user ON sync_history(user_id, synced_at DESC);
```

### 1.3 Row Level Security (RLS)

```sql
-- schedule_items RLS
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule items"
  ON schedule_items FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own schedule items"
  ON schedule_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule items"
  ON schedule_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can soft delete own schedule items"
  ON schedule_items FOR UPDATE
  USING (auth.uid() = user_id);

-- study_goals RLS
ALTER TABLE study_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study goals"
  ON study_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study goals"
  ON study_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study goals"
  ON study_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study goals"
  ON study_goals FOR DELETE
  USING (auth.uid() = user_id);

-- goal_templates RLS
ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system templates and own templates"
  ON goal_templates FOR SELECT
  USING (is_system = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON goal_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can update own templates"
  ON goal_templates FOR UPDATE
  USING (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can delete own templates"
  ON goal_templates FOR DELETE
  USING (auth.uid() = user_id AND is_system = FALSE);

-- sync_history RLS
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync history"
  ON sync_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync history"
  ON sync_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 1.4 Seed Data (Templates do Sistema)

```sql
INSERT INTO goal_templates (name, description, duration_days, intensity, is_system, distribution_config) VALUES
  (
    'Preparação Rápida (1 Semana)',
    'Meta intensiva para revisão rápida antes de provas',
    7,
    'intensive',
    TRUE,
    '{"reviewsPerWeek": 7, "sessionsPerDay": 3, "restDays": []}'::jsonb
  ),
  (
    'Estudo Equilibrado (2 Semanas)',
    'Meta moderada com espaçamento inteligente',
    14,
    'moderate',
    TRUE,
    '{"reviewsPerWeek": 5, "sessionsPerDay": 2, "restDays": [0, 6]}'::jsonb
  ),
  (
    'Aprendizado Profundo (30 Dias)',
    'Meta de longo prazo com FSRS otimizado',
    30,
    'light',
    TRUE,
    '{"reviewsPerWeek": 4, "sessionsPerDay": 1, "restDays": [0]}'::jsonb
  ),
  (
    'Preparação para Concurso (90 Dias)',
    'Meta de preparação intensiva de longo prazo',
    90,
    'moderate',
    TRUE,
    '{"reviewsPerWeek": 6, "sessionsPerDay": 2, "restDays": [0]}'::jsonb
  );
```

### 1.5 Database Functions (Auto-update timestamps)

```sql
-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_schedule_items_updated_at
  BEFORE UPDATE ON schedule_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_goals_updated_at
  BEFORE UPDATE ON study_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 1.6 Realtime Subscriptions

```sql
-- Habilitar realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_items;
ALTER PUBLICATION supabase_realtime ADD TABLE study_goals;
```

---

## Phase 2: Core Hooks (8h)

### 2.1 useScheduleItems Hook

**Arquivo:** `src/hooks/useScheduleItems.ts`

```typescript
import { useServerFirst } from '@/hooks/useServerFirst';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useCallback } from 'react';

export interface ScheduleItem {
  id: string;
  user_id: string;
  unit_id?: string;
  topic_id?: string;
  subtopic_id?: string;
  title: string;
  scheduled_date: string; // ISO date
  completed: boolean;
  completed_at?: string;
  sync_enabled: boolean;
  item_type: 'normal' | 'goal' | 'external';
  study_goal_id?: string;
  estimated_duration?: number;
  actual_duration?: number;
  priority: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface UseScheduleItemsOptions {
  startDate?: Date;
  endDate?: Date;
  unitId?: string;
  topicId?: string;
  subtopicId?: string;
  studyGoalId?: string;
  completed?: boolean;
}

export function useScheduleItems(options: UseScheduleItemsOptions = {}) {
  const {
    data: allItems,
    isLoading,
    create,
    update,
    remove
  } = useServerFirst<ScheduleItem>({
    tableName: 'schedule_items',
    realtime: true,
    cacheTimeout: 5 * 60 * 1000, // 5 min cache
    enableOfflineQueue: true
  });

  // Filtrar items baseado nas opções
  const filteredItems = useMemo(() => {
    if (!allItems) return [];

    return allItems.filter(item => {
      // Filtro de datas
      if (options.startDate && new Date(item.scheduled_date) < options.startDate) {
        return false;
      }
      if (options.endDate && new Date(item.scheduled_date) > options.endDate) {
        return false;
      }

      // Filtros de hierarquia
      if (options.unitId && item.unit_id !== options.unitId) return false;
      if (options.topicId && item.topic_id !== options.topicId) return false;
      if (options.subtopicId && item.subtopic_id !== options.subtopicId) return false;

      // Filtro de meta
      if (options.studyGoalId && item.study_goal_id !== options.studyGoalId) return false;

      // Filtro de completed
      if (options.completed !== undefined && item.completed !== options.completed) return false;

      return true;
    });
  }, [allItems, options]);

  // Agendar um novo item
  const scheduleItem = useCallback(async (data: Omit<ScheduleItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    return await create(data);
  }, [create]);

  // Marcar como completo
  const markComplete = useCallback(async (itemId: string, actualDuration?: number) => {
    return await update(itemId, {
      completed: true,
      completed_at: new Date().toISOString(),
      actual_duration: actualDuration
    });
  }, [update]);

  // Marcar como incompleto
  const markIncomplete = useCallback(async (itemId: string) => {
    return await update(itemId, {
      completed: false,
      completed_at: null,
      actual_duration: null
    });
  }, [update]);

  // Reagendar item
  const reschedule = useCallback(async (itemId: string, newDate: Date) => {
    return await update(itemId, {
      scheduled_date: newDate.toISOString().split('T')[0]
    });
  }, [update]);

  // Soft delete
  const softDelete = useCallback(async (itemId: string) => {
    return await update(itemId, {
      deleted_at: new Date().toISOString()
    });
  }, [update]);

  // Agrupar por data
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};

    filteredItems.forEach(item => {
      if (!grouped[item.scheduled_date]) {
        grouped[item.scheduled_date] = [];
      }
      grouped[item.scheduled_date].push(item);
    });

    return grouped;
  }, [filteredItems]);

  // Estatísticas
  const stats = useMemo(() => {
    const completed = filteredItems.filter(i => i.completed).length;
    const pending = filteredItems.filter(i => !i.completed).length;
    const overdue = filteredItems.filter(i =>
      !i.completed && new Date(i.scheduled_date) < new Date()
    ).length;

    return { completed, pending, overdue, total: filteredItems.length };
  }, [filteredItems]);

  return {
    items: filteredItems,
    itemsByDate,
    stats,
    isLoading,
    scheduleItem,
    updateItem: update,
    removeItem: remove,
    markComplete,
    markIncomplete,
    reschedule,
    softDelete
  };
}
```

### 2.2 useStudyGoals Hook

**Arquivo:** `src/hooks/useStudyGoals.ts`

```typescript
import { useServerFirst } from '@/hooks/useServerFirst';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useCallback } from 'react';
import { useFSRSScheduler } from './useFSRSScheduler';

export interface StudyGoal {
  id: string;
  user_id: string;
  unit_id?: string;
  title: string;
  description?: string;
  start_date: string;
  target_date: string;
  enable_fsrs: boolean;
  intensity: 'light' | 'moderate' | 'intensive';
  progress_percentage: number;
  completed: boolean;
  completed_at?: string;
  template_id?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalTemplate {
  id: string;
  name: string;
  description?: string;
  duration_days: number;
  intensity: 'light' | 'moderate' | 'intensive';
  is_system: boolean;
  distribution_config: {
    reviewsPerWeek: number;
    sessionsPerDay: number;
    restDays: number[];
  };
}

export function useStudyGoals() {
  const {
    data: goals,
    isLoading: goalsLoading,
    create,
    update,
    remove
  } = useServerFirst<StudyGoal>({
    tableName: 'study_goals',
    realtime: true,
    cacheTimeout: 5 * 60 * 1000
  });

  const {
    data: templates,
    isLoading: templatesLoading
  } = useServerFirst<GoalTemplate>({
    tableName: 'goal_templates',
    realtime: false
  });

  const { generateSchedule } = useFSRSScheduler();

  // Criar meta e gerar schedule_items automaticamente
  const createGoalWithSchedule = useCallback(async (
    goalData: Omit<StudyGoal, 'id' | 'user_id' | 'progress_percentage' | 'completed' | 'created_at' | 'updated_at'>,
    topics: Array<{ topicId: string; subtopicId?: string; title: string }>
  ) => {
    // 1. Criar a meta
    const goal = await create(goalData);
    if (!goal) throw new Error('Failed to create goal');

    // 2. Gerar schedule usando FSRS ou distribuição simples
    const scheduleItems = goalData.enable_fsrs
      ? await generateSchedule({
          goalId: goal.id,
          startDate: new Date(goalData.start_date),
          targetDate: new Date(goalData.target_date),
          topics,
          intensity: goalData.intensity
        })
      : generateSimpleSchedule({
          goalId: goal.id,
          startDate: new Date(goalData.start_date),
          targetDate: new Date(goalData.target_date),
          topics,
          intensity: goalData.intensity
        });

    // 3. Inserir todos os schedule_items
    const { error } = await supabase
      .from('schedule_items')
      .insert(scheduleItems);

    if (error) {
      console.error('Failed to create schedule items:', error);
      throw error;
    }

    return { goal, scheduleItems };
  }, [create, generateSchedule]);

  // Atualizar progresso da meta baseado nos schedule_items
  const updateGoalProgress = useCallback(async (goalId: string) => {
    const { data: items, error } = await supabase
      .from('schedule_items')
      .select('completed')
      .eq('study_goal_id', goalId);

    if (error || !items) return;

    const total = items.length;
    const completed = items.filter(i => i.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    await update(goalId, {
      progress_percentage: percentage,
      completed: percentage === 100,
      completed_at: percentage === 100 ? new Date().toISOString() : null
    });
  }, [update]);

  return {
    goals: goals || [],
    templates: templates || [],
    isLoading: goalsLoading || templatesLoading,
    createGoal: create,
    createGoalWithSchedule,
    updateGoal: update,
    removeGoal: remove,
    updateGoalProgress
  };
}

// Função auxiliar para distribuição simples (não-FSRS)
function generateSimpleSchedule(params: {
  goalId: string;
  startDate: Date;
  targetDate: Date;
  topics: Array<{ topicId: string; subtopicId?: string; title: string }>;
  intensity: 'light' | 'moderate' | 'intensive';
}) {
  const { goalId, startDate, targetDate, topics, intensity } = params;

  // Configuração de intensidade
  const config = {
    light: { sessionsPerWeek: 3, restDays: [0, 6] },
    moderate: { sessionsPerWeek: 5, restDays: [0, 6] },
    intensive: { sessionsPerWeek: 7, restDays: [] }
  }[intensity];

  const items: any[] = [];
  const totalDays = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const sessionsPerTopic = Math.max(1, Math.floor((totalDays * config.sessionsPerWeek) / (7 * topics.length)));

  topics.forEach((topic, topicIndex) => {
    for (let session = 0; session < sessionsPerTopic; session++) {
      const dayOffset = Math.floor((topicIndex * sessionsPerTopic + session) * (totalDays / (topics.length * sessionsPerTopic)));
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + dayOffset);

      // Pular dias de descanso
      while (config.restDays.includes(scheduledDate.getDay())) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      items.push({
        study_goal_id: goalId,
        topic_id: topic.topicId,
        subtopic_id: topic.subtopicId,
        title: `${topic.title} - Sessão ${session + 1}`,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        item_type: 'goal',
        sync_enabled: true,
        priority: 5
      });
    }
  });

  return items;
}
```

### 2.3 useFSRSScheduler Hook

**Arquivo:** `src/hooks/useFSRSScheduler.ts`

```typescript
import { useCallback } from 'react';
import { FSRS, Rating, State } from 'ts-fsrs';

interface FSRSScheduleParams {
  goalId: string;
  startDate: Date;
  targetDate: Date;
  topics: Array<{ topicId: string; subtopicId?: string; title: string }>;
  intensity: 'light' | 'moderate' | 'intensive';
}

export function useFSRSScheduler() {
  const fsrs = new FSRS();

  const generateSchedule = useCallback(async (params: FSRSScheduleParams) => {
    const { goalId, startDate, targetDate, topics, intensity } = params;

    // Configuração de intensidade (reviews por semana)
    const reviewsPerWeek = {
      light: 3,
      moderate: 5,
      intensive: 7
    }[intensity];

    const items: any[] = [];

    topics.forEach(topic => {
      // Primeira revisão (New → Learning)
      let currentDate = new Date(startDate);
      let card = fsrs.newCard();

      // Simular primeira revisão (Good rating)
      let scheduling = fsrs.repeat(card, currentDate);
      card = scheduling[Rating.Good].card;

      items.push({
        study_goal_id: goalId,
        topic_id: topic.topicId,
        subtopic_id: topic.subtopicId,
        title: `${topic.title} - Revisão 1`,
        scheduled_date: currentDate.toISOString().split('T')[0],
        item_type: 'goal',
        sync_enabled: true,
        priority: 5,
        estimated_duration: 30
      });

      // Gerar próximas revisões baseado no FSRS
      let reviewCount = 1;
      while (currentDate < targetDate && reviewCount < reviewsPerWeek * 4) { // Max 4 semanas de revisões
        scheduling = fsrs.repeat(card, currentDate);
        const nextCard = scheduling[Rating.Good].card;
        currentDate = nextCard.due;

        if (currentDate > targetDate) break;

        reviewCount++;
        card = nextCard;

        items.push({
          study_goal_id: goalId,
          topic_id: topic.topicId,
          subtopic_id: topic.subtopicId,
          title: `${topic.title} - Revisão ${reviewCount}`,
          scheduled_date: currentDate.toISOString().split('T')[0],
          item_type: 'goal',
          sync_enabled: true,
          priority: 5,
          estimated_duration: 20 // Revisões são mais rápidas
        });
      }
    });

    // Ordenar por data
    items.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

    return items;
  }, []);

  return { generateSchedule };
}
```

---

## Phase 3: UI Components (10h)

### 3.1 ScheduleModal (Agendamento Manual)

**Arquivo:** `src/components/ScheduleModal.tsx`

**Funcionalidade:**
- Modal aberto ao clicar em "Agendar" em qualquer Topic/Subtopic
- Seletor de data (calendar picker)
- Campo de duração estimada
- Campo de prioridade (1-10)
- Campo de notas opcionais
- Toggle de sincronização
- Preview da agenda do dia selecionado (mostra outros itens agendados)

**Props:**
```typescript
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitId?: string;
  topicId?: string;
  subtopicId?: string;
  defaultTitle: string;
}
```

### 3.2 GoalWizard (Criação de Metas)

**Arquivo:** `src/components/GoalWizard.tsx`

**Funcionalidade:**
- Wizard de 3 etapas:
  1. **Configuração Básica**: Nome, descrição, datas, intensidade
  2. **Seleção de Conteúdo**: Multi-select de Topics/Subtopics
  3. **Preview e Confirmação**: Visualizar distribuição do cronograma gerado

**Steps:**
```typescript
// Step 1: Básico
- Input: título da meta
- Textarea: descrição opcional
- DatePicker: data início/fim
- Select: template (ou custom)
- Radio: intensidade (light/moderate/intensive)
- Checkbox: habilitar FSRS

// Step 2: Conteúdo
- TreeView: hierarquia Units > Topics > Subtopics
- Multi-select com checkboxes
- Badge: contador de itens selecionados

// Step 3: Preview
- Calendário visual com distribuição
- Lista de dias com itens agendados
- Estatísticas: total de sessões, média por semana, etc.
- Botão: "Criar Meta" (confirma e insere no banco)
```

### 3.3 ScheduleBadge (Indicador Visual)

**Arquivo:** `src/components/ScheduleBadge.tsx`

**Funcionalidade:**
- Badge exibido ao lado de Topics/Subtopics agendados
- Mostra: próxima data agendada + ícone de calendário
- Cor dinâmica:
  - Verde: agendado para futuro
  - Amarelo: agendado para hoje
  - Vermelho: atrasado (não completado e data passou)
  - Azul: parte de meta FSRS
- Tooltip com detalhes ao hover

**Props:**
```typescript
interface ScheduleBadgeProps {
  scheduleItem: ScheduleItem;
  compact?: boolean; // modo compacto (só ícone)
}
```

### 3.4 GoalDashboard (Painel de Metas)

**Arquivo:** `src/components/GoalDashboard.tsx`

**Funcionalidade:**
- Lista todas as metas ativas do usuário
- Cards com:
  - Título + descrição
  - Progress bar (porcentagem)
  - Datas (início → fim)
  - Badge de intensidade
  - Botão "Ver Cronograma" (filtra CronogramaPage)
  - Botão "Editar/Excluir"

**Localização:** Modal/Sidebar acessível do DocumentsOrganizationPage

### 3.5 CronogramaFilter (Filtro de Visualização)

**Arquivo:** `src/components/CronogramaFilter.tsx`

**Funcionalidade:**
- Filtros para CronogramaPage:
  - Mostrar todos / Só metas / Só agendamentos manuais / Só externos
  - Filtro por meta específica
  - Filtro por Unit/Topic
  - Filtro por status (pendente/concluído/atrasado)

---

## Phase 4: Integração em Documents Organization (6h)

### 4.1 Adicionar Botões de Agendamento

**Arquivo:** `src/pages/DocumentsOrganizationPage.tsx`

**Mudanças:**
1. Adicionar botão "Agendar" em cada TopicItem e SubtopicItem
2. Adicionar botão "Criar Meta" no header da página
3. Exibir ScheduleBadge ao lado de itens agendados
4. Abrir ScheduleModal ao clicar em "Agendar"
5. Abrir GoalWizard ao clicar em "Criar Meta"

**Exemplo de UI:**
```tsx
// No TopicItem
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <span>{topic.name}</span>
    {hasSchedule && <ScheduleBadge scheduleItem={nextSchedule} compact />}
  </div>
  <div className="flex gap-2">
    <Button size="sm" variant="ghost" onClick={() => openScheduleModal(topic)}>
      <CalendarIcon className="w-4 h-4" />
      Agendar
    </Button>
  </div>
</div>
```

### 4.2 Sincronização de Status

**Lógica:**
- Quando completar documento no PlateEditor:
  - Se documento está vinculado a schedule_item com sync_enabled=true
  - Marcar schedule_item como completed automaticamente
  - Registrar em sync_history

**Arquivo:** `src/hooks/usePlateDocuments.ts`

```typescript
// Adicionar ao hook
const markScheduleItemComplete = useCallback(async (subtopicId: string) => {
  const { data } = await supabase
    .from('schedule_items')
    .select('id, sync_enabled')
    .eq('subtopic_id', subtopicId)
    .eq('completed', false)
    .single();

  if (data && data.sync_enabled) {
    await supabase
      .from('schedule_items')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', data.id);

    // Registrar sync
    await supabase.from('sync_history').insert({
      schedule_item_id: data.id,
      changed_field: 'completed',
      old_value: { completed: false },
      new_value: { completed: true },
      sync_source: 'documents'
    });
  }
}, []);
```

---

## Phase 5: Integração em Cronograma (6h)

### 5.1 Migrar de Mock Data para Supabase

**Arquivo:** `src/pages/CronogramaPage.tsx`

**Mudanças:**
1. Remover mock data hardcoded
2. Usar `useScheduleItems()` para buscar dados reais
3. Usar `useStudyGoals()` para buscar metas
4. Manter UI do calendário, mas com dados reais
5. Adicionar CronogramaFilter na UI

### 5.2 Adicionar Ações

**Funcionalidades:**
- Checkbox para marcar item como completo
- Drag & drop para reagendar (Phase 7)
- Menu de contexto (editar, excluir, desabilitar sync)
- Timer integrado (já existe, manter)
- Ao completar: atualizar schedule_item + sync_history

---

## Phase 6: Bidirectional Sync (4h)

### 6.1 Sync: Cronograma → Documents

**Lógica:**
- Quando marcar schedule_item como completo no Cronograma:
  - Se sync_enabled=true
  - Buscar documento vinculado (via subtopic_id)
  - Marcar documento como "completed" (adicionar campo se não existir)
  - Registrar em sync_history

### 6.2 Conflict Resolution

**Cenário:** Item completado em ambos os lados offline

**Solução:**
- Usar timestamp (completed_at) como critério
- Sempre usar a data mais recente
- Mostrar toast ao usuário: "Sincronização resolvida: mantido status de [data]"

### 6.3 Histórico de Sincronização

**Componente:** `SyncHistoryModal.tsx`

**Funcionalidade:**
- Modal acessível via botão "Histórico" em cada schedule_item
- Lista todos os syncs (de sync_history table)
- Mostra: campo alterado, valor antigo → novo, fonte, timestamp
- Útil para debugging

---

## Phase 7: Advanced Features (6h)

### 7.1 Drag & Drop no Cronograma

**Biblioteca:** `@dnd-kit/core`

**Funcionalidade:**
- Arrastar schedule_items entre dias do calendário
- Ao soltar: chamar `reschedule(itemId, newDate)`
- Feedback visual durante drag
- Confirmação se item faz parte de meta FSRS (pode quebrar algoritmo)

### 7.2 Heatmap de Carga

**Componente:** `CalendarHeatmap.tsx`

**Funcionalidade:**
- Colorir dias do calendário baseado em carga:
  - Verde claro: 1-2 itens
  - Amarelo: 3-4 itens
  - Laranja: 5-6 itens
  - Vermelho: 7+ itens
- Usar `estimated_duration` para cálculo mais preciso

### 7.3 Smart Scheduling (IA Simples)

**Hook:** `useSmartScheduler.ts`

**Funcionalidade:**
- Analisar histórico de conclusões do usuário
- Identificar padrões:
  - Horários de maior produtividade (manhã/tarde/noite)
  - Dias da semana com maior taxa de conclusão
  - Tópicos que levam mais tempo
- Sugerir melhores datas/horários ao agendar novo item

**Implementação:**
```typescript
// Análise baseada em sync_history + schedule_items
const analyzeBestTimes = () => {
  // 1. Buscar itens completados dos últimos 30 dias
  // 2. Agrupar por dia da semana
  // 3. Calcular taxa de conclusão por dia
  // 4. Retornar top 3 dias
};
```

### 7.4 Coach Mode (Sugestões)

**Hook:** `src/hooks/useCoachSuggestions.ts`

**Componente:** `src/components/CoachPanel.tsx`

#### 7.4.1 Interface de Sugestões

```typescript
export interface CoachSuggestion {
  id: string;
  type: 'overdue' | 'overload' | 'goal_risk' | 'productivity_pattern' | 'duration_adjustment' |
        'rest_day_violation' | 'positive_streak' | 'neglected_topic' | 'anticipate_study' | 'time_conflict';
  priority: 1 | 2 | 3; // 1 = crítico, 2 = importante, 3 = sugestão
  message: string;
  action?: {
    label: string;
    callback: () => void | Promise<void>;
  };
  dismissible: boolean;
  metadata?: Record<string, any>; // dados extras para a UI
}
```

#### 7.4.2 Hook useCoachSuggestions

**Arquivo:** `src/hooks/useCoachSuggestions.ts`

```typescript
import { useMemo, useCallback } from 'react';
import { useScheduleItems } from './useScheduleItems';
import { useStudyGoals } from './useStudyGoals';
import { supabase } from '@/integrations/supabase/client';

export function useCoachSuggestions() {
  const { items, stats } = useScheduleItems();
  const { goals } = useStudyGoals();

  // Análise de padrões de produtividade
  const productivityAnalysis = useMemo(() => {
    const last30Days = items.filter(item => {
      const daysAgo = Math.floor((Date.now() - new Date(item.completed_at || 0).getTime()) / (1000 * 60 * 60 * 24));
      return item.completed && daysAgo <= 30;
    });

    // Agrupar por dia da semana
    const byWeekday: Record<number, { total: number; completed: number }> = {};

    last30Days.forEach(item => {
      const weekday = new Date(item.scheduled_date).getDay();
      if (!byWeekday[weekday]) byWeekday[weekday] = { total: 0, completed: 0 };
      byWeekday[weekday].total++;
      if (item.completed) byWeekday[weekday].completed++;
    });

    // Calcular taxa de conclusão por dia
    const weekdayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const bestDay = Object.entries(byWeekday)
      .map(([day, data]) => ({
        day: parseInt(day),
        dayName: weekdayNames[parseInt(day)],
        rate: data.total > 0 ? data.completed / data.total : 0,
        total: data.total
      }))
      .filter(d => d.total >= 3) // Mínimo 3 ocorrências
      .sort((a, b) => b.rate - a.rate)[0];

    return { bestDay, byWeekday };
  }, [items]);

  // Análise de duração
  const durationAnalysis = useMemo(() => {
    const itemsWithDuration = items.filter(i => i.estimated_duration && i.actual_duration);

    const topicDurations: Record<string, { estimated: number[]; actual: number[] }> = {};

    itemsWithDuration.forEach(item => {
      if (!item.topic_id) return;
      if (!topicDurations[item.topic_id]) {
        topicDurations[item.topic_id] = { estimated: [], actual: [] };
      }
      topicDurations[item.topic_id].estimated.push(item.estimated_duration!);
      topicDurations[item.topic_id].actual.push(item.actual_duration!);
    });

    // Encontrar tópicos com estimativa muito diferente
    const underestimated = Object.entries(topicDurations)
      .map(([topicId, data]) => {
        const avgEstimated = data.estimated.reduce((a, b) => a + b, 0) / data.estimated.length;
        const avgActual = data.actual.reduce((a, b) => a + b, 0) / data.actual.length;
        const diff = avgActual - avgEstimated;
        return { topicId, avgEstimated, avgActual, diff, count: data.estimated.length };
      })
      .filter(t => t.diff > 10 && t.count >= 2); // Diferença > 10min e mínimo 2 ocorrências

    return { underestimated };
  }, [items]);

  // Geração de sugestões
  const suggestions = useMemo((): CoachSuggestion[] => {
    const result: CoachSuggestion[] = [];

    // 1. Itens atrasados
    if (stats.overdue > 0) {
      result.push({
        id: 'overdue-items',
        type: 'overdue',
        priority: 1,
        message: `Você tem ${stats.overdue} ${stats.overdue === 1 ? 'item atrasado' : 'itens atrasados'}. Deseja reagendar?`,
        action: {
          label: 'Reagendar',
          callback: async () => {
            // Abrir modal de reagendamento em lote
            // TODO: implementar modal
          }
        },
        dismissible: false,
        metadata: { count: stats.overdue }
      });
    }

    // 2. Sobrecarga semanal
    const thisWeekItems = items.filter(item => {
      const date = new Date(item.scheduled_date);
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return date >= weekStart && date < weekEnd && !item.completed;
    });

    const totalHours = thisWeekItems.reduce((acc, item) => acc + (item.estimated_duration || 30), 0) / 60;

    if (thisWeekItems.length >= 8 || totalHours >= 10) {
      result.push({
        id: 'overload-week',
        type: 'overload',
        priority: 2,
        message: `Esta semana tem ${thisWeekItems.length} itens (${totalHours.toFixed(1)}h). Redistribuir?`,
        action: {
          label: 'Redistribuir',
          callback: async () => {
            // Abrir sugestão de redistribuição
          }
        },
        dismissible: true,
        metadata: { count: thisWeekItems.length, hours: totalHours }
      });
    }

    // 3. Metas em risco
    goals.forEach(goal => {
      const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const progress = goal.progress_percentage;

      if (daysLeft <= 7 && progress < 70 && !goal.completed) {
        result.push({
          id: `goal-risk-${goal.id}`,
          type: 'goal_risk',
          priority: 1,
          message: `Meta "${goal.title}" está ${progress}% concluída mas faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}. Intensificar?`,
          action: {
            label: 'Intensificar',
            callback: async () => {
              // Sugerir adicionar mais sessões
            }
          },
          dismissible: false,
          metadata: { goalId: goal.id, daysLeft, progress }
        });
      }
    });

    // 4. Padrão de produtividade
    if (productivityAnalysis.bestDay && productivityAnalysis.bestDay.rate >= 0.75) {
      const pendingItems = items.filter(i => !i.completed && new Date(i.scheduled_date) > new Date());
      const itemsNotOnBestDay = pendingItems.filter(i =>
        new Date(i.scheduled_date).getDay() !== productivityAnalysis.bestDay!.day
      );

      if (itemsNotOnBestDay.length >= 3) {
        result.push({
          id: 'productivity-pattern',
          type: 'productivity_pattern',
          priority: 3,
          message: `Você completa ${Math.round(productivityAnalysis.bestDay.rate * 100)}% nas ${productivityAnalysis.bestDay.dayName}s. Considere reagendar alguns itens.`,
          action: {
            label: 'Ver sugestões',
            callback: async () => {
              // Mostrar lista de itens para reagendar
            }
          },
          dismissible: true,
          metadata: {
            bestDay: productivityAnalysis.bestDay.day,
            rate: productivityAnalysis.bestDay.rate
          }
        });
      }
    }

    // 5. Duração subestimada
    if (durationAnalysis.underestimated.length > 0) {
      const topic = durationAnalysis.underestimated[0];
      result.push({
        id: `duration-adjustment-${topic.topicId}`,
        type: 'duration_adjustment',
        priority: 3,
        message: `Tópico geralmente leva ${Math.round(topic.avgActual)}min (estimado: ${Math.round(topic.avgEstimated)}min). Ajustar futuras?`,
        action: {
          label: 'Ajustar',
          callback: async () => {
            // Atualizar estimated_duration de itens futuros deste tópico
          }
        },
        dismissible: true,
        metadata: { topicId: topic.topicId, avgActual: topic.avgActual }
      });
    }

    // 6. Dias de descanso desrespeitados
    const restDayViolations = items.filter(item => {
      const weekday = new Date(item.scheduled_date).getDay();
      return (weekday === 0 || weekday === 6) && !item.completed; // Domingo ou sábado
    });

    if (restDayViolations.length >= 2) {
      result.push({
        id: 'rest-day-violation',
        type: 'rest_day_violation',
        priority: 2,
        message: `Você tem ${restDayViolations.length} itens em fins de semana. Mover para dias úteis?`,
        action: {
          label: 'Mover',
          callback: async () => {
            // Sugerir reagendamento
          }
        },
        dismissible: true
      });
    }

    // 7. Sequência positiva
    const recentItems = items
      .filter(i => i.completed)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 10);

    const consecutiveDays = new Set(
      recentItems.map(i => new Date(i.completed_at!).toISOString().split('T')[0])
    ).size;

    if (consecutiveDays >= 5) {
      result.push({
        id: 'positive-streak',
        type: 'positive_streak',
        priority: 3,
        message: `🔥 ${consecutiveDays} dias consecutivos concluídos! Continue o ritmo!`,
        dismissible: true,
        metadata: { streak: consecutiveDays }
      });
    }

    // 8. Tópico negligenciado (FSRS)
    const neglectedTopics = items.filter(item => {
      if (!item.last_review || item.item_type !== 'goal') return false;
      const daysSinceReview = Math.floor((Date.now() - new Date(item.last_review).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceReview >= 15;
    });

    if (neglectedTopics.length > 0) {
      const topic = neglectedTopics[0];
      result.push({
        id: `neglected-topic-${topic.id}`,
        type: 'neglected_topic',
        priority: 2,
        message: `"${topic.title}" não é revisado há muito tempo. FSRS recomenda revisar.`,
        action: {
          label: 'Agendar revisão',
          callback: async () => {
            // Criar schedule_item para revisão
          }
        },
        dismissible: true
      });
    }

    // 9. Antecipar estudos (semana leve)
    if (thisWeekItems.length <= 2 && totalHours <= 2) {
      result.push({
        id: 'anticipate-study',
        type: 'anticipate_study',
        priority: 3,
        message: `Semana leve (${thisWeekItems.length} ${thisWeekItems.length === 1 ? 'item' : 'itens'}). Antecipar tópicos futuros?`,
        action: {
          label: 'Ver tópicos',
          callback: async () => {
            // Mostrar próximos tópicos agendados
          }
        },
        dismissible: true
      });
    }

    // 10. Conflito de horários (múltiplos itens no mesmo dia)
    const today = new Date().toISOString().split('T')[0];
    const todayItems = items.filter(i => i.scheduled_date === today && !i.completed);

    if (todayItems.length >= 3) {
      result.push({
        id: 'time-conflict',
        type: 'time_conflict',
        priority: 1,
        message: `${todayItems.length} itens agendados para hoje. Priorizar qual?`,
        action: {
          label: 'Priorizar',
          callback: async () => {
            // Abrir interface de priorização
          }
        },
        dismissible: false
      });
    }

    // Ordenar por prioridade
    return result.sort((a, b) => a.priority - b.priority);
  }, [items, stats, goals, productivityAnalysis, durationAnalysis]);

  // Ação de dismiss
  const dismissSuggestion = useCallback((suggestionId: string) => {
    // TODO: Salvar dismissal no localStorage ou banco
    console.log('Dismissed suggestion:', suggestionId);
  }, []);

  return {
    suggestions,
    dismissSuggestion,
    analytics: {
      productivityAnalysis,
      durationAnalysis
    }
  };
}
```

#### 7.4.3 Componente CoachPanel

**Arquivo:** `src/components/CoachPanel.tsx`

```typescript
import { useCoachSuggestions, CoachSuggestion } from '@/hooks/useCoachSuggestions';
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function CoachPanel() {
  const { suggestions, dismissSuggestion } = useCoachSuggestions();

  const getPriorityIcon = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 2: return <Info className="w-5 h-5 text-yellow-500" />;
      case 3: return <CheckCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return 'border-red-200 bg-red-50';
      case 2: return 'border-yellow-200 bg-yellow-50';
      case 3: return 'border-blue-200 bg-blue-50';
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
        <p className="font-medium">Tudo certo por aqui!</p>
        <p className="text-sm mt-1">Sem sugestões no momento.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        🤖 Coach de Estudos
        <span className="text-xs font-normal text-muted-foreground">
          ({suggestions.length} {suggestions.length === 1 ? 'sugestão' : 'sugestões'})
        </span>
      </h3>

      {suggestions.map((suggestion) => (
        <Card
          key={suggestion.id}
          className={`p-4 border-2 ${getPriorityColor(suggestion.priority)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getPriorityIcon(suggestion.priority)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {suggestion.message}
              </p>

              {suggestion.action && (
                <Button
                  variant="default"
                  size="sm"
                  className="mt-3"
                  onClick={suggestion.action.callback}
                >
                  {suggestion.action.label}
                </Button>
              )}
            </div>

            {suggestion.dismissible && (
              <button
                onClick={() => dismissSuggestion(suggestion.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
```

#### 7.4.4 Integração no CronogramaPage

```tsx
// No CronogramaPage.tsx
import { CoachPanel } from '@/components/CoachPanel';

export function CronogramaPage() {
  return (
    <div className="flex gap-6">
      {/* Área principal do calendário */}
      <div className="flex-1">
        {/* ... calendário ... */}
      </div>

      {/* Painel lateral do Coach */}
      <aside className="w-96 flex-shrink-0">
        <CoachPanel />
      </aside>
    </div>
  );
}
```

#### 7.4.5 Melhorias Futuras

**Persistência de dismissals:**
```typescript
// Salvar no localStorage ou Supabase
const dismissedSuggestions = JSON.parse(localStorage.getItem('dismissedSuggestions') || '[]');

// Filtrar sugestões já dispensadas
const filteredSuggestions = suggestions.filter(s => !dismissedSuggestions.includes(s.id));
```

**Análise mais profunda:**
- Usar histórico de 90 dias ao invés de 30
- Análise de correlação (tópicos difíceis vs horário do dia)
- Machine learning real (regressão linear para prever duração)
- Integração com calendário externo (Google Calendar) para evitar conflitos

**Gamificação:**
- Badges por sequências longas (🔥 streak de 10 dias)
- XP por seguir sugestões do coach
- Ranking de produtividade semanal

---

## Phase 8: Polish & Performance (4h)

### 8.1 Otimizações

1. **Virtual Scrolling** no calendário (biblioteca: `react-window`)
2. **Lazy Loading** de schedule_items por range de data
3. **Debounce** em filtros (evitar re-renders excessivos)
4. **Memoization** de cálculos pesados (heatmap, stats)

### 8.2 Loading States

- Skeletons para todos os componentes principais
- Loading spinners em ações assíncronas
- Error boundaries para capturar crashes

### 8.3 Acessibilidade

- Garantir navegação por teclado em modais
- ARIA labels em botões/ícones
- Focus trap em modais
- Anúncios de screen reader para ações completadas

### 8.4 Testes

**Prioridades:**
1. Testes E2E (Playwright):
   - Fluxo completo: criar meta → visualizar no cronograma → marcar completo → verificar sync
   - Agendamento manual → completar documento → verificar sync reverso

2. Testes unitários (Vitest):
   - Hooks: useScheduleItems, useStudyGoals, useFSRSScheduler
   - Funções de distribuição (generateSimpleSchedule)

---

## Ordem de Implementação Recomendada

Para maximizar entregas incrementais:

1. ✅ **Phase 1** (Database) - Base de tudo
2. ✅ **Phase 2** (Hooks) - Lógica de negócio
3. ✅ **Phase 3A** (ScheduleModal + ScheduleBadge) - MVP de agendamento
4. ✅ **Phase 4** (Documents Organization) - Entrega valor rapidamente
5. ✅ **Phase 3B** (GoalWizard + GoalDashboard) - Funcionalidade avançada
6. ✅ **Phase 5** (Cronograma) - Integração completa
7. ✅ **Phase 6** (Bidirectional Sync) - Sistema robusto
8. ✅ **Phase 7** (Advanced Features) - Diferencial competitivo
9. ✅ **Phase 8** (Polish) - Produção ready

**Entregas Incrementais:**
- Após Phase 4: Usuário já pode agendar manualmente
- Após Phase 5: Sistema básico completo
- Após Phase 6: Sistema robusto com sync
- Após Phase 7-8: Produto premium

---

## Checklist de Implementação

### Phase 1: Database
- [ ] Criar tabelas (schedule_items, study_goals, goal_templates, sync_history)
- [ ] Criar indexes
- [ ] Configurar RLS policies
- [ ] Criar database functions (triggers)
- [ ] Inserir seed data (templates)
- [ ] Habilitar realtime subscriptions
- [ ] Testar queries no Supabase Studio

### Phase 2: Hooks
- [ ] Implementar useScheduleItems
- [ ] Implementar useStudyGoals
- [ ] Implementar useFSRSScheduler
- [ ] Testar hooks isoladamente
- [ ] Adicionar error handling

### Phase 3A: UI Básico
- [ ] Criar ScheduleModal
- [ ] Criar ScheduleBadge
- [ ] Integrar componentes

### Phase 3B: UI Avançado
- [ ] Criar GoalWizard (3 steps)
- [ ] Criar GoalDashboard
- [ ] Criar CronogramaFilter

### Phase 4: Documents Organization
- [ ] Adicionar botões "Agendar"
- [ ] Adicionar botão "Criar Meta"
- [ ] Exibir ScheduleBadges
- [ ] Implementar sync ao completar documento
- [ ] Testar fluxo completo

### Phase 5: Cronograma
- [ ] Remover mock data
- [ ] Integrar useScheduleItems
- [ ] Integrar useStudyGoals
- [ ] Adicionar CronogramaFilter
- [ ] Implementar ações (complete, edit, delete)
- [ ] Testar fluxo completo

### Phase 6: Sync
- [ ] Implementar sync Cronograma → Documents
- [ ] Implementar conflict resolution
- [ ] Criar SyncHistoryModal
- [ ] Testar sync bidirecional

### Phase 7: Advanced
- [ ] Implementar drag & drop
- [ ] Criar CalendarHeatmap
- [ ] Implementar useSmartScheduler
- [ ] Criar CoachPanel

### Phase 8: Polish
- [ ] Otimizar performance (virtual scrolling, lazy loading)
- [ ] Adicionar loading states
- [ ] Melhorar acessibilidade
- [ ] Escrever testes E2E
- [ ] Escrever testes unitários

---

## Notas de Implementação

### Performance
- Sempre usar indexes nas queries de schedule_items (tabela crescerá muito)
- Cache de 5min é suficiente - realtime sync cuida de updates
- Virtual scrolling é crítico para calendários com 100+ itens

### UX/UI
- Sempre mostrar feedback visual imediato (optimistic updates)
- Toast notifications para todas as ações (agendado, completado, sincronizado)
- Confirmação antes de deletar itens de metas FSRS

### Segurança
- RLS policies garantem isolamento por usuário
- Soft delete permite recovery de dados
- Audit logs (sync_history) para compliance

### Manutenibilidade
- Hooks isolados facilitam testes
- Componentes desacoplados permitem reutilização
- Database schema extensível (JSONB em distribution_config)

---

## Estimativa Final

| Phase | Horas | Dias (8h/dia) |
|-------|-------|---------------|
| 1. Database | 6h | 0.75 |
| 2. Hooks | 8h | 1.0 |
| 3. UI Components | 10h | 1.25 |
| 4. Documents Org | 6h | 0.75 |
| 5. Cronograma | 6h | 0.75 |
| 6. Sync | 4h | 0.5 |
| 7. Advanced | 6h | 0.75 |
| 8. Polish | 4h | 0.5 |
| **Total** | **50h** | **6.25 dias** |

**Buffer de 20% para imprevistos:** 60h (~7.5 dias)

---

## Próximos Passos

1. Revisar este plano com o time
2. Criar branch `feature/cronograma-integration`
3. Começar com Phase 1 (Database)
4. Fazer commits atômicos por fase
5. Code review após cada phase
6. Deploy incremental (feature flags se necessário)

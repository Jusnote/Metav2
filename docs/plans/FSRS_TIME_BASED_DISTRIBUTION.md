# Sistema de Distribuição Inteligente Baseado em Tempo - FSRS

> **Objetivo**: Transformar o sistema de metas FSRS para permitir seleção granular de subtópicos com distribuição inteligente baseada em tempo estimado de conclusão, considerando tópicos manuais já agendados.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Motivação e Problema](#motivação-e-problema)
3. [Solução Proposta](#solução-proposta)
4. [Arquitetura](#arquitetura)
5. [Database Schema](#database-schema)
6. [Componentes de Interface](#componentes-de-interface)
7. [Lógica de Distribuição](#lógica-de-distribuição)
8. [🚨 CRÍTICO: Sistema de Prioridade de Revisões](#-crítico-sistema-de-prioridade-de-revisões)
9. [Algoritmo de Encaixe Inteligente](#algoritmo-de-encaixe-inteligente)
10. [Detecção de Conflitos](#detecção-de-conflitos)
11. [Fluxo Completo](#fluxo-completo)
12. [Plano de Implementação](#plano-de-implementação)
13. [Cenários de Teste](#cenários-de-teste)

---

## 🎯 Visão Geral

### O que será implementado?

- ✅ **Seleção granular**: Escolher subtópicos individuais (não tópicos inteiros)
- ✅ **Tempo estimado**: Cada tópico/subtópico tem duração estimada em minutos
- ✅ **Distribuição inteligente**: Algoritmo que adapta a qualquer cenário (10 subtópicos em 7 dias, etc)
- ✅ **Tópicos híbridos**: Considera tópicos manuais já agendados no cronograma
- ✅ **Preview visual**: Usuário vê resumo antes de criar a meta
- ✅ **Alertas inteligentes**: Avisa sobrecarga, falta de espaço, conflitos

---

## 🔍 Motivação e Problema

### Problemas Atuais

1. **Seleção inflexível**: Ao selecionar um tópico com 10 subtópicos, todos são incluídos (não há escolha)
2. **Baseado em flashcards**: Se o subtópico não tem cards criados, não tem como estimar tempo
3. **Sem considerar manuais**: Tópicos manuais já agendados não são considerados na distribuição
4. **Distribuição ingênua**: Não se adapta a cenários complexos (mais subtópicos que dias disponíveis)

### O que os Usuários Precisam

- "Quero estudar apenas 3 dos 8 subtópicos de Direito Constitucional"
- "Tenho 10 subtópicos para estudar em 7 dias, como distribuir?"
- "Já agendei tópicos manuais em alguns dias, onde encaixar os FSRS?"
- "Quanto tempo total vai levar? Vai caber no período?"

---

## 💡 Solução Proposta

### 1. Tempo Estimado de Conclusão

Cada tópico/subtópico terá campo `estimated_duration_minutes`:

```typescript
interface Subtopic {
  id: string;
  title: string;
  estimated_duration_minutes: number; // Ex: 150 (2h30min)
  // ... outros campos
}
```

**Por que tempo e não quantidade de flashcards?**
- ✅ Mais intuitivo: "Este assunto leva 2 horas para estudar"
- ✅ Funciona sem flashcards criados ainda
- ✅ Considera todo o processo: leitura + flashcards + questões
- ✅ Usuário pensa naturalmente em tempo, não em quantidade de cards

---

### 📌 REGRA CRÍTICA: Tópicos vs Subtópicos

#### **Tópico COM subtópicos:**
- ✅ Tempo é **calculado automaticamente** (soma dos subtópicos)
- ✅ Campo `estimated_duration_minutes` **somente leitura**
- ✅ **NÃO é estudado diretamente** (apenas agrupa subtópicos)
- ✅ Se tinha tempo manual antes de adicionar subtópicos, é **sobrescrito** automaticamente
- ❌ **NÃO cria schedule_items** para o tópico pai

**Exemplo:**
```
Tópico: Direito Constitucional (calculado: 3h30)
  ├─ Subtópico: Princípios Fundamentais (1h30) ← ESTE é estudado
  ├─ Subtópico: Direitos Sociais (1h) ← ESTE é estudado
  └─ Subtópico: Organização do Estado (1h) ← ESTE é estudado

Schedule items criados: 6 items
  - Princípios - Parte 1 (54min)
  - Princípios - Parte 2 (36min)
  - Direitos Sociais - Parte 1 (36min)
  - Direitos Sociais - Parte 2 (24min)
  - Organização - Parte 1 (36min)
  - Organização - Parte 2 (24min)

Total de estudo = 3h30 (soma dos subtópicos)
```

#### **Tópico SEM subtópicos:**
- ✅ Tempo é **definido manualmente** pelo usuário
- ✅ Campo `estimated_duration_minutes` **editável**
- ✅ **É estudado diretamente**
- ✅ **Cria schedule_items** para o tópico

**Exemplo:**
```
Tópico: Resumo Geral de Direito Penal (2h)
  └─ (sem subtópicos)

Schedule items criados: 2 items
  - Resumo Geral - Parte 1 (72min)
  - Resumo Geral - Parte 2 (48min)

Total de estudo = 2h
```

#### **Comportamento ao adicionar primeiro subtópico:**
```
1. Usuário cria tópico → define 120min manualmente
   └─ estimated_duration_minutes = 120

2. Usuário adiciona subtópico (90min)
   └─ Sistema recalcula AUTOMATICAMENTE
   └─ estimated_duration_minutes = 90 (sobrescreve 120min)
   └─ Sem avisos ao usuário

3. Usuário adiciona segundo subtópico (60min)
   └─ Sistema recalcula AUTOMATICAMENTE
   └─ estimated_duration_minutes = 150 (90 + 60)
```

#### **Recalculo Automático:**
O sistema recalcula o tempo do tópico pai automaticamente quando:
- ✅ Subtópico é **criado**
- ✅ Subtópico é **editado** (tempo alterado)
- ✅ Subtópico é **deletado**

### 2. Interface Hierárquica de Seleção

```
┌─────────────────────────────────────────────────────────┐
│ Selecione o conteúdo para a meta:                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ☑ Direito Constitucional (3h 30min) ← Checkbox master   │
│   ☑ Princípios Fundamentais (1h 30min)                  │
│   ☑ Direitos e Garantias (1h)                           │
│   ☐ Organização do Estado (1h)                          │
│                                                          │
│   💡 2 de 3 subtópicos selecionados (2h 30min)          │
│                                                          │
│ ☐ Direito Administrativo (6h) ← Nenhum selecionado      │
│   ☐ Princípios da Administração (1h 30min)              │
│   ☐ Atos Administrativos (2h)                           │
│   ☐ Contratos Administrativos (2h 30min)                │
│                                                          │
│   💡 0 de 3 subtópicos selecionados                      │
│                                                          │
│ ☑ Resumo de Direito Penal (2h) ← Tópico sem subtópicos  │
│   └─ (sem subtópicos - será estudado diretamente)       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Total selecionado:                                       │
│   • 2 subtópicos (2h 30min)                              │
│   • 1 tópico sem subtópicos (2h)                         │
│   • TOTAL: 4h 30min                                      │
└─────────────────────────────────────────────────────────┘
```

**Comportamento dos checkboxes:**

#### **Tópico COM subtópicos:**
- ☑ **Checkbox do tópico**: Seleciona/deseleciona **TODOS os subtópicos** (atalho)
- ☑ **Checkbox individual**: Permite escolher subtópicos específicos
- ⬜ **Estado "indeterminate"**: Quando alguns (não todos) subtópicos estão selecionados
- ❌ **NÃO cria schedule_item para o tópico**: Apenas para os subtópicos selecionados

#### **Tópico SEM subtópicos:**
- ☑ **Checkbox do tópico**: Seleciona o tópico para estudo direto
- ✅ **Cria schedule_item para o tópico**: Parte 1 + Parte 2

#### **Outros:**
- 💡 **Contador dinâmico**: Atualiza em tempo real
- ⏱️ **Tempo total**: Soma dos tempos estimados dos itens selecionados

### 3. Algoritmo de Distribuição Inteligente

#### Cenário A: Mais dias que subtópicos (3 subtópicos, 7 dias)
```
Dia 1: Sub1 - Parte 1 (1h)
Dia 2: Sub1 - Parte 2 (40min)
Dia 3: Sub2 - Parte 1 (1h 30min)
Dia 4: Sub2 - Parte 2 (1h) + Sub1 - Revisão 1 (15min)
Dia 5: Sub3 - Parte 1 (45min)
Dia 6: Sub3 - Parte 2 (30min) + Sub2 - Revisão 1 (15min)
Dia 7: Livre (revisões opcionais)
```

#### Cenário B: Mais subtópicos que dias (10 subtópicos, 7 dias, moderate = 2h/dia)
```
Dia 1: Sub1 - Parte 1 (1h) + Sub2 - Parte 1 (1h)
Dia 2: Sub1 - Parte 2 (40min) + Sub2 - Parte 2 (40min) + Sub3 - Parte 1 (30min)
Dia 3: Sub3 - Parte 2 (20min) + Sub4 - Parte 1 (1h) + Sub4 - Parte 2 (40min)
... (continua agrupando inteligentemente)
```

#### Cenário C: Com tópicos manuais já agendados
```
Dia 1: [MANUAL] Estudo Livre (1h) + [FSRS] Sub1 - Parte 1 (1h)
Dia 2: [MANUAL] Revisão (30min) + [FSRS] Sub1 - Parte 2 (40min) + Sub2 - Parte 1 (50min)
Dia 3: [FSRS] Sub2 - Parte 2 (40min) + Sub3 - Parte 1 (1h 20min)
```

### 4. Preview Visual Antes de Criar Meta

```
┌───────────────────────────────────────────────────┐
│ 📊 Resumo da Meta                                 │
├───────────────────────────────────────────────────┤
│                                                   │
│ Subtópicos selecionados: 5                        │
│                                                   │
│ ⏱️ Tempo total estimado:                          │
│   • Princípios Fundamentais: 2h 30min             │
│   • Direitos Sociais: 1h 45min                    │
│   • Direitos Políticos: 1h 15min                  │
│   • Nacionalidade: 1h 30min                       │
│   • Partidos Políticos: 1h 00min                  │
│   ──────────────────────────────                  │
│   TOTAL: 8 horas                                  │
│                                                   │
│ 📅 Distribuição:                                  │
│   • Período: 7 dias (16/10 - 23/10)               │
│   • Intensidade: Moderada (2h/dia)                │
│   • Capacidade total: 14 horas                    │
│   ✅ Espaço livre: 6 horas (43%)                  │
│                                                   │
│ ⚠️ Conflitos detectados:                          │
│   • Dia 18/10: 1h ocupada (tópico manual)         │
│     └─ Capacidade reduzida para 1h neste dia      │
│   • Dia 20/10: 2h ocupadas (tópico manual)        │
│     └─ Dia totalmente ocupado, FSRS pula          │
│                                                   │
│ 💡 Previsão de conclusão: 22/10/2025              │
│                                                   │
│ [Cancelar] [Ajustar Período] [✓ Criar Meta]      │
└───────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitetura

### Fluxo de Dados

```
┌─────────────────┐
│ GoalCreation    │
│ Dialog          │
│                 │
│ 1. Usuário      │
│    seleciona    │
│    subtópicos   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SubtopicSelector│ ← Interface hierárquica
│ Component       │   com checkboxes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Preview         │ ← Calcula preview em
│ Calculation     │   tempo real
│                 │
│ • Total tempo   │
│ • Detecta       │
│   conflitos     │
│ • Calcula slots │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Usuário         │
│ confirma        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useStudyGoals   │
│ .createGoal()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useFSRS         │
│ Scheduler       │
│                 │
│ .generateSchedule()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ calculateAvail- │ ← Busca tópicos
│ ableSlots()     │   manuais existentes
│                 │
│ • Por dia:      │
│   capacidade vs │
│   usado         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ distributeByTime│ ← Algoritmo principal
│ ()              │
│                 │
│ 1. Ordena por   │
│    duração      │
│ 2. Divide em    │
│    Parte 1/2    │
│ 3. Encaixa nos  │
│    slots        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Insere no DB    │
│ schedule_items  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CronogramaPage  │ ← Exibe items FSRS
│                 │   + tópicos manuais
│ • Capacidade    │
│   diária        │
│ • Alertas       │
└─────────────────┘
```

---

## 🗄️ Database Schema

### Migração SQL

```sql
-- Arquivo: supabase/migrations/20250117_add_estimated_duration.sql

-- Adicionar campo de duração estimada em minutos
ALTER TABLE topics
ADD COLUMN estimated_duration_minutes INTEGER DEFAULT 120;

ALTER TABLE subtopics
ADD COLUMN estimated_duration_minutes INTEGER DEFAULT 90;

-- Adicionar índices para performance
CREATE INDEX idx_topics_duration ON topics(estimated_duration_minutes);
CREATE INDEX idx_subtopics_duration ON subtopics(estimated_duration_minutes);

-- Comentários para documentação
COMMENT ON COLUMN topics.estimated_duration_minutes IS
'Tempo estimado total de conclusão em minutos (inclui leitura + flashcards + questões). Parte 1 = 60%, Parte 2 = 40%';

COMMENT ON COLUMN subtopics.estimated_duration_minutes IS
'Tempo estimado total de conclusão em minutos (inclui leitura + flashcards + questões). Parte 1 = 60%, Parte 2 = 40%';

-- Atualizar registros existentes com valores padrão
UPDATE topics
SET estimated_duration_minutes = 120
WHERE estimated_duration_minutes IS NULL;

UPDATE subtopics
SET estimated_duration_minutes = 90
WHERE estimated_duration_minutes IS NULL;

-- Tornar NOT NULL após atualizar valores
ALTER TABLE topics
ALTER COLUMN estimated_duration_minutes SET NOT NULL;

ALTER TABLE subtopics
ALTER COLUMN estimated_duration_minutes SET NOT NULL;
```

### Tipos TypeScript

```typescript
// src/types/database.ts

export interface Topic {
  id: string;
  title: string;
  estimated_duration_minutes: number; // NOVO
  // ... outros campos
}

export interface Subtopic {
  id: string;
  topic_id: string;
  title: string;
  estimated_duration_minutes: number; // NOVO
  // ... outros campos
}
```

---

## 🎨 Componentes de Interface

### 1. TimeEstimateInput Component

**Arquivo**: `src/components/goals/TimeEstimateInput.tsx`

```tsx
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TimeEstimateInputProps {
  value: number; // minutos
  onChange: (minutes: number) => void;
  label?: string;
  error?: string;
}

const PRESETS = [
  { label: 'Rápido', minutes: 45 },
  { label: 'Médio', minutes: 90 },
  { label: 'Longo', minutes: 150 },
  { label: 'Muito Longo', minutes: 240 },
];

export function TimeEstimateInput({
  value,
  onChange,
  label = 'Tempo estimado de conclusão',
  error,
}: TimeEstimateInputProps) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  const handleHoursChange = (h: number) => {
    onChange(h * 60 + minutes);
  };

  const handleMinutesChange = (m: number) => {
    onChange(hours * 60 + m);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-sm">
              Tempo total estimado incluindo leitura, flashcards e questões.
              <br />
              Parte 1 (60%) = leitura + flashcards
              <br />
              Parte 2 (40%) = questões
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Inputs de horas e minutos */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            type="number"
            min="0"
            max="10"
            value={hours}
            onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
          <span className="text-xs text-muted-foreground mt-1 block">horas</span>
        </div>
        <span className="text-2xl text-muted-foreground">:</span>
        <div className="flex-1">
          <Input
            type="number"
            min="0"
            max="59"
            step="5"
            value={minutes}
            onChange={(e) => handleMinutesChange(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
          <span className="text-xs text-muted-foreground mt-1 block">minutos</span>
        </div>
      </div>

      {/* Presets rápidos */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant={value === preset.minutes ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(preset.minutes)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Total em minutos (para debug) */}
      <p className="text-xs text-muted-foreground">
        Total: {value} minutos
      </p>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
```

**Uso:**
```tsx
<TimeEstimateInput
  value={durationMinutes}
  onChange={setDurationMinutes}
/>
```

---

### 2. SubtopicSelector Component

**Arquivo**: `src/components/goals/SubtopicSelector.tsx`

```tsx
import React, { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subtopic {
  id: string;
  title: string;
  estimated_duration_minutes: number;
}

interface Topic {
  id: string;
  title: string;
  estimated_duration_minutes: number;
  subtopics: Subtopic[];
}

interface SubtopicSelectorProps {
  topics: Topic[];
  selectedSubtopics: string[]; // Array de subtopic IDs
  onChange: (selectedIds: string[]) => void;
}

export function SubtopicSelector({
  topics,
  selectedSubtopics,
  onChange,
}: SubtopicSelectorProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const isTopicExpanded = (topicId: string) => expandedTopics.has(topicId);

  // Verificar se todos os subtópicos de um tópico estão selecionados
  const isTopicFullySelected = (topic: Topic) => {
    return topic.subtopics.every((sub) =>
      selectedSubtopics.includes(sub.id)
    );
  };

  // Verificar se algum (mas não todos) subtópico está selecionado
  const isTopicPartiallySelected = (topic: Topic) => {
    const someSelected = topic.subtopics.some((sub) =>
      selectedSubtopics.includes(sub.id)
    );
    const allSelected = isTopicFullySelected(topic);
    return someSelected && !allSelected;
  };

  // Toggle todos os subtópicos de um tópico
  const toggleTopicSelection = (topic: Topic) => {
    const allSelected = isTopicFullySelected(topic);
    const subtopicIds = topic.subtopics.map((sub) => sub.id);

    if (allSelected) {
      // Desselecionar todos
      onChange(
        selectedSubtopics.filter((id) => !subtopicIds.includes(id))
      );
    } else {
      // Selecionar todos
      const newSelection = [
        ...selectedSubtopics.filter((id) => !subtopicIds.includes(id)),
        ...subtopicIds,
      ];
      onChange(newSelection);
    }
  };

  // Toggle um subtópico individual
  const toggleSubtopicSelection = (subtopicId: string) => {
    if (selectedSubtopics.includes(subtopicId)) {
      onChange(selectedSubtopics.filter((id) => id !== subtopicId));
    } else {
      onChange([...selectedSubtopics, subtopicId]);
    }
  };

  // Formatar tempo
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  // Calcular totais
  const totals = useMemo(() => {
    const selectedSubs = topics.flatMap((t) => t.subtopics).filter((sub) =>
      selectedSubtopics.includes(sub.id)
    );
    const totalMinutes = selectedSubs.reduce(
      (sum, sub) => sum + sub.estimated_duration_minutes,
      0
    );
    return {
      count: selectedSubs.length,
      duration: totalMinutes,
    };
  }, [topics, selectedSubtopics]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {topics.map((topic) => {
          const isExpanded = isTopicExpanded(topic.id);
          const isFullySelected = isTopicFullySelected(topic);
          const isPartiallySelected = isTopicPartiallySelected(topic);
          const selectedCount = topic.subtopics.filter((sub) =>
            selectedSubtopics.includes(sub.id)
          ).length;
          const selectedDuration = topic.subtopics
            .filter((sub) => selectedSubtopics.includes(sub.id))
            .reduce((sum, sub) => sum + sub.estimated_duration_minutes, 0);

          return (
            <div
              key={topic.id}
              className="border rounded-lg p-3 space-y-2"
            >
              {/* Header do Tópico */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  className="mt-1 text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <Checkbox
                  checked={isFullySelected}
                  ref={(el) => {
                    if (el && isPartiallySelected) {
                      el.indeterminate = true;
                    }
                  }}
                  onCheckedChange={() => toggleTopicSelection(topic)}
                  className="mt-1"
                />

                <div className="flex-1">
                  <Label
                    className="font-semibold cursor-pointer"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {topic.title}
                  </Label>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(topic.estimated_duration_minutes)}
                    </span>
                    {selectedCount > 0 && (
                      <span className="text-blue-600 font-medium">
                        {selectedCount} de {topic.subtopics.length} selecionados
                        ({formatDuration(selectedDuration)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subtópicos */}
              {isExpanded && topic.subtopics.length > 0 && (
                <div className="ml-10 space-y-2 pt-2 border-t">
                  {topic.subtopics.map((subtopic) => (
                    <div
                      key={subtopic.id}
                      className="flex items-center gap-3"
                    >
                      <Checkbox
                        checked={selectedSubtopics.includes(subtopic.id)}
                        onCheckedChange={() =>
                          toggleSubtopicSelection(subtopic.id)
                        }
                      />
                      <Label className="flex-1 cursor-pointer text-sm">
                        {subtopic.title}
                      </Label>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(subtopic.estimated_duration_minutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Se não tem subtópicos */}
              {isExpanded && topic.subtopics.length === 0 && (
                <p className="ml-10 text-sm text-muted-foreground italic">
                  Nenhum subtópico criado ainda
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Totais */}
      <div className="border-t pt-3 flex items-center justify-between text-sm font-medium">
        <span>Total selecionado:</span>
        <span className="text-blue-600">
          {totals.count} subtópicos ({formatDuration(totals.duration)})
        </span>
      </div>
    </div>
  );
}
```

**Uso:**
```tsx
<SubtopicSelector
  topics={allTopicsWithSubtopics}
  selectedSubtopics={selectedSubtopicIds}
  onChange={setSelectedSubtopicIds}
/>
```

---

### 3. GoalPreviewSummary Component

**Arquivo**: `src/components/goals/GoalPreviewSummary.tsx`

```tsx
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Target,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SelectedSubtopic {
  id: string;
  title: string;
  estimated_duration_minutes: number;
}

interface Conflict {
  date: Date;
  usedMinutes: number;
  availableMinutes: number;
  overload: number;
}

interface GoalPreviewSummaryProps {
  selectedSubtopics: SelectedSubtopic[];
  startDate: Date;
  endDate: Date;
  intensity: 'light' | 'moderate' | 'intense';
  conflicts: Conflict[];
}

const INTENSITY_CAPACITY = {
  light: 60,
  moderate: 120,
  intense: 240,
};

const INTENSITY_LABELS = {
  light: 'Leve (1h/dia)',
  moderate: 'Moderada (2h/dia)',
  intense: 'Intensa (4h/dia)',
};

export function GoalPreviewSummary({
  selectedSubtopics,
  startDate,
  endDate,
  intensity,
  conflicts,
}: GoalPreviewSummaryProps) {
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  const totalMinutes = selectedSubtopics.reduce(
    (sum, sub) => sum + sub.estimated_duration_minutes,
    0
  );

  const totalDays =
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const dailyCapacity = INTENSITY_CAPACITY[intensity];
  const totalCapacity = totalDays * dailyCapacity;
  const remainingCapacity = totalCapacity - totalMinutes;
  const capacityPercentage = Math.min(
    100,
    Math.round((totalMinutes / totalCapacity) * 100)
  );

  const hasOverload = remainingCapacity < 0;
  const hasConflicts = conflicts.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Resumo da Meta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subtópicos selecionados */}
          <div>
            <p className="text-sm font-medium mb-2">
              Subtópicos selecionados: {selectedSubtopics.length}
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedSubtopics.map((sub) => (
                <div
                  key={sub.id}
                  className="text-sm flex items-center justify-between px-2 py-1 bg-muted/50 rounded"
                >
                  <span>{sub.title}</span>
                  <span className="text-muted-foreground">
                    {formatDuration(sub.estimated_duration_minutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tempo total */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Tempo total estimado:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatDuration(totalMinutes)}
              </span>
            </div>
          </div>

          {/* Distribuição */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium mb-2">📅 Distribuição:</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Período:</span>
                <span>
                  {totalDays} dias ({format(startDate, 'dd/MM', { locale: ptBR })}{' '}
                  - {format(endDate, 'dd/MM', { locale: ptBR })})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Intensidade:</span>
                <span>{INTENSITY_LABELS[intensity]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Capacidade total:</span>
                <span>{formatDuration(totalCapacity)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Espaço livre:</span>
                <span
                  className={
                    hasOverload
                      ? 'text-destructive font-medium'
                      : 'text-green-600 font-medium'
                  }
                >
                  {hasOverload ? '-' : ''}
                  {formatDuration(Math.abs(remainingCapacity))} (
                  {Math.abs(100 - capacityPercentage)}%)
                </span>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="pt-2">
              <Progress
                value={capacityPercentage}
                className={hasOverload ? 'bg-destructive/20' : ''}
              />
            </div>
          </div>

          {/* Alertas */}
          {hasOverload && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Sobrecarga detectada!</strong>
                <br />
                Você selecionou {formatDuration(totalMinutes)} de conteúdo, mas
                só tem {formatDuration(totalCapacity)} disponíveis no período.
                <br />
                <br />
                <strong>Sugestões:</strong>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Aumentar o período da meta</li>
                  <li>Aumentar a intensidade</li>
                  <li>Reduzir o número de subtópicos selecionados</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {hasConflicts && !hasOverload && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Conflitos detectados:</strong>
                <br />
                <div className="mt-2 space-y-1 text-sm">
                  {conflicts.map((conflict, index) => (
                    <div key={index}>
                      • Dia {format(conflict.date, 'dd/MM', { locale: ptBR })}:{' '}
                      {formatDuration(conflict.usedMinutes)} ocupados (tópico
                      manual)
                      <br />
                      <span className="ml-4 text-muted-foreground">
                        └─ Capacidade reduzida para{' '}
                        {formatDuration(conflict.availableMinutes)} neste dia
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-muted-foreground">
                  💡 Items FSRS serão encaixados nos horários disponíveis
                  automaticamente.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {!hasOverload && !hasConflicts && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ A meta cabe perfeitamente no período selecionado!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## ⚙️ Lógica de Distribuição

### Arquivo: `src/lib/schedule-utils.ts`

```typescript
import { addDays, differenceInDays, isSameDay } from 'date-fns';

// ============================================
// TIPOS
// ============================================

export interface SubtopicWithDuration {
  id: string;
  title: string;
  topicId: string;
  estimated_duration_minutes: number;
}

export interface DaySlot {
  date: Date;
  totalCapacityMinutes: number;
  usedMinutes: number;
  availableMinutes: number;
  manualTopics: ManualTopic[];
  fsrsItems: ScheduleItemInput[];
}

export interface ManualTopic {
  id: string;
  title: string;
  estimatedTime: string; // Ex: "1h 30min"
}

export interface ScheduleItemInput {
  study_goal_id: string;
  topic_id: string;
  subtopic_id: string;
  title: string;
  scheduled_date: string; // YYYY-MM-DD
  estimated_duration: number; // minutos
  revision_type: string;
  notes?: string;
}

export interface Conflict {
  date: Date;
  totalRequired: number;
  available: number;
  overload: number;
  affectedItems: string[];
}

export type Intensity = 'light' | 'moderate' | 'intense';

// ============================================
// CONSTANTES
// ============================================

const INTENSITY_CAPACITY: Record<Intensity, number> = {
  light: 60, // 1h/dia
  moderate: 120, // 2h/dia
  intense: 240, // 4h/dia
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Parse tempo estimado do formato "1h 30min" para minutos
 */
export function parseEstimatedTime(timeStr: string): number {
  const hourMatch = timeStr.match(/(\d+)h/);
  const minMatch = timeStr.match(/(\d+)min/);

  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]) : 0;

  return hours * 60 + minutes;
}

/**
 * Formatar minutos para "1h 30min"
 */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * Formatar data como YYYY-MM-DD (timezone local)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================
// CALCULAR SLOTS DISPONÍVEIS
// ============================================

/**
 * Calcula slots disponíveis por dia, considerando tópicos manuais
 */
export function calculateAvailableSlots(params: {
  startDate: Date;
  endDate: Date;
  intensity: Intensity;
  existingManualTopics: ManualTopic[];
  existingManualTopicsSchedule: Array<{ topic: ManualTopic; currentDay: number }>;
  currentMonth: number;
  currentYear: number;
}): DaySlot[] {
  const {
    startDate,
    endDate,
    intensity,
    existingManualTopics,
    existingManualTopicsSchedule,
    currentMonth,
    currentYear,
  } = params;

  const dailyCapacity = INTENSITY_CAPACITY[intensity];
  const slots: DaySlot[] = [];

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfMonth = currentDate.getDate();

    // Buscar tópicos manuais agendados neste dia
    const manualTopicsThisDay = existingManualTopicsSchedule
      .filter((scheduled) => scheduled.currentDay === dayOfMonth)
      .map((scheduled) => scheduled.topic);

    // Calcular tempo usado por tópicos manuais
    const usedMinutes = manualTopicsThisDay.reduce((sum, topic) => {
      return sum + parseEstimatedTime(topic.estimatedTime);
    }, 0);

    slots.push({
      date: new Date(currentDate),
      totalCapacityMinutes: dailyCapacity,
      usedMinutes,
      availableMinutes: Math.max(0, dailyCapacity - usedMinutes),
      manualTopics: manualTopicsThisDay,
      fsrsItems: [],
    });

    currentDate = addDays(currentDate, 1);
  }

  return slots;
}

// ============================================
// DISTRIBUIÇÃO BASEADA EM TEMPO
// ============================================

/**
 * Distribui subtópicos nos slots disponíveis baseado em tempo estimado
 */
export function distributeByTime(params: {
  goalId: string;
  subtopics: SubtopicWithDuration[];
  slots: DaySlot[];
}): ScheduleItemInput[] {
  const { goalId, subtopics, slots } = params;

  const items: ScheduleItemInput[] = [];

  // Ordenar subtópicos por duração (maiores primeiro)
  const sortedSubtopics = [...subtopics].sort(
    (a, b) => b.estimated_duration_minutes - a.estimated_duration_minutes
  );

  let currentSlotIndex = 0;

  for (const subtopic of sortedSubtopics) {
    // Dividir tempo: 60% Parte 1, 40% Parte 2
    const totalMinutes = subtopic.estimated_duration_minutes;
    const part1Minutes = Math.ceil(totalMinutes * 0.6);
    const part2Minutes = Math.ceil(totalMinutes * 0.4);

    // === PARTE 1 ===
    const part1Slot = findNextAvailableSlot(slots, currentSlotIndex, part1Minutes);

    if (!part1Slot) {
      console.warn(
        `⚠️ Não foi possível encaixar Parte 1 de "${subtopic.title}" (${part1Minutes}min)`
      );
      continue;
    }

    items.push({
      study_goal_id: goalId,
      topic_id: subtopic.topicId,
      subtopic_id: subtopic.id,
      title: `${subtopic.title} - Estudo Inicial (Parte 1)`,
      scheduled_date: formatLocalDate(part1Slot.date),
      estimated_duration: part1Minutes,
      revision_type: 'initial_study_part1',
      notes: 'Leitura do material + criação/estudo de flashcards',
    });

    part1Slot.fsrsItems.push(items[items.length - 1]);
    part1Slot.usedMinutes += part1Minutes;
    part1Slot.availableMinutes -= part1Minutes;

    // === PARTE 2 ===
    // Tentar agendar no dia seguinte (ou próximo disponível)
    const part2SlotIndex = slots.findIndex(
      (s) =>
        s.date > part1Slot.date && s.availableMinutes >= part2Minutes
    );

    const part2Slot =
      part2SlotIndex !== -1
        ? slots[part2SlotIndex]
        : findNextAvailableSlot(slots, 0, part2Minutes);

    if (!part2Slot) {
      console.warn(
        `⚠️ Não foi possível encaixar Parte 2 de "${subtopic.title}" (${part2Minutes}min)`
      );
      continue;
    }

    items.push({
      study_goal_id: goalId,
      topic_id: subtopic.topicId,
      subtopic_id: subtopic.id,
      title: `${subtopic.title} - Estudo Inicial (Parte 2)`,
      scheduled_date: formatLocalDate(part2Slot.date),
      estimated_duration: part2Minutes,
      revision_type: 'initial_study_part2',
      notes: 'Resolução de questões sobre o conteúdo',
    });

    part2Slot.fsrsItems.push(items[items.length - 1]);
    part2Slot.usedMinutes += part2Minutes;
    part2Slot.availableMinutes -= part2Minutes;

    // Atualizar índice para próxima busca
    currentSlotIndex = slots.indexOf(part2Slot);
  }

  return items;
}

/**
 * Encontra próximo slot com espaço suficiente
 */
function findNextAvailableSlot(
  slots: DaySlot[],
  startIndex: number,
  requiredMinutes: number
): DaySlot | null {
  for (let i = startIndex; i < slots.length; i++) {
    if (slots[i].availableMinutes >= requiredMinutes) {
      return slots[i];
    }
  }
  return null;
}

// ============================================
// DETECÇÃO DE CONFLITOS
// ============================================

/**
 * Detecta conflitos (dias com sobrecarga)
 */
export function detectConflicts(slots: DaySlot[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const slot of slots) {
    const totalRequired = slot.usedMinutes;
    const overload = totalRequired - slot.totalCapacityMinutes;

    if (overload > 0) {
      conflicts.push({
        date: slot.date,
        totalRequired,
        available: slot.totalCapacityMinutes,
        overload,
        affectedItems: slot.fsrsItems.map((item) => item.title),
      });
    }
  }

  return conflicts;
}

/**
 * Verifica se a meta cabe no período
 */
export function canFitInPeriod(params: {
  subtopics: SubtopicWithDuration[];
  slots: DaySlot[];
}): { fits: boolean; requiredMinutes: number; availableMinutes: number } {
  const requiredMinutes = params.subtopics.reduce(
    (sum, sub) => sum + sub.estimated_duration_minutes,
    0
  );

  const availableMinutes = params.slots.reduce(
    (sum, slot) => sum + slot.availableMinutes,
    0
  );

  return {
    fits: requiredMinutes <= availableMinutes,
    requiredMinutes,
    availableMinutes,
  };
}
```

---

## 🚨 CRÍTICO: Sistema de Prioridade de Revisões

### O Problema das Revisões Dinâmicas

**Este é o problema mais crítico do sistema FSRS**: As revisões são calculadas **apenas após completar a Parte 2**, mas o cronograma já está todo agendado com conteúdo novo. Se o dia calculado pelo FSRS estiver lotado, a revisão não cabe e o usuário esquece o conteúdo, quebrando toda a efetividade do algoritmo.

#### Exemplo do Problema:

```
Dia 16: Subtópico A - Parte 2 (completado às 14h com rating "Good")
        FSRS calcula NESTE MOMENTO: Revisão 1 em 3 dias → Dia 19

Mas o cronograma já foi gerado na criação da meta:
Dia 19: LOTADO
        - Subtópico E - Parte 1 (1h30)
        - Subtópico F - Parte 1 (30min)
        Capacidade: 120min | Usado: 120min | Disponível: 0min ❌

A revisão NÃO CABE! E agora?
```

### Solução: Sistema Híbrido (Reserva Inteligente + Overbooking Controlado)

Combinação de duas estratégias complementares:

#### **Fase 1: Reserva Inteligente (Preview da Meta)**

Antes de criar a meta, simular onde as revisões vão cair e reservar espaço para elas.

##### Estrutura de DaySlot Atualizada:

```typescript
export interface DaySlot {
  date: Date;
  totalCapacityMinutes: number;
  hardCapacityMinutes: number;      // 120% da capacidade normal

  // Separação de uso por tipo
  usedByManual: number;              // Tópicos manuais (imutável)
  usedByNewContent: number;          // Parte 1/2 dos subtópicos (FSRS)
  usedByScheduledReviews: number;    // Revisões agendadas na criação
  usedByDynamicReviews: number;      // Revisões criadas ao completar

  // Espaços disponíveis
  reservedForReviews: number;        // Espaço reservado para revisões
  availableForNewContent: number;    // Espaço disponível para novo conteúdo
  availableForReviews: number;       // Espaço disponível para revisões (pode usar hard limit)

  // Flags
  isOverbooked: boolean;             // Ultrapassou 100% (mas dentro de 120%)

  manualTopics: ManualTopic[];
  fsrsItems: ScheduleItemInput[];
}
```

##### Algoritmo de Reserva Inteligente:

```typescript
/**
 * Calcula reserva EXATA baseada em simulação de revisões FSRS
 */
export function calculateSmartReservation(params: {
  subtopics: SubtopicWithDuration[];
  startDate: Date;
  endDate: Date;
  intensity: Intensity;
  existingManualTopics: ManualTopic[];
}): DaySlot[] {
  const dailyCapacity = INTENSITY_CAPACITY[intensity];
  const hardLimitMultiplier = HARD_LIMIT_MULTIPLIERS[intensity];

  // 1. Criar slots básicos
  const slots: DaySlot[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfMonth = currentDate.getDate();
    const manualMinutes = calculateManualMinutes(currentDate, existingManualTopics);

    slots.push({
      date: new Date(currentDate),
      totalCapacityMinutes: dailyCapacity,
      hardCapacityMinutes: Math.floor(dailyCapacity * hardLimitMultiplier),
      usedByManual: manualMinutes,
      usedByNewContent: 0,
      usedByScheduledReviews: 0,
      usedByDynamicReviews: 0,
      reservedForReviews: 0, // Será calculado a seguir
      availableForNewContent: dailyCapacity - manualMinutes,
      availableForReviews: Math.floor(dailyCapacity * hardLimitMultiplier) - manualMinutes,
      isOverbooked: false,
      manualTopics: [],
      fsrsItems: [],
    });

    currentDate = addDays(currentDate, 1);
  }

  // 2. Distribuir conteúdo novo SEM reserva (primeira passada)
  const tentativeSchedule = distributeByTime({
    goalId: 'preview',
    subtopics,
    slots: slots.map(s => ({ ...s })), // Clone
  });

  // 3. Simular revisões com intervalos FSRS médios
  const fsrsIntervals: Record<string, number> = {
    revision_1: 3,   // Primeira revisão: 3 dias depois (rating Good)
    revision_2: 7,   // Segunda revisão: 7 dias
    revision_3: 14,  // Terceira revisão: 14 dias
    revision_4: 30,  // Quarta revisão: 30 dias
  };

  const revisionHeatmap: Record<string, number> = {}; // { "2025-10-19": 45min }

  for (const item of tentativeSchedule.filter(i => i.revision_type === 'initial_study_part2')) {
    const completionDate = new Date(item.scheduled_date);

    for (const [revType, interval] of Object.entries(fsrsIntervals)) {
      const revisionDate = addDays(completionDate, interval);

      // Se revisão cai dentro do período da meta
      if (revisionDate >= startDate && revisionDate <= endDate) {
        const dateStr = formatLocalDate(revisionDate);
        const revisionDuration = 15; // Revisões são rápidas (15min)
        revisionHeatmap[dateStr] = (revisionHeatmap[dateStr] || 0) + revisionDuration;
      }
    }
  }

  // 4. Aplicar reservas EXATAS nos slots
  for (const slot of slots) {
    const dateStr = formatLocalDate(slot.date);
    const predictedReviews = revisionHeatmap[dateStr] || 0;

    slot.reservedForReviews = predictedReviews;
    slot.availableForNewContent = Math.max(
      0,
      slot.totalCapacityMinutes - slot.usedByManual - predictedReviews
    );
  }

  return slots;
}

const HARD_LIMIT_MULTIPLIERS: Record<Intensity, number> = {
  light: 1.2,     // 60min → 72min máximo
  moderate: 1.2,  // 120min → 144min máximo
  intense: 1.15,  // 240min → 276min máximo (menos margem)
};
```

##### Validação com Simulação:

```typescript
/**
 * Valida se a meta é viável considerando revisões futuras
 */
export function validateGoalFeasibility(params: {
  subtopics: SubtopicWithDuration[];
  slots: DaySlot[];
}): {
  feasible: boolean;
  reason?: string;
  suggestion?: string;
  simulatedReviews: Array<{ title: string; date: Date; duration: number }>;
} {
  const simulation: Array<{ title: string; date: Date; duration: number }> = [];

  // Distribuir conteúdo novo respeitando reservas
  const schedule = distributeByTime({
    goalId: 'validation',
    subtopics: params.subtopics,
    slots: params.slots,
  });

  // Simular revisões
  const fsrsIntervals = [3, 7, 14, 30];

  for (const item of schedule.filter(i => i.revision_type === 'initial_study_part2')) {
    const completionDate = new Date(item.scheduled_date);

    for (const interval of fsrsIntervals) {
      const revisionDate = addDays(completionDate, interval);
      const revisionDuration = 15;

      const slot = params.slots.find(s => isSameDay(s.date, revisionDate));

      if (!slot) continue; // Revisão cai fora do período

      // Verificar se cabe (considerando hard limit)
      const totalUsed = slot.usedByManual + slot.usedByNewContent + slot.usedByScheduledReviews;
      const willFit = (totalUsed + revisionDuration) <= slot.hardCapacityMinutes;

      if (!willFit) {
        return {
          feasible: false,
          reason: `Revisão de "${item.title}" agendada para ${format(revisionDate, 'dd/MM')} não cabe (dia lotado mesmo com margem de 120%)`,
          suggestion: 'Aumente o período da meta, reduza o número de subtópicos ou aumente a intensidade',
          simulatedReviews: simulation,
        };
      }

      // Marcar slot como usado pela revisão simulada
      slot.usedByScheduledReviews += revisionDuration;
      simulation.push({
        title: `${item.title} - Revisão ${fsrsIntervals.indexOf(interval) + 1}`,
        date: revisionDate,
        duration: revisionDuration,
      });
    }
  }

  return {
    feasible: true,
    simulatedReviews: simulation,
  };
}
```

#### **Fase 2: Overbooking Controlado (Revisões Dinâmicas)**

Quando usuário completa Parte 2 e a revisão é criada dinamicamente:

```typescript
/**
 * Agenda revisão dinâmica com sistema de prioridade e overbooking
 */
export async function scheduleRevisionWithPriority(params: {
  studyGoalId: string;
  scheduleItemId: string;
  subtopicId: string;
  topicId: string;
  subtopicTitle: string;
  cardState: FSRSCard;
  userRating: Rating;
}): Promise<'scheduled' | 'overbooked' | 'delayed' | 'blocked'> {

  // 1. FSRS calcula próxima revisão
  const fsrs = new FSRS();
  const nextReview = fsrs.repeat(params.cardState, params.userRating);
  const revisionDate = nextReview.card.due;
  const revisionNumber = params.cardState.reps + 1;
  const revisionDuration = 15; // Revisões são rápidas

  // 2. Buscar slot do dia
  const slot = await getSlotForDate(revisionDate);

  if (!slot) {
    console.error('Slot não encontrado para data:', revisionDate);
    return 'blocked';
  }

  const totalUsed = slot.usedByManual + slot.usedByNewContent + slot.usedByDynamicReviews;

  // 3. CENÁRIO A: Cabe na capacidade normal ✅
  if ((totalUsed + revisionDuration) <= slot.totalCapacityMinutes) {
    await createScheduleItem({
      study_goal_id: params.studyGoalId,
      topic_id: params.topicId,
      subtopic_id: params.subtopicId,
      title: `${params.subtopicTitle} - Revisão ${revisionNumber}`,
      scheduled_date: formatLocalDate(revisionDate),
      estimated_duration: revisionDuration,
      revision_type: `revision_${revisionNumber}`,
      parent_item_id: params.scheduleItemId,
      fsrs_card_state: JSON.stringify(nextReview.card),
    });

    return 'scheduled';
  }

  // 4. CENÁRIO B: Não cabe na capacidade normal, mas cabe no hard limit ⚠️
  if ((totalUsed + revisionDuration) <= slot.hardCapacityMinutes) {
    await createScheduleItem({
      study_goal_id: params.studyGoalId,
      topic_id: params.topicId,
      subtopic_id: params.subtopicId,
      title: `${params.subtopicTitle} - Revisão ${revisionNumber}`,
      scheduled_date: formatLocalDate(revisionDate),
      estimated_duration: revisionDuration,
      revision_type: `revision_${revisionNumber}`,
      parent_item_id: params.scheduleItemId,
      fsrs_card_state: JSON.stringify(nextReview.card),
      is_overbooked: true, // FLAG: Dia com sobrecarga
    });

    // Notificar usuário
    showToast({
      title: '⚠️ Dia com sobrecarga',
      description: `Revisão agendada para ${format(revisionDate, 'dd/MM')}, mas o dia está com ${Math.round(((totalUsed + revisionDuration) / slot.totalCapacityMinutes) * 100)}% de capacidade.`,
      variant: 'warning',
      duration: 5000,
    });

    return 'overbooked';
  }

  // 5. CENÁRIO C: Não cabe nem no hard limit, tentar D+1 📅
  const nextDayDate = addDays(revisionDate, 1);
  const nextDaySlot = await getSlotForDate(nextDayDate);

  if (nextDaySlot) {
    const nextDayUsed = nextDaySlot.usedByManual + nextDaySlot.usedByNewContent + nextDaySlot.usedByDynamicReviews;

    if ((nextDayUsed + revisionDuration) <= nextDaySlot.hardCapacityMinutes) {
      // Ajustar card FSRS (penalizar por atraso de 1 dia)
      const adjustedCard = { ...nextReview.card };
      adjustedCard.difficulty = Math.min(10, adjustedCard.difficulty + 0.2); // Aumentar dificuldade

      await createScheduleItem({
        study_goal_id: params.studyGoalId,
        topic_id: params.topicId,
        subtopic_id: params.subtopicId,
        title: `${params.subtopicTitle} - Revisão ${revisionNumber}`,
        scheduled_date: formatLocalDate(nextDayDate),
        estimated_duration: revisionDuration,
        revision_type: `revision_${revisionNumber}`,
        parent_item_id: params.scheduleItemId,
        fsrs_card_state: JSON.stringify(adjustedCard),
        is_delayed: true,
        delay_days: 1,
        original_scheduled_date: formatLocalDate(revisionDate),
      });

      showToast({
        title: '📅 Revisão reagendada',
        description: `Dia ${format(revisionDate, 'dd/MM')} estava lotado. Revisão movida para ${format(nextDayDate, 'dd/MM')} (1 dia de atraso).`,
        variant: 'warning',
        duration: 7000,
      });

      return 'delayed';
    }
  }

  // 6. CENÁRIO D: PROBLEMA CRÍTICO - Nem D+1 cabe 🚨
  showAlert({
    title: '🚨 Cronograma Sobrecarregado',
    description: `Não há espaço para agendar a revisão de "${params.subtopicTitle}" nos próximos dias. Sua meta precisa ser ajustada!`,
    variant: 'destructive',
    actions: [
      {
        label: 'Estender Meta em 7 dias',
        onClick: () => extendStudyGoal(params.studyGoalId, 7),
      },
      {
        label: 'Ver Cronograma',
        onClick: () => navigateToCronograma(),
      },
      {
        label: 'Aceitar Atraso (não recomendado)',
        onClick: () => forceScheduleDelayed(params, 2), // Forçar D+2
      },
    ],
  });

  return 'blocked';
}
```

### Campos Adicionais no Banco de Dados

```sql
-- Adicionar campos para controle de revisões
ALTER TABLE schedule_items ADD COLUMN is_overbooked BOOLEAN DEFAULT FALSE;
ALTER TABLE schedule_items ADD COLUMN is_delayed BOOLEAN DEFAULT FALSE;
ALTER TABLE schedule_items ADD COLUMN delay_days INTEGER DEFAULT 0;
ALTER TABLE schedule_items ADD COLUMN original_scheduled_date DATE;
ALTER TABLE schedule_items ADD COLUMN parent_item_id UUID REFERENCES schedule_items(id);
ALTER TABLE schedule_items ADD COLUMN fsrs_card_state JSONB;

COMMENT ON COLUMN schedule_items.is_overbooked IS 'Revisão agendada em dia com sobrecarga (>100% mas <=120%)';
COMMENT ON COLUMN schedule_items.is_delayed IS 'Revisão atrasada devido falta de espaço';
COMMENT ON COLUMN schedule_items.delay_days IS 'Quantos dias a revisão foi atrasada';
COMMENT ON COLUMN schedule_items.parent_item_id IS 'ID do schedule_item que gerou esta revisão';
COMMENT ON COLUMN schedule_items.fsrs_card_state IS 'Estado do card FSRS para próxima revisão';
```

### Visualização no Preview (GoalPreviewSummary)

```tsx
// Componente adicional para mostrar heatmap de revisões

interface RevisionHeatmapProps {
  simulatedReviews: Array<{ title: string; date: Date; duration: number }>;
  slots: DaySlot[];
}

function RevisionHeatmap({ simulatedReviews, slots }: RevisionHeatmapProps) {
  // Agrupar revisões por data
  const revisionsByDate = simulatedReviews.reduce((acc, rev) => {
    const dateStr = format(rev.date, 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(rev);
    return acc;
  }, {} as Record<string, typeof simulatedReviews>);

  // Encontrar picos
  const peakDays = Object.entries(revisionsByDate)
    .map(([dateStr, revs]) => ({
      date: new Date(dateStr),
      count: revs.length,
      totalMinutes: revs.reduce((sum, r) => sum + r.duration, 0),
    }))
    .filter(day => day.count >= 3) // Pico = 3+ revisões
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          🔄 Previsão de Revisões (Inteligente)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Total de revisões previstas: {simulatedReviews.length}
        </p>

        {peakDays.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">⚠️ Dias com pico de revisões:</p>
            {peakDays.map((day) => {
              const slot = slots.find(s => isSameDay(s.date, day.date));
              const capacityPercentage = slot
                ? Math.round((day.totalMinutes / slot.totalCapacityMinutes) * 100)
                : 0;

              return (
                <div key={day.date.toString()} className="pl-4 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{format(day.date, "dd/MM (EEE)", { locale: ptBR })}</span>
                    <span className="font-medium">{day.count} revisões ({day.totalMinutes}min)</span>
                  </div>
                  <Progress
                    value={Math.min(100, capacityPercentage)}
                    className={capacityPercentage > 80 ? 'bg-orange-200' : ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    Espaço restante para novo conteúdo: {slot ? slot.availableForNewContent : 0}min
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {peakDays.length === 0 && (
          <p className="text-sm text-green-600">
            ✅ Revisões bem distribuídas - sem picos detectados
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Visualização no Cronograma

```tsx
// Indicador visual de dias overbooked

{slot.isOverbooked && (
  <Alert variant="warning" className="mt-2">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription className="text-sm">
      ⚠️ Dia com sobrecarga ({Math.round((usedMinutes / dailyCapacity) * 100)}%)
      <br />
      Revisões priorizadas - pode levar mais tempo que o planejado.
    </AlertDescription>
  </Alert>
)}

// Badge em items atrasados
{item.is_delayed && (
  <Badge variant="warning" className="ml-2">
    Atrasado {item.delay_days}d
  </Badge>
)}
```

### Resumo da Solução

| Fase | Mecanismo | O que faz | Quando |
|------|-----------|-----------|--------|
| **Criação da Meta** | Reserva Inteligente | Simula revisões futuras e reserva espaço EXATO | Preview da meta |
| **Preview** | Validação Rigorosa | Impede criar meta se revisões não couberem | Antes de confirmar |
| **Revisão Dinâmica** | Overbooking Controlado | Permite ultrapassar 20% capacidade | Ao completar Parte 2 |
| **Fallback 1** | Atraso D+1 | Adia 1 dia com ajuste FSRS | Se não couber no dia ideal |
| **Fallback 2** | Alerta + Ações | Oferece estender meta ou redistribuir | Último recurso |

**Esta solução garante que revisões SEMPRE terão espaço, mantendo a efetividade do FSRS!** 🎯

---

## 🛡️ Validação Universal para Agendamentos Manuais

### O Problema dos Agendamentos Manuais

O sistema de **Reserva Inteligente** e **Overbooking Controlado** funciona perfeitamente para:
- ✅ Metas com FSRS habilitado
- ✅ Revisões dinâmicas criadas pelo algoritmo FSRS

**Mas NÃO cobre:**
- ❌ Revisões manuais (usuário agenda manualmente sem FSRS)
- ❌ Tópicos manuais adicionados em dias já lotados
- ❌ Qualquer agendamento manual do usuário

#### Exemplo do Problema:

```
Usuário:
1. Cria meta FSRS que ocupa dia 20/10 com 120min de conteúdo
2. Quer adicionar revisão manual no dia 20/10 (30min)
3. Sistema atual: Deixa agendar sem validação
4. Resultado: Dia 20/10 fica com 150min (sobrecarga de 125%)
5. Usuário não foi avisado! ❌
```

### Solução: Validação Universal ao Agendar

Sempre que usuário tentar agendar **qualquer item manualmente** (tópico, revisão, tarefa), o sistema deve validar a capacidade do dia.

#### Função de Validação Universal:

```typescript
/**
 * Valida se um item manual pode ser agendado em uma data específica
 */
export async function validateManualScheduling(params: {
  date: Date;
  estimatedDuration: number; // em minutos
  intensity: Intensity;
}): Promise<{
  canSchedule: boolean;
  status: 'ok' | 'warning' | 'blocked';
  currentUsage: number;
  availableMinutes: number;
  capacityPercentage: number;
  message: string;
  suggestions?: string[];
}> {
  const { date, estimatedDuration, intensity } = params;

  // 1. Buscar capacidade do dia
  const dailyCapacity = INTENSITY_CAPACITY[intensity];
  const hardLimit = Math.floor(dailyCapacity * HARD_LIMIT_MULTIPLIERS[intensity]);

  // 2. Buscar todos os items já agendados neste dia
  const { data: scheduleItems, error: scheduleError } = await supabase
    .from('schedule_items')
    .select('estimated_duration')
    .eq('scheduled_date', formatLocalDate(date));

  if (scheduleError) {
    console.error('Erro ao buscar schedule_items:', scheduleError);
    throw scheduleError;
  }

  // 3. Buscar tópicos manuais agendados neste dia
  const manualTopics = await getManualTopicsForDate(date);

  // 4. Calcular uso atual
  const scheduleMinutes = scheduleItems.reduce(
    (sum, item) => sum + (item.estimated_duration || 0),
    0
  );

  const manualMinutes = manualTopics.reduce(
    (sum, topic) => sum + parseEstimatedTime(topic.estimatedTime),
    0
  );

  const currentUsage = scheduleMinutes + manualMinutes;
  const afterScheduling = currentUsage + estimatedDuration;
  const capacityPercentage = Math.round((afterScheduling / dailyCapacity) * 100);
  const availableMinutes = dailyCapacity - currentUsage;

  // 5. Determinar status
  if (afterScheduling <= dailyCapacity) {
    // CENÁRIO A: Cabe perfeitamente ✅
    return {
      canSchedule: true,
      status: 'ok',
      currentUsage,
      availableMinutes,
      capacityPercentage,
      message: `✅ Item pode ser agendado. Dia ficará com ${capacityPercentage}% de capacidade.`,
    };
  }

  if (afterScheduling <= hardLimit) {
    // CENÁRIO B: Ultrapass a capacidade normal, mas cabe no hard limit ⚠️
    return {
      canSchedule: true,
      status: 'warning',
      currentUsage,
      availableMinutes: hardLimit - currentUsage,
      capacityPercentage,
      message: `⚠️ Dia ficará sobrecarregado (${capacityPercentage}%). Você terá mais conteúdo que o planejado para este dia.`,
      suggestions: [
        `Reduzir duração estimada de ${estimatedDuration}min para ${Math.max(15, availableMinutes)}min`,
        'Escolher outro dia com mais espaço disponível',
        'Aumentar intensidade da meta',
      ],
    };
  }

  // CENÁRIO C: Ultrapassou hard limit - BLOQUEAR ❌
  const alternativeDates = await findAlternativeDates(date, estimatedDuration, intensity, 7);

  return {
    canSchedule: false,
    status: 'blocked',
    currentUsage,
    availableMinutes: 0,
    capacityPercentage,
    message: `❌ Dia está lotado (${capacityPercentage}%). Não é possível agendar mais conteúdo.`,
    suggestions: [
      ...alternativeDates.map(d => `Agendar para ${format(d, 'dd/MM (EEE)', { locale: ptBR })}`),
      'Reduzir duração estimada',
      'Remover outros items deste dia',
    ],
  };
}

/**
 * Encontra datas alternativas com espaço suficiente
 */
async function findAlternativeDates(
  startDate: Date,
  requiredMinutes: number,
  intensity: Intensity,
  lookAheadDays: number
): Promise<Date[]> {
  const alternatives: Date[] = [];
  const dailyCapacity = INTENSITY_CAPACITY[intensity];

  for (let i = 1; i <= lookAheadDays; i++) {
    const candidateDate = addDays(startDate, i);

    const validation = await validateManualScheduling({
      date: candidateDate,
      estimatedDuration: requiredMinutes,
      intensity,
    });

    if (validation.status === 'ok') {
      alternatives.push(candidateDate);
    }

    if (alternatives.length >= 3) break; // Máximo 3 sugestões
  }

  return alternatives;
}
```

#### Interface de Agendamento Manual com Validação:

```tsx
// Componente: ManualScheduleDialog.tsx

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateManualScheduling } from '@/lib/schedule-utils';

interface ManualScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  intensity: Intensity;
}

export function ManualScheduleDialog({
  open,
  onOpenChange,
  defaultDate,
  intensity,
}: ManualScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());
  const [title, setTitle] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(60); // minutos
  const [validation, setValidation] = useState<Awaited<
    ReturnType<typeof validateManualScheduling>
  > | null>(null);

  // Validar sempre que mudar data ou duração
  useEffect(() => {
    const validate = async () => {
      const result = await validateManualScheduling({
        date: selectedDate,
        estimatedDuration,
        intensity,
      });
      setValidation(result);
    };

    if (estimatedDuration > 0) {
      validate();
    }
  }, [selectedDate, estimatedDuration, intensity]);

  const handleSchedule = async () => {
    if (!validation?.canSchedule) {
      return;
    }

    // Agendar item
    await scheduleManualItem({
      title,
      scheduled_date: selectedDate,
      estimated_duration: estimatedDuration,
      is_overbooked: validation.status === 'warning',
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agendar Item Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Revisão de Direito Civil"
            />
          </div>

          {/* Duração estimada */}
          <div>
            <label className="text-sm font-medium">Duração estimada (minutos)</label>
            <Input
              type="number"
              min="5"
              max="300"
              step="5"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Calendário */}
          <div>
            <label className="text-sm font-medium">Data</label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={ptBR}
              className="rounded-md border"
            />
          </div>

          {/* Validação */}
          {validation && (
            <Alert
              variant={
                validation.status === 'ok'
                  ? 'default'
                  : validation.status === 'warning'
                  ? 'default'
                  : 'destructive'
              }
              className={
                validation.status === 'ok'
                  ? 'border-green-200 bg-green-50'
                  : validation.status === 'warning'
                  ? 'border-orange-200 bg-orange-50'
                  : ''
              }
            >
              {validation.status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {validation.status === 'warning' && <AlertTriangle className="h-4 w-4 text-orange-600" />}
              {validation.status === 'blocked' && <XCircle className="h-4 w-4" />}

              <AlertDescription>
                <p className="font-medium mb-2">{validation.message}</p>

                <div className="text-sm space-y-1 mt-2">
                  <p>
                    <strong>Data:</strong> {format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                  </p>
                  <p>
                    <strong>Uso atual:</strong> {validation.currentUsage}min
                  </p>
                  <p>
                    <strong>Após agendar:</strong> {validation.currentUsage + estimatedDuration}min (
                    {validation.capacityPercentage}%)
                  </p>
                </div>

                {validation.suggestions && validation.suggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">💡 Sugestões:</p>
                    <ul className="list-disc ml-5 text-sm space-y-1">
                      {validation.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!validation?.canSchedule || !title}
          >
            {validation?.status === 'warning' ? 'Agendar (Sobrecarga)' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Integração no Cronograma:

Ao clicar em um dia no cronograma para adicionar item manual:

```tsx
// src/pages/CronogramaPage.tsx

const handleAddManualItem = (day: number) => {
  const selectedDate = new Date(currentYear, currentMonth, day);
  setManualScheduleDate(selectedDate);
  setManualScheduleDialogOpen(true);
};

// No render
<ManualScheduleDialog
  open={manualScheduleDialogOpen}
  onOpenChange={setManualScheduleDialogOpen}
  defaultDate={manualScheduleDate}
  intensity={currentIntensity} // Da meta ativa ou configuração global
/>
```

### Campos Adicionais para Items Manuais:

```sql
-- Se ainda não existe, adicionar flag is_manual
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN schedule_items.is_manual IS 'Item agendado manualmente pelo usuário (não gerado por meta FSRS)';
```

### Visualização no Cronograma:

Diferenciar visualmente items manuais de items FSRS:

```tsx
// Badge para identificar tipo
{item.is_manual ? (
  <Badge variant="outline" className="ml-2">
    Manual
  </Badge>
) : (
  <Badge variant="secondary" className="ml-2">
    FSRS
  </Badge>
)}

// Ícone específico
{item.is_manual ? (
  <User className="w-4 h-4" />
) : (
  <Brain className="w-4 h-4" />
)}
```

### Resumo da Validação Universal

| Cenário | Status | Comportamento |
|---------|--------|---------------|
| **Uso < 100%** | `ok` ✅ | Permite agendar sem avisos |
| **100% < Uso ≤ 120%** | `warning` ⚠️ | Permite agendar com aviso de sobrecarga |
| **Uso > 120%** | `blocked` ❌ | Bloqueia agendamento, sugere alternativas |

### Benefícios:

1. ✅ **Consistência**: Mesmo sistema de validação para FSRS e manual
2. ✅ **Prevenção**: Impede sobrecarga acidental por agendamentos manuais
3. ✅ **Transparência**: Usuário sabe exatamente o estado do dia
4. ✅ **Flexibilidade**: Permite sobrecarga controlada (até 120%)
5. ✅ **Sugestões**: Oferece datas alternativas automaticamente
6. ✅ **UX**: Validação em tempo real enquanto usuário escolhe data/duração

**Esta solução garante que QUALQUER agendamento (FSRS ou manual) respeita a capacidade do dia!** 🎯

---

## 🔄 Fluxo Completo

### 1. Usuário Abre GoalCreationDialog

```tsx
// src/components/goals/GoalCreationDialog.tsx

// Estado para subtópicos selecionados
const [selectedSubtopicIds, setSelectedSubtopicIds] = useState<string[]>([]);

// Buscar todos os tópicos com subtópicos
const { topics } = useTopics();
const topicsWithSubtopics = topics.filter(t => t.subtopics && t.subtopics.length > 0);
```

### 2. Usuário Seleciona Subtópicos

```tsx
<SubtopicSelector
  topics={topicsWithSubtopics}
  selectedSubtopics={selectedSubtopicIds}
  onChange={setSelectedSubtopicIds}
/>
```

### 3. Preview em Tempo Real

```tsx
// Calcular preview sempre que mudar seleção, datas ou intensidade
const preview = useMemo(() => {
  if (!selectedSubtopicIds.length || !dateRange.from || !dateRange.to) {
    return null;
  }

  // Buscar subtópicos completos
  const selectedSubs = topicsWithSubtopics
    .flatMap(t => t.subtopics)
    .filter(sub => selectedSubtopicIds.includes(sub.id));

  // Calcular slots disponíveis
  const slots = calculateAvailableSlots({
    startDate: dateRange.from,
    endDate: dateRange.to,
    intensity: formData.intensity,
    existingManualTopics: manualTopics,
    existingManualTopicsSchedule: scheduledTopics,
    currentMonth,
    currentYear,
  });

  // Detectar conflitos
  const conflicts = detectConflicts(slots);

  // Verificar se cabe
  const { fits, requiredMinutes, availableMinutes } = canFitInPeriod({
    subtopics: selectedSubs,
    slots,
  });

  return {
    selectedSubtopics: selectedSubs,
    slots,
    conflicts,
    fits,
    requiredMinutes,
    availableMinutes,
  };
}, [selectedSubtopicIds, dateRange, formData.intensity]);

// Exibir preview
{preview && (
  <GoalPreviewSummary
    selectedSubtopics={preview.selectedSubtopics}
    startDate={dateRange.from}
    endDate={dateRange.to}
    intensity={formData.intensity}
    conflicts={preview.conflicts}
  />
)}
```

### 4. Usuário Confirma e Cria Meta

```tsx
const handleSubmit = async (data) => {
  // Validar que cabe
  if (!preview.fits) {
    toast.error('A meta não cabe no período selecionado!');
    return;
  }

  // Preparar dados
  const goalData = {
    title: data.title,
    start_date: formatLocalDate(dateRange.from),
    target_date: formatLocalDate(dateRange.to),
    intensity: data.intensity,
    enable_fsrs: true,
    topics: selectedSubtopicIds.map(id => {
      const sub = preview.selectedSubtopics.find(s => s.id === id);
      return {
        topicId: sub.topicId,
        subtopicId: sub.id,
        title: sub.title,
      };
    }),
  };

  // Criar meta
  await createGoal(goalData);
};
```

### 5. useStudyGoals Processa

```tsx
// src/hooks/useStudyGoals.ts

const createGoal = async (goalData) => {
  // ... inserir no banco

  if (goalData.enable_fsrs) {
    // Buscar subtópicos completos com duração
    const subtopics = await fetchSubtopicsWithDuration(goalData.topics);

    // Gerar schedule
    await generateSchedule({
      goalId: goal.id,
      startDate: parseLocalDate(goalData.start_date),
      targetDate: parseLocalDate(goalData.target_date),
      subtopics,
      intensity: goalData.intensity,
    });
  }
};
```

### 6. useFSRSScheduler Distribui

```tsx
// src/hooks/useFSRSScheduler.ts

export async function generateSchedule(params: {
  goalId: string;
  startDate: Date;
  targetDate: Date;
  subtopics: SubtopicWithDuration[];
  intensity: Intensity;
}) {
  // 1. Calcular slots disponíveis
  const slots = calculateAvailableSlots({
    startDate: params.startDate,
    endDate: params.targetDate,
    intensity: params.intensity,
    existingManualTopics: [], // Buscar do banco
    existingManualTopicsSchedule: [],
    currentMonth: params.startDate.getMonth(),
    currentYear: params.startDate.getFullYear(),
  });

  // 2. Distribuir subtópicos
  const items = distributeByTime({
    goalId: params.goalId,
    subtopics: params.subtopics,
    slots,
  });

  // 3. Inserir no banco
  const { error } = await supabase
    .from('schedule_items')
    .insert(items);

  if (error) {
    console.error('Erro ao inserir schedule_items:', error);
    throw error;
  }

  return items;
}
```

### 7. CronogramaPage Exibe

```tsx
// src/pages/CronogramaPage.tsx

const convertScheduleItemsToTopics = (day: number): TopicData[] => {
  // Parse local de datas (SEM conversão UTC)
  const [year, month, dayNum] = item.scheduled_date.split('-').map(Number);
  const itemDate = new Date(year, month - 1, dayNum);

  // Comparar com data selecionada
  const matches = isSameDay(itemDate, selectedDate);

  // Retornar como TopicData
  return {
    id: `fsrs-${item.id}`,
    title: item.title,
    estimatedTime: `${item.estimated_duration} min`,
    // ...
  };
};

// Combinar tópicos manuais + FSRS
const currentTopics = [
  ...manualTopics,
  ...convertScheduleItemsToTopics(selectedDay),
];

// Calcular capacidade do dia
const dailyCapacity = INTENSITY_CAPACITY[intensity];
const usedMinutes = currentTopics.reduce(
  (sum, topic) => sum + parseEstimatedTime(topic.estimatedTime),
  0
);
const capacityPercentage = Math.round((usedMinutes / dailyCapacity) * 100);

// Exibir barra de capacidade
<div className="mt-2 space-y-1">
  <div className="flex items-center justify-between text-sm">
    <span>Capacidade do dia:</span>
    <span className={capacityPercentage > 100 ? 'text-destructive' : ''}>
      {usedMinutes}/{dailyCapacity} min ({capacityPercentage}%)
    </span>
  </div>
  <Progress value={Math.min(100, capacityPercentage)} />
</div>
```

---

## 📝 Plano de Implementação

### Sprint 1: Foundation (2-3 dias)

**Objetivo**: Preparar base de dados e componentes básicos

- [ ] **Task 1.1**: Criar migração SQL (`20250117_add_estimated_duration.sql`)
  - Adicionar campo `estimated_duration_minutes` em `topics` e `subtopics`
  - Adicionar índices
  - Atualizar registros existentes com valores padrão

- [ ] **Task 1.2**: Atualizar tipos TypeScript
  - Modificar `src/types/database.ts`
  - Adicionar campo `estimated_duration_minutes` aos tipos

- [ ] **Task 1.3**: Criar `TimeEstimateInput` component
  - Inputs de horas + minutos
  - Presets rápidos
  - Tooltip explicativo
  - Validação

- [ ] **Task 1.4**: Localizar e atualizar `TopicForm`
  - Adicionar campo `TimeEstimateInput`
  - Atualizar Zod schema
  - Valor padrão: 120min

- [ ] **Task 1.5**: Localizar e atualizar `SubtopicForm`
  - Adicionar campo `TimeEstimateInput`
  - Atualizar Zod schema
  - Valor padrão: 90min

- [ ] **Task 1.6**: Testar criação de tópicos/subtópicos com tempo estimado

---

### Sprint 2: Seleção Granular (2-3 dias)

**Objetivo**: Interface de seleção hierárquica de subtópicos

- [ ] **Task 2.1**: Criar `SubtopicSelector` component
  - Tree view com chevrons
  - Checkbox no tópico (seleciona todos)
  - Checkboxes individuais nos subtópicos
  - Estado "indeterminate" (alguns selecionados)
  - Contador dinâmico
  - Exibir tempo de cada item

- [ ] **Task 2.2**: Integrar no `GoalCreationDialog`
  - Substituir seleção de tópicos por `SubtopicSelector`
  - Estado `selectedSubtopicIds`
  - Validação: mínimo 1 subtópico

- [ ] **Task 2.3**: Testar seleção
  - Selecionar todos os subtópicos de um tópico
  - Selecionar alguns subtópicos
  - Deselecionar

---

### Sprint 3: Algoritmo de Distribuição (3-4 dias)

**Objetivo**: Lógica core de distribuição inteligente

- [ ] **Task 3.1**: Criar arquivo `src/lib/schedule-utils.ts`
  - Estrutura básica
  - Tipos TypeScript
  - Constantes

- [ ] **Task 3.2**: Implementar `calculateAvailableSlots`
  - Calcular capacidade diária
  - Buscar tópicos manuais existentes
  - Calcular minutos disponíveis por dia
  - Retornar array de `DaySlot`

- [ ] **Task 3.3**: Implementar `distributeByTime`
  - Ordenar subtópicos por duração
  - Dividir tempo em Parte 1 (60%) e Parte 2 (40%)
  - Encontrar slots disponíveis
  - Marcar slots como usados
  - Retornar `ScheduleItemInput[]`

- [ ] **Task 3.4**: Implementar `detectConflicts`
  - Identificar dias com sobrecarga
  - Retornar array de conflitos

- [ ] **Task 3.5**: Implementar `canFitInPeriod`
  - Verificar se tempo total cabe no período

- [ ] **Task 3.6**: Testes unitários
  - Testar cenários: mais dias que subtópicos, mais subtópicos que dias, com tópicos manuais

---

### Sprint 4: Preview & Validação (2-3 dias)

**Objetivo**: Preview visual e validações antes de criar meta

- [ ] **Task 4.1**: Criar `GoalPreviewSummary` component
  - Card com resumo
  - Lista de subtópicos selecionados
  - Tempo total
  - Capacidade vs necessário
  - Barra de progresso
  - Alertas de conflitos
  - Sugestões de ajuste

- [ ] **Task 4.2**: Integrar preview no `GoalCreationDialog`
  - `useMemo` para calcular preview em tempo real
  - Exibir preview abaixo do seletor
  - Atualizar ao mudar seleção/datas/intensidade

- [ ] **Task 4.3**: Validações
  - Impedir criar meta se não couber
  - Avisar sobre conflitos
  - Toast com mensagem clara

- [ ] **Task 4.4**: Refatorar `useFSRSScheduler`
  - Usar `distributeByTime` em vez de lógica antiga
  - Integrar com `schedule-utils.ts`

- [ ] **Task 4.5**: Atualizar `useStudyGoals`
  - Buscar subtópicos completos com duração
  - Passar para `generateSchedule`

---

### Sprint 5: Visualização & Polish (2-3 dias)

**Objetivo**: Visualização no cronograma e ajustes finais

- [ ] **Task 5.1**: Atualizar `CronogramaPage`
  - Calcular capacidade diária
  - Exibir barra "X/Y min (Z%)"
  - Indicador visual de sobrecarga (vermelho se > 100%)
  - Separação visual entre manuais e FSRS

- [ ] **Task 5.2**: Alertas no cronograma
  - ⚠️ Sobrecarga detectada
  - 💡 Espaço livre disponível
  - 🎯 Progresso da meta

- [ ] **Task 5.3**: Testes E2E
  - Criar tópico com tempo estimado
  - Criar meta selecionando subtópicos específicos
  - Verificar distribuição no cronograma
  - Testar cenários complexos

- [ ] **Task 5.4**: Ajustes de UX
  - Loading states
  - Empty states
  - Tooltips
  - Animações

- [ ] **Task 5.5**: Documentação
  - Comentários no código
  - README atualizado
  - Changelog

---

## 🧪 Cenários de Teste

### Cenário 1: Equilibrado
- **Setup**: 5 subtópicos (90min cada), 10 dias, intensidade moderate (2h/dia)
- **Esperado**: Distribuição uniforme, ~1 subtópico a cada 2 dias, sem sobrecarga

### Cenário 2: Mais subtópicos que dias
- **Setup**: 10 subtópicos (90min cada), 7 dias, intensidade moderate (2h/dia)
- **Esperado**: Agrupamento inteligente, múltiplos subtópicos por dia, capacidade 100%

### Cenário 3: Mais dias que subtópicos
- **Setup**: 3 subtópicos (90min cada), 10 dias, intensidade light (1h/dia)
- **Esperado**: Espaçamento confortável, dias livres intercalados, capacidade 45%

### Cenário 4: Com tópicos manuais
- **Setup**: 5 subtópicos FSRS + 3 tópicos manuais (1h cada) já agendados
- **Esperado**: Items FSRS encaixados nos horários livres, sem conflitos

### Cenário 5: Sobrecarga
- **Setup**: 15 subtópicos pesados (150min cada), 5 dias, intensidade light (1h/dia)
- **Esperado**: Preview mostra erro, impede criação, sugere ajustes

### Cenário 6: Pesos variados
- **Setup**: 2 subtópicos curtos (30min) + 2 longos (180min), 7 dias, moderate
- **Esperado**: Subtópicos curtos agrupados, longos em dias separados

---

## 📊 Métricas de Sucesso

- ✅ **Flexibilidade**: Usuário pode selecionar subtópicos individuais
- ✅ **Intuitividade**: Interface de tempo estimado clara e fácil
- ✅ **Inteligência**: Algoritmo adapta a qualquer cenário
- ✅ **Transparência**: Preview mostra exatamente o que vai acontecer
- ✅ **Robustez**: Funciona com tópicos manuais + FSRS híbridos
- ✅ **Performance**: Preview em tempo real sem lag

---

## 🚀 Próximos Passos (Futuro)

### Auto-calibração (Pós-MVP)
- Após usuário completar subtópico, comparar tempo estimado vs real
- Ajustar estimativas automaticamente
- Aprender padrões do usuário

### Sugestões Inteligentes
- "Você geralmente leva 2x mais tempo que estimado em Direito Penal"
- "Recomendamos aumentar estimativa de subtópicos similares"

### Templates de Tempo
- "Subtópicos de Direito Constitucional geralmente levam 90min"
- "Questões de OAB: 45min por subtópico"

---

## 📁 Estrutura de Arquivos

```
src/
├── components/
│   └── goals/
│       ├── TimeEstimateInput.tsx          [NOVO]
│       ├── SubtopicSelector.tsx           [NOVO]
│       ├── GoalPreviewSummary.tsx         [NOVO]
│       └── GoalCreationDialog.tsx         [MODIFICAR]
├── hooks/
│   ├── useFSRSScheduler.ts                [REFATORAR]
│   └── useStudyGoals.ts                   [MODIFICAR]
├── lib/
│   └── schedule-utils.ts                  [NOVO - CORE]
├── pages/
│   └── CronogramaPage.tsx                 [MODIFICAR]
└── types/
    └── database.ts                        [MODIFICAR]

supabase/
└── migrations/
    └── 20250117_add_estimated_duration.sql [NOVO]

docs/
└── FSRS_TIME_BASED_DISTRIBUTION.md        [ESTE ARQUIVO]
```

---

## ✅ Checklist Final

Antes de considerar completo:

- [ ] Todas as migrações aplicadas
- [ ] Tipos TypeScript atualizados
- [ ] Todos os componentes criados e testados
- [ ] Algoritmo de distribuição funcionando
- [ ] Preview visual completo
- [ ] Validações implementadas
- [ ] Cronograma exibindo corretamente
- [ ] Testes E2E passando
- [ ] Documentação atualizada
- [ ] Code review feito
- [ ] Deploy em produção

---

**Última atualização**: 2025-10-16
**Autor**: Sistema de IA + Desenvolvedor
**Status**: 📋 Planejamento Completo - Pronto para Implementação

# 🎯 Sistema de Configuração de Perfil de Estudo

## Status: ✅ Implementado

Sistema completo de configuração personalizada com:
- ✅ Tabela `user_study_config` (migration criada)
- ✅ Hook `useStudyConfig` (CRUD + helpers)
- ✅ Componente `StudyConfigDialog` (4 abas com progress stepper)

---

## 📦 Arquivos Criados

### 1. Migration
- `supabase/migrations/20250120_create_user_study_config.sql`

### 2. Hook
- `src/hooks/useStudyConfig.ts`

### 3. Componente
- `src/components/StudyConfigDialog.tsx`

---

## 🎨 Design Implementado

### Progress Stepper
```
●━━━━━━━ ○ ─ ─ ─ ○ ─ ─ ─ ○
Essencial  Horários  Estilo  Metas
Obrigatório (3 opcionais restantes)
```

### 4 Seções

#### 1️⃣ Essencial (Obrigatória)
- Disponibilidade diária (Seg-Sex + Fim de semana)
- Estudar sábados/domingos (checkboxes)
- Duração preferida das sessões (curta/média/longa)

#### 2️⃣ Horários (Opcional)
- Manhã/Tarde/Noite/Madrugada
- Botões: "Prefiro" | "Evito"

#### 3️⃣ Estilo (Opcional)
- FSRS: Agressivo/Balanceado/Espaçado

#### 4️⃣ Metas (Opcional)
- Tipo de objetivo: Prova/Contínuo/Revisão
- Data da prova (se aplicável)

---

## 🔌 Como Integrar

### Opção 1: Modal na Primeira Vez (Recomendado)

```typescript
import { StudyConfigDialog } from '@/components/StudyConfigDialog';
import { useStudyConfig } from '@/hooks/useStudyConfig';

function DocumentsOrganizationPage() {
  const { config, isSetupCompleted } = useStudyConfig();
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Mostrar dialog na primeira vez
  useEffect(() => {
    if (config && !isSetupCompleted()) {
      setShowConfigDialog(true);
    }
  }, [config, isSetupCompleted]);

  return (
    <>
      {/* Seu conteúdo */}

      <StudyConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        onComplete={() => {
          console.log('Configuração completa!');
        }}
      />
    </>
  );
}
```

### Opção 2: Trigger ao Tentar Agendar/Criar Meta

```typescript
const handleFirstScheduleAttempt = () => {
  if (!isSetupCompleted()) {
    setShowConfigDialog(true);
  } else {
    // Prosseguir com agendamento normal
    openScheduleModal();
  }
};

// No botão de agendamento
<button onClick={handleFirstScheduleAttempt}>
  📅 Agendar
</button>
```

### Opção 3: Link Permanente em Settings

```typescript
// Em Settings ou Header
<Button onClick={() => setShowConfigDialog(true)}>
  ⚙️ Perfil de Estudo
</Button>
```

---

## 🚀 Usar Configurações

### 1. Verificar Disponibilidade Diária

```typescript
import { useStudyConfig } from '@/hooks/useStudyConfig';

function QuickSchedulePopover() {
  const { getDailyHours } = useStudyConfig();

  const selectedDate = new Date('2025-01-20');
  const availableHours = getDailyHours(selectedDate); // 3h ou 5h

  // Calcular se cabe
  const dailyUsage = 2.5; // horas já agendadas
  const itemDuration = 1.5; // horas do novo item

  if (dailyUsage + itemDuration > availableHours) {
    alert(`⚠️ Você só tem ${availableHours}h disponíveis neste dia`);
  }
}
```

### 2. Detectar Conflitos em Metas

```typescript
import { distributeItems } from '@/lib/schedule-distribution';
import { useStudyConfig } from '@/hooks/useStudyConfig';

function GoalCreationDialog() {
  const { config } = useStudyConfig();

  const distribution = await distributeItems({
    items: studyItems,
    startDate,
    endDate,
    hoursPerDay: config.weekday_hours, // 3h
    hoursPerDayWeekend: config.weekend_hours, // 5h (se diferente)
    studyWeekends: config.study_saturday || config.study_sunday,
  });

  if (distribution.conflicts.length > 0) {
    // Mostrar alerta de conflito
  }
}
```

### 3. Sugerir Horário Ideal

```typescript
function getSuggestedTime(date: Date, config: StudyConfig): string {
  const dayOfWeek = date.getDay();

  // Verificar preferências do usuário
  if (config.preferred_times.includes('afternoon')) {
    return '14:00'; // Tarde
  }

  if (config.preferred_times.includes('night')) {
    return '19:00'; // Noite
  }

  // Default
  return '09:00';
}
```

### 4. Aprender com Comportamento (Auto-ajuste)

```typescript
import { useStudyConfig } from '@/hooks/useStudyConfig';

function onStudyComplete(session: CompletedSession) {
  const { trackStudySession } = useStudyConfig();

  await trackStudySession({
    scheduledDate: '2025-01-20',
    estimatedDuration: 90, // minutos
    actualDuration: 75, // minutos (foi mais rápido)
    hourOfDay: 15, // 15h
    completed: true,
  });

  // Sistema aprende:
  // - speedMultiplier = 0.83 (usuário é 17% mais rápido)
  // - productiveHours.hour_15 = +1 (rende bem às 15h)
  // - completionRate.day_6 = { completed: 3, total: 3 } (100% aos sábados)
}
```

### 5. Verificar Setup

```typescript
const { isSetupCompleted, hasCompletedSection } = useStudyConfig();

if (!isSetupCompleted()) {
  // Mostrar dialog ou nudge
}

if (hasCompletedSection('times')) {
  // Pode usar sugestões de horário
}
```

---

## 🎯 Casos de Uso Práticos

### 1. Agendamento Manual com Validação

```typescript
function QuickSchedulePopover({ topicId, estimatedMinutes }) {
  const { config, getDailyHours } = useStudyConfig();
  const [selectedDate, setSelectedDate] = useState<Date>();

  const validateSchedule = () => {
    if (!selectedDate) return false;

    const availableMinutes = getDailyHours(selectedDate) * 60;
    const usedMinutes = getUsedMinutes(selectedDate); // Função sua
    const remaining = availableMinutes - usedMinutes;

    if (estimatedMinutes > remaining) {
      toast({
        title: '⚠️ Atenção',
        description: `Você só tem ${Math.floor(remaining / 60)}h${remaining % 60}m disponíveis neste dia`,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSchedule = () => {
    if (!validateSchedule()) return;
    // Prosseguir com agendamento
  };
}
```

### 2. Meta com Distribuição Inteligente

```typescript
function GoalCreationDialog() {
  const { config } = useStudyConfig();

  // Ajustar duração das sessões baseado em preferência
  const sessionDuration = config.preferred_session_duration; // 45, 90 ou 120

  // Dividir itens longos em sessões menores
  const studyItems = selectedSubtopics.map(sub => {
    const duration = sub.estimated_duration_minutes;

    if (duration > sessionDuration * 1.5) {
      // Dividir em 2 partes
      return [
        { ...sub, duration: duration * 0.6, part: 1 },
        { ...sub, duration: duration * 0.4, part: 2 },
      ];
    }

    return [{ ...sub, duration, part: 1 }];
  }).flat();

  // Distribuir respeitando configurações
  const distribution = await distributeItems({
    items: studyItems,
    startDate,
    endDate,
    hoursPerDay: config.weekday_hours,
    hoursPerDayWeekend: config.weekend_hours,
    studyWeekends: config.study_saturday || config.study_sunday,
  });
}
```

### 3. Nudge Inteligente

```typescript
function SmartNudge() {
  const { config } = useStudyConfig();
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    // Após 3 agendamentos sem configurar
    const scheduledCount = getScheduledItemsCount(); // Sua função

    if (scheduledCount >= 3 && !config?.metadata?.setupCompleted) {
      setShowNudge(true);
    }
  }, [config]);

  if (!showNudge) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
      <p className="font-semibold">💡 Dica: Configure seu perfil!</p>
      <p className="text-sm mt-1">Receba sugestões personalizadas de horários</p>
      <Button onClick={() => setShowConfigDialog(true)} className="mt-2">
        Configurar agora
      </Button>
    </div>
  );
}
```

---

## 📊 Schema da Tabela

```typescript
interface UserStudyConfig {
  id: string;
  user_id: string;

  // Essencial
  weekday_hours: number; // 0-10
  weekend_hours: number; // 0-10
  study_saturday: boolean;
  study_sunday: boolean;
  preferred_session_duration: number; // 45, 90, 120

  // Horários
  preferred_times: string[]; // ['morning', 'afternoon', 'night', 'dawn']
  avoid_times: string[];

  // Preferências
  fsrs_aggressiveness: 'aggressive' | 'balanced' | 'spaced';

  // Metas
  has_exam: boolean;
  exam_date: string | null;
  study_goal_type: 'exam' | 'continuous' | 'review';

  // Metadados (aprendizado)
  metadata: {
    speedMultiplier: number; // 0.8 = 20% mais rápido
    productiveHours: Record<string, number>; // hour_14: 5 (estudou 5x às 14h)
    completionRate: Record<string, { completed: number; total: number }>;
    lastLearningUpdate: string | null;
    setupCompleted: boolean;
    completedSections: string[]; // ['essential', 'times', 'preferences', 'goals']
  };

  created_at: string;
  updated_at: string;
}
```

---

## 🚀 Próximos Passos

### Para usar o sistema:

1. **Rodar migration** no Supabase Dashboard:
   ```bash
   # OU via CLI:
   npx supabase db push --include-all
   ```

2. **Importar componente** onde necessário:
   ```typescript
   import { StudyConfigDialog } from '@/components/StudyConfigDialog';
   import { useStudyConfig } from '@/hooks/useStudyConfig';
   ```

3. **Testar fluxo**:
   - Abrir dialog na primeira vez
   - Preencher seção essencial
   - Pular seções opcionais
   - Salvar e verificar no banco

4. **Integrar validações**:
   - Agendamento manual → validar contra disponibilidade
   - Criação de meta → usar horas configuradas
   - Sugestões → usar horários preferenciais

---

## 🎨 UI/UX Highlights

✅ **Progress stepper visual** com círculos e linhas
✅ **Labels dinâmicos** (Obrigatório | X opcionais restantes)
✅ **Ícones e emojis** para facilitar compreensão
✅ **3 botões claros**: Voltar | Salvar | Próximo
✅ **Texto de ajuda** em cada seção
✅ **Recomendações marcadas** com ⭐
✅ **Validações inline** (ranges, checkboxes)
✅ **Toast de sucesso** ao salvar

---

## 📝 Notas Importantes

### Defaults Inteligentes
- Se usuário pular configuração, usa: 3h/dia útil, 5h fim de semana, sessões médias (90min)
- Sistema funciona perfeitamente SEM configuração
- Configuração é **enhancement**, não requirement

### Aprendizado Silencioso
- `metadata` é atualizado automaticamente ao completar estudos
- Sistema aprende padrões reais vs. declarados
- Pode sugerir ajustes: "Notei que você sempre estuda à noite, quer atualizar?"

### Flexibilidade
- Usuário pode editar configurações a qualquer momento (Settings)
- Todas seções opcionais podem ser puladas
- Sistema se adapta ao que for configurado

---

**Versão:** 1.0
**Data:** 2025-01-20
**Status:** ✅ Pronto para integração
**Próximo:** Integrar no fluxo de agendamento/metas

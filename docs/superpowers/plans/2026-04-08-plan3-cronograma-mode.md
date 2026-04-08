# Plan 3: Cronograma Mode — Toggle + Calendar + Day Planner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggle in the DisciplinesSidebar that switches between Edital mode (current tree) and Cronograma mode (calendar sidebar + day planner in main area). Activity types (Parte 1/2, Revisão, Questões, Lei Seca) are shown in the planner.

**Architecture:** Toggle state lives in DocumentsOrganizationContext. Sidebar swaps content based on mode. Main page conditionally renders CronogramaDayView. Uses existing DayWithProgress, schedule_items, and getMockDayData for calendar display (real data when available, mock as fallback).

**Tech Stack:** React, Tailwind CSS, Supabase (schedule_items), existing FSRS hooks

**Depends on:** Plan 1 (rename) must be completed first.

**Spec:** `docs/superpowers/specs/2026-04-08-editais-documents-integration-design.md` (section "Cronograma — Toggle Edital/Cronograma")

---

### Task 1: Add Cronograma Mode State to Context

**Files:**
- Modify: `src/contexts/DocumentsOrganizationContext.tsx`

- [ ] **Step 1: Add state to context type**

```typescript
// Add to DocumentsOrganizationContextType:
cronogramaMode: boolean;
setCronogramaMode: (mode: boolean) => void;
cronogramaSelectedDate: Date | null;
setCronogramaSelectedDate: (date: Date | null) => void;
```

- [ ] **Step 2: Add state to provider**

```typescript
const [cronogramaMode, setCronogramaMode] = useState(false);
const [cronogramaSelectedDate, setCronogramaSelectedDate] = useState<Date | null>(null);
```

Add to the context value object.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/DocumentsOrganizationContext.tsx
git commit -m "feat: add cronogramaMode state to DocumentsOrganizationContext"
```

---

### Task 2: Add Toggle to DisciplinesSidebar

**Files:**
- Modify: `src/components/documents-organization/DisciplinesSidebar.tsx`

- [ ] **Step 1: Add segmented control toggle**

At the top of the sidebar, before the disciplinas list:

```tsx
<div className="mx-2 mt-2 mb-3 flex bg-muted rounded-lg p-1 border border-border">
  <button
    onClick={() => setCronogramaMode(false)}
    className={`flex-1 text-center py-1.5 rounded-md text-xs font-medium transition-all ${
      !cronogramaMode
        ? 'bg-background shadow-sm text-foreground'
        : 'text-muted-foreground'
    }`}
  >
    <span className="mr-1">📋</span> Edital
  </button>
  <button
    onClick={() => setCronogramaMode(true)}
    className={`flex-1 text-center py-1.5 rounded-md text-xs font-medium transition-all ${
      cronogramaMode
        ? 'bg-zinc-900 text-white shadow-sm'
        : 'text-muted-foreground'
    }`}
  >
    <span className="mr-1">📅</span> Cronograma
  </button>
</div>
```

- [ ] **Step 2: Conditionally render sidebar content**

```tsx
{cronogramaMode ? (
  <CronogramaCalendarSidebar
    selectedDate={cronogramaSelectedDate}
    onDateSelect={setCronogramaSelectedDate}
  />
) : (
  // Existing disciplinas list content
  <>
    {disciplinas.map((disciplina) => (
      // ... existing DisciplinaButton render
    ))}
  </>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/documents-organization/DisciplinesSidebar.tsx
git commit -m "feat: add Edital/Cronograma toggle to DisciplinesSidebar"
```

---

### Task 3: Create CronogramaCalendarSidebar

**Files:**
- Create: `src/components/documents-organization/CronogramaCalendarSidebar.tsx`

- [ ] **Step 1: Create component**

```tsx
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayWithProgress } from '@/components/DayWithProgress';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface Props {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
}

function getMonthGrid(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// TODO: Replace with real schedule_items data
function getMockDayData(day: number, month: number) {
  const seed = day * 31 + month * 7;
  const hasTopics = seed % 3 !== 0;
  return {
    progress: hasTopics ? ((seed * 17) % 70) + 10 : 0,
    load: hasTopics ? ((seed * 13) % 50) + 30 : 0,
    count: hasTopics ? (seed % 3) + 1 : 0,
  };
}

export function CronogramaCalendarSidebar({ selectedDate, onDateSelect }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  };
  const handleNextMonth = () => {
    setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });
  };

  const handleDayClick = (date: Date) => {
    if (selectedDate && isSameDate(selectedDate, date)) {
      onDateSelect(null);
    } else {
      onDateSelect(date);
    }
  };

  return (
    <div className="flex flex-col flex-1 px-2">
      {/* Month calendar */}
      <div className="p-3 bg-background border border-border rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-muted">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-bold text-foreground">
            {MESES[viewMonth]} {viewYear}
          </span>
          <button onClick={handleNextMonth} className="p-1 rounded hover:bg-muted">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-center text-[10px] text-muted-foreground/60 font-medium">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 justify-items-center">
          {monthGrid.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="w-8 h-8" />;
            const date = new Date(viewYear, viewMonth, day);
            const mock = getMockDayData(day, viewMonth);
            return (
              <DayWithProgress
                key={`${viewYear}-${viewMonth}-${day}`}
                day={day}
                progress={mock.progress}
                loadPercentage={mock.load}
                isToday={isSameDate(date, today)}
                isSelected={selectedDate ? isSameDate(date, selectedDate) : false}
                onClick={() => handleDayClick(date)}
              />
            );
          })}
        </div>
      </div>

      {/* Selected day stats */}
      {selectedDate && (
        <div className="mt-3 p-3 bg-background border border-border rounded-xl text-center">
          <div className="text-sm font-bold text-foreground">
            {selectedDate.getDate()} {MESES[selectedDate.getMonth()].substring(0, 3)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {getMockDayData(selectedDate.getDate(), selectedDate.getMonth()).count} atividades
          </div>
          {/* TODO: Show real stats from schedule_items */}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaCalendarSidebar.tsx
git commit -m "feat: create CronogramaCalendarSidebar with month calendar"
```

---

### Task 4: Create CronogramaDayView

**Files:**
- Create: `src/components/documents-organization/CronogramaDayView.tsx`

- [ ] **Step 1: Create component**

```tsx
import { useMemo } from 'react';
import { Play, Check, Clock, MoreHorizontal } from 'lucide-react';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface ActivityItem {
  id: string;
  title: string;
  disciplina: string;
  type: 'part1' | 'part2' | 'revision' | 'questions' | 'lei-seca';
  durationMinutes: number;
  completed: boolean;
  revisionNumber?: number;
  context?: string; // e.g., "CF Art. 5°"
}

const TYPE_CONFIG = {
  part1: { icon: '📖', label: 'Parte 1', color: 'text-blue-600' },
  part2: { icon: '📖', label: 'Parte 2', color: 'text-blue-600' },
  revision: { icon: '🔄', label: 'Revisão', color: 'text-amber-600' },
  questions: { icon: '❓', label: 'Questões', color: 'text-orange-600' },
  'lei-seca': { icon: '⚖️', label: 'Lei Seca', color: 'text-cyan-600' },
};

interface Props {
  date: Date;
  onStartActivity: (item: ActivityItem) => void;
}

export function CronogramaDayView({ date, onStartActivity }: Props) {
  // TODO: Replace with real schedule_items query
  const activities: ActivityItem[] = useMemo(() => {
    const seed = date.getDate() * 31 + date.getMonth() * 7;
    if (seed % 3 === 0) return [];
    return [
      { id: '1', title: 'Homicídio', disciplina: 'Dir. Penal', type: 'part1', durationMinutes: 40, completed: true },
      { id: '2', title: 'Dir. Fundamentais', disciplina: 'Dir. Constitucional', type: 'revision', durationMinutes: 15, completed: false, revisionNumber: 2, context: 'CF Art. 5°' },
      { id: '3', title: 'Atos Administrativos', disciplina: 'Dir. Administrativo', type: 'questions', durationMinutes: 30, completed: false, context: '15 questões' },
      { id: '4', title: 'Poder Judiciário', disciplina: 'Dir. Constitucional', type: 'lei-seca', durationMinutes: 25, completed: false, context: 'CF Art. 92-126' },
    ];
  }, [date]);

  const completedCount = activities.filter(a => a.completed).length;
  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMinutes, 0);
  const progressPct = activities.length > 0 ? Math.round((completedCount / activities.length) * 100) : 0;

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    return `${h}h${m > 0 ? `${m}min` : ''}`;
  };

  // Find next incomplete activity
  const nextActivityId = activities.find(a => !a.completed)?.id;

  if (activities.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">📅</div>
          <p className="text-sm text-muted-foreground">Nenhuma atividade agendada para este dia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              {DIAS_SEMANA[date.getDay()]}, {date.getDate()} de {MESES[date.getMonth()]}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {activities.length} atividades · {formatDuration(totalMinutes)} total
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-foreground">{progressPct}%</div>
            <div className="text-[10px] text-muted-foreground">concluído</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 bg-muted rounded-full">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {activities.map((item) => {
          const config = TYPE_CONFIG[item.type];
          const isNext = item.id === nextActivityId;
          const label = item.type === 'revision' && item.revisionNumber
            ? `${config.label} ${item.revisionNumber}`
            : config.label;

          return (
            <div key={item.id}>
              {/* Status label */}
              <div className="flex items-center gap-1.5 mb-1.5">
                {item.completed ? (
                  <>
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-green-600">CONCLUÍDA · {formatDuration(item.durationMinutes)}</span>
                  </>
                ) : isNext ? (
                  <>
                    <div className="w-4 h-4 bg-foreground rounded-full flex items-center justify-center">
                      <Play className="w-2 h-2 text-background fill-background" />
                    </div>
                    <span className="text-xs font-bold text-foreground">PRÓXIMA · {formatDuration(item.durationMinutes)}</span>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 bg-muted border-2 border-border rounded-full" />
                    <span className="text-xs font-semibold text-muted-foreground">PENDENTE · {formatDuration(item.durationMinutes)}</span>
                  </>
                )}
              </div>

              {/* Card */}
              <div className={`bg-background rounded-xl p-3 ${
                item.completed
                  ? 'border border-green-200 opacity-60'
                  : isNext
                    ? 'border-2 border-foreground shadow-md'
                    : 'border border-border'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                    item.completed ? 'bg-green-100' :
                    item.type === 'revision' ? 'bg-amber-100' :
                    item.type === 'questions' ? 'bg-orange-100' :
                    item.type === 'lei-seca' ? 'bg-cyan-100' : 'bg-blue-100'
                  }`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {item.title} — {label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.disciplina}{item.context ? ` · ${item.context}` : ''}
                    </div>
                  </div>
                  {item.completed && (
                    <span className="text-green-500 font-bold">✓</span>
                  )}
                </div>

                {/* Action buttons for next item */}
                {isNext && !item.completed && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onStartActivity(item)}
                      className="flex-1 bg-foreground text-background py-2 rounded-lg text-xs font-bold"
                    >
                      ▶ Iniciar {label}
                    </button>
                    <button className="bg-muted text-muted-foreground py-2 px-4 rounded-lg text-xs">
                      Adiar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaDayView.tsx
git commit -m "feat: create CronogramaDayView with activity cards and progress"
```

---

### Task 5: Wire Cronograma Mode into DocumentsOrganizationPage

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Conditionally render based on mode**

```tsx
import { CronogramaDayView } from '@/components/documents-organization/CronogramaDayView';

// Inside the page component, where the main content renders:
const { cronogramaMode, cronogramaSelectedDate, setCronogramaMode } = useDocumentsOrganization();

// In the render:
{cronogramaMode ? (
  cronogramaSelectedDate ? (
    <CronogramaDayView
      date={cronogramaSelectedDate}
      onStartActivity={(item) => {
        // Switch back to edital mode and select the topic
        setCronogramaMode(false);
        // TODO: Select the topic in the tree
      }}
    />
  ) : (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">📅</div>
        <p className="text-sm font-medium text-foreground">Selecione um dia no calendário</p>
        <p className="text-xs text-muted-foreground mt-1">Clique em uma data para ver as atividades do dia</p>
      </div>
    </div>
  )
) : (
  // Existing edital view (disciplina topics, drawer, etc.)
  <>{/* ... existing code ... */}</>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx
git commit -m "feat: wire cronograma mode into DocumentsOrganizationPage"
```

---

### Task 6: Verify

- [ ] **Step 1: Test flow**

1. Navigate to `/documents-organization`
2. Toggle "Cronograma" — sidebar should show full month calendar
3. Click a day — main area should show day planner with activity cards
4. Click "Edital" — sidebar returns to disciplinas list, main area returns to topic view
5. Verify no regressions on edital mode

- [ ] **Step 2: Build check**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete cronograma mode with toggle, calendar sidebar, and day planner"
```

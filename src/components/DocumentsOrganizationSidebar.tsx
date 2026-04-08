"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDocumentsOrganizationOptional } from "@/contexts/DocumentsOrganizationContext";
import { EditModeToggle } from "@/components/EditModeToggle";
import { HierarchySearch } from "@/components/HierarchySearch";
import { UnitItem } from "@/components/UnitItem";
import { TopicItem } from "@/components/TopicItem";
import { SubtopicItem } from "@/components/SubtopicItem";
import { DayWithProgress } from "@/components/DayWithProgress";
import { Target, Calendar, ChevronLeft, ChevronRight, ChevronsUpDown, X, Package } from "lucide-react";

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Mock deterministic data for each day
function getMockDayData(day: number, month: number) {
  const seed = day * 31 + month * 7;
  const hasTopicos = seed % 3 !== 0;
  return {
    progress: hasTopicos ? ((seed * 17) % 70) + 10 : 0,
    load: hasTopicos ? ((seed * 13) % 50) + 30 : 0,
    count: hasTopicos ? (seed % 3) + 1 : 0,
  };
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDays(baseDate: Date, offset: number): Date[] {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

function getMonthGrid(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

export function DocumentsOrganizationSidebar() {
  const ctx = useDocumentsOrganizationOptional();

  // Cronograma state (must be before early return)
  const [showCronograma, setShowCronograma] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [cronogramaDate, setCronogramaDate] = useState<Date | null>(null);
  const [prevExpandedDisciplinas, setPrevExpandedDisciplinas] = useState<Set<string> | null>(null);
  const [prevExpandedTopicos, setPrevExpandedTopicos] = useState<Set<string> | null>(null);

  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(today, weekOffset), [today, weekOffset]);
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Mock: get scheduled subtopico/topico IDs for a given date
  const scheduledIds = useMemo(() => {
    if (!cronogramaDate || !ctx) return new Set<string>();
    const ids = new Set<string>();
    const day = cronogramaDate.getDate();
    const month = cronogramaDate.getMonth();
    const { count } = getMockDayData(day, month);
    if (count === 0) return ids;

    let itemIndex = 0;
    for (const disciplina of ctx.disciplinas) {
      for (const topico of disciplina.topicos) {
        if (topico.subtopicos && topico.subtopicos.length > 0) {
          for (const sub of topico.subtopicos) {
            if ((itemIndex + day) % 4 === 0 && ids.size < count) {
              ids.add(sub.id);
            }
            itemIndex++;
          }
        } else {
          if ((itemIndex + day) % 4 === 0 && ids.size < count) {
            ids.add(topico.id);
          }
          itemIndex++;
        }
      }
    }
    return ids;
  }, [cronogramaDate, ctx]);

  // Handle day click
  const handleDayClick = useCallback((date: Date) => {
    if (cronogramaDate && isSameDate(cronogramaDate, date)) {
      setCronogramaDate(null);
    } else {
      setCronogramaDate(date);
    }
  }, [cronogramaDate]);

  // Clear cronograma filter
  const handleClearFilter = useCallback(() => {
    setCronogramaDate(null);
  }, []);

  // Toggle cronograma visibility
  const handleToggleCronograma = useCallback(() => {
    const next = !showCronograma;
    setShowCronograma(next);
    if (!next) {
      setCronogramaDate(null);
    }
  }, [showCronograma]);

  // Navigate week
  const handlePrevWeek = useCallback(() => setWeekOffset(w => w - 1), []);
  const handleNextWeek = useCallback(() => setWeekOffset(w => w + 1), []);

  // Navigate month
  const handlePrevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const handleNextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Toggle calendar mode
  const handleToggleMode = useCallback(() => {
    setCalendarMode(m => m === 'week' ? 'month' : 'week');
  }, []);

  // Auto-expand and auto-select when cronograma filter activates
  useEffect(() => {
    if (!ctx || scheduledIds.size === 0) {
      // Restore previous expansion state when filter clears
      if (!cronogramaDate && prevExpandedDisciplinas && prevExpandedTopicos) {
        ctx?.setExpandedDisciplinas(prevExpandedDisciplinas);
        ctx?.setExpandedTopicos(prevExpandedTopicos);
        setPrevExpandedDisciplinas(null);
        setPrevExpandedTopicos(null);
      }
      return;
    }

    const { disciplinas, expandedDisciplinas, expandedTopicos, setExpandedDisciplinas, setExpandedTopicos } = ctx;

    // Save current expansion state
    if (!prevExpandedDisciplinas) {
      setPrevExpandedDisciplinas(new Set(expandedDisciplinas));
      setPrevExpandedTopicos(new Set(expandedTopicos));
    }

    const disciplinasToExpand = new Set<string>();
    const topicosToExpand = new Set<string>();
    let firstItem: { disciplinaId: string; topicoId: string; subtopico: any } | null = null;

    for (const disciplina of disciplinas) {
      for (const topico of disciplina.topicos) {
        if (topico.subtopicos) {
          for (const sub of topico.subtopicos) {
            if (scheduledIds.has(sub.id)) {
              disciplinasToExpand.add(disciplina.id);
              topicosToExpand.add(topico.id);
              if (!firstItem) {
                firstItem = { disciplinaId: disciplina.id, topicoId: topico.id, subtopico: sub };
              }
            }
          }
        }
        if (scheduledIds.has(topico.id)) {
          disciplinasToExpand.add(disciplina.id);
        }
      }
    }

    setExpandedDisciplinas(disciplinasToExpand);
    setExpandedTopicos(topicosToExpand);

    // Auto-select first item
    if (firstItem) {
      ctx.handleSubtopicoSelect(firstItem.disciplinaId, firstItem.topicoId, firstItem.subtopico);
    }
  }, [cronogramaDate, scheduledIds]);

  if (!ctx) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-gray-400">Navegue para Conteudos</p>
      </div>
    );
  }

  const {
    disciplinas, isEditMode, setIsEditMode,
    expandedDisciplinas, expandedTopicos,
    selectedSubtopic, selectedTopic,
    editingDisciplina, subtopicoWithScheduleButton,
    toggleDisciplinaExpansion, toggleTopicoExpansion,
    handleSubtopicoSelect, handleTopicoSelect,
    handleSearchSelect,
    setEditingDisciplina, setSubtopicoWithScheduleButton,
    updateDisciplina, deleteDisciplina, deleteTopico, deleteSubtopico,
    setQuickCreateModal, setEditModal, setGoalDialogOpen,
    handleToggleSubtopicoComplete,
  } = ctx;

  // Filter tree when cronograma is active
  const isFiltered = cronogramaDate !== null && scheduledIds.size > 0;
  const displayDisciplinas = isFiltered
    ? disciplinas.map(disciplina => ({
        ...disciplina,
        topicos: disciplina.topicos.filter(topico => {
          if (scheduledIds.has(topico.id)) return true;
          return topico.subtopicos?.some(sub => scheduledIds.has(sub.id));
        }).map(topico => ({
          ...topico,
          subtopicos: topico.subtopicos?.filter(sub => scheduledIds.has(sub.id)),
        })),
      })).filter(disciplina => disciplina.topicos.length > 0)
    : disciplinas;

  // Format selected date for label
  const filterLabel = cronogramaDate
    ? `${cronogramaDate.getDate()} ${MESES[cronogramaDate.getMonth()].substring(0, 3)}`
    : '';
  const filterCount = scheduledIds.size;

  return (
    <div className="flex flex-col h-full">
      {/* Cronograma toggle */}
      <button
        onClick={handleToggleCronograma}
        className={`mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
          showCronograma
            ? 'bg-zinc-100 text-zinc-700 border border-zinc-200/60'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        Cronograma
        <ChevronRight className={`w-3 h-3 ml-auto transition-transform duration-300 ${showCronograma ? 'rotate-90' : ''}`} />
      </button>

      {/* Cronograma calendar (collapsible) */}
      <div className={`cronograma-collapse ${showCronograma ? 'open' : ''}`}>
        <div>
          <div className="mx-3 mt-1 mb-2 p-3 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200/40 dark:border-zinc-700/30 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)]">
            {/* Calendar mode: Week */}
            {calendarMode === 'week' && (
              <div>
                {/* Navigation + mode toggle */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={handlePrevWeek} className="p-1 rounded hover:bg-muted transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {weekDays[0].getDate()} {MESES[weekDays[0].getMonth()].substring(0, 3)} — {weekDays[6].getDate()} {MESES[weekDays[6].getMonth()].substring(0, 3)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={handleNextWeek} className="p-1 rounded hover:bg-muted transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={handleToggleMode} className="p-1 rounded hover:bg-muted transition-colors" title="Ver mes">
                      <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DIAS_SEMANA.map((d, i) => (
                    <div key={i} className="text-center text-[9px] text-muted-foreground/60 font-medium">{d}</div>
                  ))}
                </div>

                {/* Week strip with DayWithProgress */}
                <div className="grid grid-cols-7 gap-1 justify-items-center">
                  {weekDays.map((date) => {
                    const mock = getMockDayData(date.getDate(), date.getMonth());
                    return (
                      <DayWithProgress
                        key={date.toISOString()}
                        day={date.getDate()}
                        progress={mock.progress}
                        loadPercentage={mock.load}
                        isToday={isSameDate(date, today)}
                        isSelected={cronogramaDate ? isSameDate(date, cronogramaDate) : false}
                        onClick={() => handleDayClick(date)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calendar mode: Month */}
            {calendarMode === 'month' && (
              <div>
                {/* Month navigation + mode toggle */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-muted transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-[10px] text-foreground font-semibold">
                    {MESES[viewMonth]} {viewYear}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={handleNextMonth} className="p-1 rounded hover:bg-muted transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={handleToggleMode} className="p-1 rounded hover:bg-muted transition-colors" title="Ver semana">
                      <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {DIAS_SEMANA.map((d, i) => (
                    <div key={i} className="text-center text-[9px] text-muted-foreground/60 font-medium">{d}</div>
                  ))}
                </div>

                {/* Month grid with DayWithProgress */}
                <div className="grid grid-cols-7 gap-0.5 justify-items-center">
                  {monthGrid.map((day, i) => {
                    if (day === null) {
                      return <div key={`empty-${i}`} className="w-8 h-8" />;
                    }
                    const date = new Date(viewYear, viewMonth, day);
                    const mock = getMockDayData(day, viewMonth);
                    return (
                      <DayWithProgress
                        key={`${viewYear}-${viewMonth}-${day}`}
                        day={day}
                        progress={mock.progress}
                        loadPercentage={mock.load}
                        isToday={isSameDate(date, today)}
                        isSelected={cronogramaDate ? isSameDate(date, cronogramaDate) : false}
                        onClick={() => handleDayClick(date)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter label */}
            {cronogramaDate && (
              <div className="mt-2 flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-100 border border-zinc-200/60">
                <span className="text-[10px] font-medium text-zinc-700">
                  {filterLabel} — {filterCount} {filterCount === 1 ? 'topico' : 'topicos'}
                </span>
                <button
                  onClick={handleClearFilter}
                  className="p-0.5 rounded hover:bg-zinc-200 transition-colors"
                >
                  <X className="w-3 h-3 text-zinc-400 hover:text-zinc-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      {showCronograma && <div className="border-b border-zinc-200/40" />}

      {/* Header */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {isFiltered ? 'Tarefas do Dia' : 'Edital'}
          </h2>
          <div className="flex items-center gap-1">
            {!isFiltered && (
              <>
                <button
                  onClick={() => setGoalDialogOpen(true)}
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200"
                  title="Criar Nova Meta"
                >
                  <Target className="w-4 h-4" />
                </button>
                <EditModeToggle
                  isEditMode={isEditMode}
                  onToggle={() => setIsEditMode(!isEditMode)}
                />
              </>
            )}
          </div>
        </div>

        {!isFiltered && (
          <HierarchySearch
            disciplinas={disciplinas}
            onSelect={handleSearchSelect}
          />
        )}
      </div>

      <div className="border-b border-zinc-200/40" />

      {/* Disciplinas - lista simples */}
      <div className="flex-1 overflow-y-auto py-2">
        {isFiltered && displayDisciplinas.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-3 py-8">
            <p className="text-xs text-muted-foreground text-center">Nenhum topico agendado para este dia</p>
          </div>
        ) : (
          <div className="px-3 space-y-0.5">
            {displayDisciplinas.map((disciplina) => {
              const topicoCount = disciplina.topicos.length;
              const allSubs = disciplina.topicos.flatMap(t => t.subtopicos || []);
              const completedSubs = allSubs.filter(s => s.status === 'completed').length;
              const progress = allSubs.length > 0 ? Math.round((completedSubs / allSubs.length) * 100) : 0;

              return (
                <button
                  key={disciplina.id}
                  onClick={() => {
                    const el = document.getElementById(`discipline-${disciplina.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {disciplina.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 ml-[18px]">
                      <span className={`text-[9px] font-medium shrink-0 ${
                        progress === 100 ? 'text-emerald-600' : progress > 0 ? 'text-blue-500' : 'text-zinc-400'
                      }`}>
                        {progress === 100 ? 'Concluido' : progress > 0 ? 'Iniciado' : 'Nao iniciado'}
                      </span>
                      {allSubs.length > 0 && (
                        <div className="flex-1 h-[2px] rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                            progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`} style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                </button>
              );
            })}

            {!isFiltered && isEditMode && (
              <div className="mt-3 pt-3 border-t border-gray-200/50">
                <button
                  onClick={() => {
                    setQuickCreateModal({
                      isOpen: true,
                      type: 'disciplina',
                      disciplinaId: null,
                      topicoId: null,
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-gray-400 hover:bg-gray-100/50 hover:text-gray-600 transition-all"
                >
                  <span className="text-sm">+</span>
                  <span className="font-normal text-xs">Nova Disciplina</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDocumentsOrganizationOptional } from "@/contexts/DocumentsOrganizationContext";
import { EditModeToggle } from "@/components/EditModeToggle";
import { HierarchySearch } from "@/components/HierarchySearch";
import { UnitItem } from "@/components/UnitItem";
import { TopicItem } from "@/components/TopicItem";
import { SubtopicItem } from "@/components/SubtopicItem";
import { DayWithProgress } from "@/components/DayWithProgress";
import { Target, Calendar, ChevronLeft, ChevronRight, ChevronsUpDown, X } from "lucide-react";

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Mock deterministic data for each day
function getMockDayData(day: number, month: number) {
  const seed = day * 31 + month * 7;
  const hasTopics = seed % 3 !== 0;
  return {
    progress: hasTopics ? ((seed * 17) % 70) + 10 : 0,
    load: hasTopics ? ((seed * 13) % 50) + 30 : 0,
    count: hasTopics ? (seed % 3) + 1 : 0,
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
  const [prevExpandedUnits, setPrevExpandedUnits] = useState<Set<string> | null>(null);
  const [prevExpandedTopics, setPrevExpandedTopics] = useState<Set<string> | null>(null);

  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(today, weekOffset), [today, weekOffset]);
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Mock: get scheduled subtopic/topic IDs for a given date
  const scheduledIds = useMemo(() => {
    if (!cronogramaDate || !ctx) return new Set<string>();
    const ids = new Set<string>();
    const day = cronogramaDate.getDate();
    const month = cronogramaDate.getMonth();
    const { count } = getMockDayData(day, month);
    if (count === 0) return ids;

    let itemIndex = 0;
    for (const unit of ctx.units) {
      for (const topic of unit.topics) {
        if (topic.subtopics && topic.subtopics.length > 0) {
          for (const sub of topic.subtopics) {
            if ((itemIndex + day) % 4 === 0 && ids.size < count) {
              ids.add(sub.id);
            }
            itemIndex++;
          }
        } else {
          if ((itemIndex + day) % 4 === 0 && ids.size < count) {
            ids.add(topic.id);
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
      if (!cronogramaDate && prevExpandedUnits && prevExpandedTopics) {
        ctx?.setExpandedUnits(prevExpandedUnits);
        ctx?.setExpandedTopics(prevExpandedTopics);
        setPrevExpandedUnits(null);
        setPrevExpandedTopics(null);
      }
      return;
    }

    const { units, expandedUnits, expandedTopics, setExpandedUnits, setExpandedTopics } = ctx;

    // Save current expansion state
    if (!prevExpandedUnits) {
      setPrevExpandedUnits(new Set(expandedUnits));
      setPrevExpandedTopics(new Set(expandedTopics));
    }

    const unitsToExpand = new Set<string>();
    const topicsToExpand = new Set<string>();
    let firstItem: { unitId: string; topicId: string; subtopic: any } | null = null;

    for (const unit of units) {
      for (const topic of unit.topics) {
        if (topic.subtopics) {
          for (const sub of topic.subtopics) {
            if (scheduledIds.has(sub.id)) {
              unitsToExpand.add(unit.id);
              topicsToExpand.add(topic.id);
              if (!firstItem) {
                firstItem = { unitId: unit.id, topicId: topic.id, subtopic: sub };
              }
            }
          }
        }
        if (scheduledIds.has(topic.id)) {
          unitsToExpand.add(unit.id);
        }
      }
    }

    setExpandedUnits(unitsToExpand);
    setExpandedTopics(topicsToExpand);

    // Auto-select first item
    if (firstItem) {
      ctx.handleSubtopicSelect(firstItem.unitId, firstItem.topicId, firstItem.subtopic);
    }
  }, [cronogramaDate, scheduledIds]);

  if (!ctx) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-gray-400">Navegue para Conteúdos</p>
      </div>
    );
  }

  const {
    units, isEditMode, setIsEditMode,
    expandedUnits, expandedTopics,
    selectedSubtopic, selectedTopic,
    editingUnit, subtopicWithScheduleButton,
    toggleUnitExpansion, toggleTopicExpansion,
    handleSubtopicSelect, handleTopicSelect,
    handleSearchSelect,
    setEditingUnit, setSubtopicWithScheduleButton,
    updateUnit, deleteUnit, deleteTopic, deleteSubtopic,
    setQuickCreateModal, setEditModal, setGoalDialogOpen,
    handleToggleSubtopicComplete,
  } = ctx;

  // Filter tree when cronograma is active
  const isFiltered = cronogramaDate !== null && scheduledIds.size > 0;
  const displayUnits = isFiltered
    ? units.map(unit => ({
        ...unit,
        topics: unit.topics.filter(topic => {
          if (scheduledIds.has(topic.id)) return true;
          return topic.subtopics?.some(sub => scheduledIds.has(sub.id));
        }).map(topic => ({
          ...topic,
          subtopics: topic.subtopics?.filter(sub => scheduledIds.has(sub.id)),
        })),
      })).filter(unit => unit.topics.length > 0)
    : units;

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
                    <button onClick={handleToggleMode} className="p-1 rounded hover:bg-muted transition-colors" title="Ver mês">
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
                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-all duration-200"
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
            units={units}
            onSelect={handleSearchSelect}
          />
        )}
      </div>

      <div className="border-b border-zinc-200/40" />

      {/* Hierarquia (filtered or full) */}
      <div className="flex-1 overflow-y-auto py-2">
        {isFiltered && displayUnits.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-3 py-8">
            <p className="text-xs text-muted-foreground text-center">Nenhum topico agendado para este dia</p>
          </div>
        ) : (
          <div className="px-3 space-y-1">
            {displayUnits.map((unit) => (
              <UnitItem
                key={unit.id}
                unit={unit}
                isExpanded={expandedUnits.has(unit.id)}
                isEditMode={!isFiltered && isEditMode}
                isEditing={editingUnit === unit.id}
                onToggleExpand={() => toggleUnitExpansion(unit.id)}
                onEdit={() => setEditingUnit(unit.id)}
                onCancelEdit={() => setEditingUnit(null)}
                onSave={async (newTitle) => {
                  await updateUnit(unit.id, { title: newTitle });
                  setEditingUnit(null);
                }}
                onDelete={async () => {
                  if (confirm(`Deletar unidade "${unit.title}"?`)) {
                    await deleteUnit(unit.id);
                  }
                }}
              >
                <div className="space-y-1">
                  {unit.topics.map((topic) => (
                    <TopicItem
                      key={topic.id}
                      unitId={unit.id}
                      topic={topic}
                      isExpanded={expandedTopics.has(topic.id)}
                      isSelected={selectedTopic?.topic.id === topic.id}
                      isEditMode={!isFiltered && isEditMode}
                      isEditing={false}
                      hasSubtopics={!!(topic.subtopics && topic.subtopics.length > 0)}
                      onToggleExpand={() => toggleTopicExpansion(topic.id)}
                      onSelect={() => handleTopicSelect(unit.id, topic)}
                      onEdit={() => {
                        setEditModal({
                          isOpen: true,
                          type: 'topic',
                          unitId: unit.id,
                          topicId: null,
                          itemId: topic.id,
                          itemTitle: topic.title,
                          itemDuration: topic.estimated_duration_minutes || 120,
                          hasSubtopics: !!(topic.subtopics && topic.subtopics.length > 0),
                        });
                      }}
                      onCancelEdit={() => {}}
                      onSave={async () => {}}
                      onDelete={async () => {
                        if (confirm(`Deletar tópico "${topic.title}"?`)) {
                          await deleteTopic(unit.id, topic.id);
                        }
                      }}
                    >
                      {((topic.subtopics && topic.subtopics.length > 0) || (!isFiltered && isEditMode)) && (
                        <div className="space-y-1">
                          {topic.subtopics && topic.subtopics.map((subtopic) => (
                            <SubtopicItem
                              key={subtopic.id}
                              subtopic={subtopic}
                              unitId={unit.id}
                              topicId={topic.id}
                              isSelected={selectedSubtopic?.subtopic.id === subtopic.id}
                              isEditMode={!isFiltered && isEditMode}
                              isEditing={false}
                              showScheduleButton={subtopicWithScheduleButton === subtopic.id}
                              onToggleScheduleButton={() => {
                                setSubtopicWithScheduleButton(
                                  subtopicWithScheduleButton === subtopic.id ? null : subtopic.id
                                );
                              }}
                              onSelect={() => handleSubtopicSelect(unit.id, topic.id, subtopic)}
                              onEdit={() => {
                                setEditModal({
                                  isOpen: true,
                                  type: 'subtopic',
                                  unitId: unit.id,
                                  topicId: topic.id,
                                  itemId: subtopic.id,
                                  itemTitle: subtopic.title,
                                  itemDuration: subtopic.estimated_duration_minutes || 90,
                                  hasSubtopics: false,
                                });
                              }}
                              onCancelEdit={() => {}}
                              onSave={async () => {}}
                              onDelete={async () => {
                                if (confirm(`Deletar subtópico "${subtopic.title}"?`)) {
                                  await deleteSubtopic(unit.id, topic.id, subtopic.id);
                                }
                              }}
                              onToggleComplete={(completed) =>
                                handleToggleSubtopicComplete(unit.id, topic.id, subtopic.id, completed)
                              }
                            />
                          ))}

                          {!isFiltered && isEditMode && (
                            <button
                              onClick={() => {
                                setQuickCreateModal({
                                  isOpen: true,
                                  type: 'subtopic',
                                  unitId: unit.id,
                                  topicId: topic.id,
                                });
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-zinc-400 hover:bg-zinc-100/50 hover:text-amber-600 transition-all"
                            >
                              <span className="text-base font-semibold">+</span>
                              <span className="font-medium text-xs">Adicionar Subtópico</span>
                            </button>
                          )}
                        </div>
                      )}
                    </TopicItem>
                  ))}

                  {!isFiltered && isEditMode && (
                    <button
                      onClick={() => {
                        setQuickCreateModal({
                          isOpen: true,
                          type: 'topic',
                          unitId: unit.id,
                          topicId: null,
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-zinc-400 hover:bg-zinc-100/50 hover:text-amber-600 transition-all"
                    >
                      <span className="text-lg font-semibold">+</span>
                      <span className="font-medium text-sm">Adicionar Tópico</span>
                    </button>
                  )}
                </div>
              </UnitItem>
            ))}

            {!isFiltered && isEditMode && (
              <div className="mt-3 pt-3 border-t border-gray-200/50">
                <button
                  onClick={() => {
                    setQuickCreateModal({
                      isOpen: true,
                      type: 'unit',
                      unitId: null,
                      topicId: null,
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-gray-400 hover:bg-gray-100/50 hover:text-gray-600 transition-all"
                >
                  <span className="text-sm">+</span>
                  <span className="font-normal text-xs">Nova Unidade</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

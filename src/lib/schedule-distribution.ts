/**
 * Sistema de Distribuição Inteligente Baseado em Tempo
 *
 * Algoritmo que distribui items (tópicos/subtópicos) ao longo de um período,
 * considerando tempo estimado, intensidade e dias disponíveis.
 */

import { supabase } from '@/integrations/supabase/client';

export interface StudyItem {
  id: string;
  title: string;
  estimatedMinutes: number;
  topicId?: string;
  subtopicId?: string;
}

export interface DistributionParams {
  items: StudyItem[];
  startDate: Date;
  endDate: Date;
  hoursPerDay: number; // Horas de estudo por dia (ex: 2.5)
  studyWeekends: boolean; // Se deve estudar em fins de semana
  manualItems?: Array<{
    scheduled_date: string;
    estimated_duration: number;
    title: string
  }>; // Tópicos manuais já agendados (opcional)
  forceScheduling?: boolean; // Se true, força agendamento mesmo sem capacidade (para preview/conflitos)
}

export interface ScheduleItem {
  itemId: string;
  title: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  sessionType: 'part1' | 'part2' | 'revision';
  revisionNumber: number;
  topicId?: string;
  subtopicId?: string;
}

export interface DistributionResult {
  scheduleItems: ScheduleItem[];
  scenario: 'normal' | 'tight' | 'relaxed' | 'impossible';
  warnings: string[];
  totalMinutes: number;
  availableMinutes: number;
  utilizationPercentage: number;
  conflicts: DayConflict[];
}

export interface DaySlot {
  date: string; // YYYY-MM-DD
  totalCapacityMinutes: number;
  usedMinutes: number;
  availableMinutes: number;
  manualItems: Array<{
    title: string;
    duration: number;
  }>;
}

export interface DayConflict {
  date: string;
  requiredMinutes: number;
  availableMinutes: number;
  overloadPercentage: number;
}

export interface TopicConflict {
  topicId?: string;
  subtopicId?: string;
  title: string;
  existingItems: Array<{
    id: string;
    scheduled_date: string;
    estimated_duration: number;
    title: string;
  }>;
  action: 'convert' | 'replace' | 'skip';
}

export interface ConflictDetectionResult {
  conflicts: TopicConflict[];
  manualItemsWithoutConflict: Array<{
    scheduled_date: string;
    estimated_duration: number;
    title: string;
  }>;
}

/**
 * Calcula total de dias úteis (excluindo fins de semana se studyWeekends=false)
 */
function calculateAvailableDays(startDate: Date, endDate: Date, studyWeekends: boolean): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Domingo ou Sábado

    if (studyWeekends || !isWeekend) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Busca itens manuais já agendados no período
 */
export async function fetchManualItems(
  startDate: Date,
  endDate: Date,
  userId?: string
): Promise<Array<{ scheduled_date: string; estimated_duration: number; title: string }>> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { data, error } = await supabase
    .from('schedule_items')
    .select('scheduled_date, estimated_duration, title')
    .eq('user_id', userId)
    .eq('item_type', 'manual')
    .eq('completed', false)
    .gte('scheduled_date', formatDate(startDate))
    .lte('scheduled_date', formatDate(endDate));

  if (error) {
    console.error('Error fetching manual items:', error);
    return [];
  }

  return (data || []).map(item => ({
    ...item,
    estimated_duration: item.estimated_duration || 0
  }));
}

/**
 * Calcula slots disponíveis por dia, considerando tópicos manuais já agendados
 */
export async function calculateAvailableSlots(
  startDate: Date,
  endDate: Date,
  hoursPerDay: number,
  studyWeekends: boolean,
  manualItems?: Array<{ scheduled_date: string; estimated_duration: number; title: string }>
): Promise<DaySlot[]> {
  const slots: DaySlot[] = [];
  const current = new Date(startDate);
  const dailyCapacityMinutes = hoursPerDay * 60;

  // Formatar data como YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Pular fins de semana se studyWeekends=false
    if (!studyWeekends && isWeekend) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const dateStr = formatDate(current);

    // Buscar itens manuais neste dia
    const dayManualItems = (manualItems || []).filter(
      (item) => item.scheduled_date === dateStr
    );

    const usedMinutes = dayManualItems.reduce(
      (sum, item) => sum + (item.estimated_duration || 0),
      0
    );

    slots.push({
      date: dateStr,
      totalCapacityMinutes: dailyCapacityMinutes,
      usedMinutes,
      availableMinutes: Math.max(0, dailyCapacityMinutes - usedMinutes),
      manualItems: dayManualItems.map((item) => ({
        title: item.title,
        duration: item.estimated_duration || 0,
      })),
    });

    current.setDate(current.getDate() + 1);
  }

  return slots;
}

/**
 * Encontra o melhor slot disponível para um item
 * @param forceScheduling - Se true, retorna slot mesmo sem capacidade (para preview/detecção de conflitos)
 */
function findBestSlot(
  slots: DaySlot[],
  requiredMinutes: number,
  preferredDate?: string,
  forceScheduling: boolean = false
): DaySlot | null {
  if (slots.length === 0) return null;

  // Se tem data preferencial, tentar primeiro
  if (preferredDate) {
    const preferredSlot = slots.find(
      (s) => s.date === preferredDate && s.availableMinutes >= requiredMinutes
    );
    if (preferredSlot) return preferredSlot;
  }

  // Buscar primeiro slot disponível
  const availableSlot = slots.find((s) => s.availableMinutes >= requiredMinutes);
  if (availableSlot) return availableSlot;

  // Se forceScheduling=true, retornar slot com MAIS espaço disponível (para detectar conflitos)
  // Se forceScheduling=false, retornar null (não agendar se não houver capacidade)
  if (forceScheduling) {
    return slots.reduce((best, current) =>
      current.availableMinutes > best.availableMinutes ? current : best
    );
  }

  return null;
}

/**
 * Marca slot como usado, reduzindo minutos disponíveis
 */
function markSlotAsUsed(slot: DaySlot, usedMinutes: number): void {
  slot.usedMinutes += usedMinutes;
  slot.availableMinutes = Math.max(0, slot.totalCapacityMinutes - slot.usedMinutes);
}

/**
 * Detecta conflitos de sobrecarga por dia
 */
function detectConflicts(slots: DaySlot[]): DayConflict[] {
  const conflicts: DayConflict[] = [];

  // Verificar cada slot (usedMinutes já contém todos os items agendados)
  slots.forEach((slot) => {
    const totalRequired = slot.usedMinutes;

    if (totalRequired > slot.totalCapacityMinutes) {
      const overloadPercentage = Math.round(
        ((totalRequired - slot.totalCapacityMinutes) / slot.totalCapacityMinutes) * 100
      );

      conflicts.push({
        date: slot.date,
        requiredMinutes: totalRequired,
        availableMinutes: slot.totalCapacityMinutes,
        overloadPercentage,
      });
    }
  });

  return conflicts;
}

/**
 * Valida se a meta é viável
 */
export function validateGoalFeasibility(params: DistributionParams): {
  isValid: boolean;
  scenario: 'normal' | 'tight' | 'relaxed' | 'impossible';
  warnings: string[];
} {
  const { items, startDate, endDate, hoursPerDay, studyWeekends } = params;

  const totalMinutes = items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const availableDays = calculateAvailableDays(startDate, endDate, studyWeekends);
  const dailyCapacityMinutes = hoursPerDay * 60; // Converter horas para minutos
  const totalCapacity = availableDays * dailyCapacityMinutes;

  const utilization = (totalMinutes / totalCapacity) * 100;
  const warnings: string[] = [];

  // Cenário Impossível
  if (totalMinutes > totalCapacity) {
    const totalHours = (totalMinutes / 60).toFixed(1);
    const capacityHours = (totalCapacity / 60).toFixed(1);
    warnings.push(`Tempo necessário (${totalHours}h) excede capacidade (${capacityHours}h)`);
    warnings.push('Sugestões: Aumentar período, aumentar horas/dia ou reduzir itens');
    return { isValid: false, scenario: 'impossible', warnings };
  }

  // Cenário Apertado (>80% de utilização)
  if (utilization > 80) {
    warnings.push(`Cronograma apertado: ${Math.round(utilization)}% de utilização`);
    warnings.push('Pouco espaço para imprevistos ou revisões extras');
    return { isValid: true, scenario: 'tight', warnings };
  }

  // Cenário Folgado (<40% de utilização)
  if (utilization < 40) {
    warnings.push(`Cronograma folgado: apenas ${Math.round(utilization)}% de utilização`);
    warnings.push('Considere: reduzir período ou adicionar mais conteúdo');
    return { isValid: true, scenario: 'relaxed', warnings };
  }

  // Cenário Normal (40-80%)
  return { isValid: true, scenario: 'normal', warnings: [] };
}

/**
 * Distribui items ao longo do período usando slots disponíveis
 *
 * Estratégia:
 * 1. Busca tópicos manuais já agendados
 * 2. Calcula slots disponíveis por dia (capacidade - manuais)
 * 3. Ordena items por duração (maior primeiro)
 * 4. Para cada item:
 *    - Divide em Parte 1 (60%) e Parte 2 (40%)
 *    - Encontra slot com espaço suficiente
 *    - Agenda Part 1, depois Part 2 no dia seguinte (se possível)
 * 5. Detecta conflitos ao final
 */
export async function distributeItems(params: DistributionParams): Promise<DistributionResult> {
  const { items, startDate, endDate, hoursPerDay, studyWeekends, manualItems, forceScheduling = false } = params;

  // Validar viabilidade (mas continuar para detectar conflitos mesmo em cenários impossíveis)
  const validation = validateGoalFeasibility(params);

  // 1. Buscar ou usar itens manuais fornecidos
  const existingManualItems = manualItems || await fetchManualItems(startDate, endDate);

  // 2. Calcular slots disponíveis (considerando manuais)
  const slots = await calculateAvailableSlots(
    startDate,
    endDate,
    hoursPerDay,
    studyWeekends,
    existingManualItems
  );

  // 3. Ordenar items por duração (maior para menor)
  const sortedItems = [...items].sort((a, b) => b.estimatedMinutes - a.estimatedMinutes);

  const scheduleItems: ScheduleItem[] = [];

  // 4. Distribuir cada item nos slots disponíveis
  for (const item of sortedItems) {
    // Calcular Parte 1 (60%) e Parte 2 (40%)
    const part1Minutes = Math.round(item.estimatedMinutes * 0.6);
    const part2Minutes = item.estimatedMinutes - part1Minutes;

    // Encontrar slot para Parte 1
    const part1Slot = findBestSlot(slots, part1Minutes, undefined, forceScheduling);
    if (!part1Slot) {
      console.warn(`Não foi possível agendar Part 1 de "${item.title}" - sem slots disponíveis`);
      continue;
    }

    // Agendar Parte 1
    scheduleItems.push({
      itemId: item.id,
      title: `${item.title} - Estudo Inicial (Parte 1)`,
      date: part1Slot.date,
      durationMinutes: part1Minutes,
      sessionType: 'part1',
      revisionNumber: 0,
      topicId: item.topicId,
      subtopicId: item.subtopicId,
    });

    // Marcar slot como usado
    markSlotAsUsed(part1Slot, part1Minutes);

    // Tentar agendar Parte 2 no dia seguinte (consecutivo)
    const part1SlotIndex = slots.findIndex((s) => s.date === part1Slot.date);
    const nextDaySlot = part1SlotIndex >= 0 ? slots[part1SlotIndex + 1] : null;

    const part2Slot = findBestSlot(slots, part2Minutes, nextDaySlot?.date, forceScheduling);
    if (!part2Slot) {
      console.warn(`Não foi possível agendar Part 2 de "${item.title}" - sem slots disponíveis`);
      continue;
    }

    // Agendar Parte 2
    scheduleItems.push({
      itemId: item.id,
      title: `${item.title} - Estudo Inicial (Parte 2)`,
      date: part2Slot.date,
      durationMinutes: part2Minutes,
      sessionType: 'part2',
      revisionNumber: 0,
      topicId: item.topicId,
      subtopicId: item.subtopicId,
    });

    // Marcar slot como usado
    markSlotAsUsed(part2Slot, part2Minutes);
  }

  // 5. Calcular estatísticas
  const totalMinutes = items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const availableDays = calculateAvailableDays(startDate, endDate, studyWeekends);
  const dailyCapacityMinutes = hoursPerDay * 60;
  const totalCapacity = availableDays * dailyCapacityMinutes;
  const utilization = (totalMinutes / totalCapacity) * 100;

  // 6. Detectar conflitos (sobrecarga por dia) usando slots reais
  const conflicts = detectConflicts(slots);

  console.log('[DEBUG] Slots final state:', slots.map(s => ({
    date: s.date,
    used: s.usedMinutes,
    capacity: s.totalCapacityMinutes,
    available: s.availableMinutes
  })));

  return {
    scheduleItems,
    scenario: validation.scenario,
    warnings: validation.warnings,
    totalMinutes,
    availableMinutes: totalCapacity,
    utilizationPercentage: Math.round(utilization),
    conflicts,
  };
}

/**
 * Preview da distribuição (sem criar items)
 */
export async function previewDistribution(params: DistributionParams): Promise<DistributionResult> {
  return await distributeItems(params);
}

/**
 * Detecta conflitos entre tópicos/subtópicos selecionados e itens manuais existentes
 */
export async function detectTopicConflicts(
  selectedItems: StudyItem[],
  startDate: Date,
  endDate: Date,
  userId?: string
): Promise<ConflictDetectionResult> {
  // Buscar todos os itens manuais no período
  const manualItems = await fetchManualItems(startDate, endDate, userId);

  if (manualItems.length === 0) {
    return {
      conflicts: [],
      manualItemsWithoutConflict: [],
    };
  }

  // Buscar detalhes completos dos itens manuais (com IDs e relações)
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        conflicts: [],
        manualItemsWithoutConflict: manualItems,
      };
    }
    userId = user.id;
  }

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { data: manualItemsDetailed, error } = await supabase
    .from('schedule_items')
    .select('id, scheduled_date, estimated_duration, title, topic_id, subtopic_id')
    .eq('user_id', userId)
    .eq('item_type', 'manual')
    .eq('completed', false)
    .gte('scheduled_date', formatDate(startDate))
    .lte('scheduled_date', formatDate(endDate));

  if (error || !manualItemsDetailed) {
    console.error('Error fetching detailed manual items:', error);
    return {
      conflicts: [],
      manualItemsWithoutConflict: manualItems,
    };
  }

  const conflicts: TopicConflict[] = [];
  const conflictingManualItemIds = new Set<string>();

  // Para cada item selecionado, verificar se há manual item com mesmo topic_id ou subtopic_id
  selectedItems.forEach((selectedItem) => {
    const matchingManualItems = manualItemsDetailed.filter((manualItem) => {
      // Se item selecionado é subtópico, verificar subtopic_id
      if (selectedItem.subtopicId) {
        return manualItem.subtopic_id === selectedItem.subtopicId;
      }
      // Se item selecionado é tópico, verificar topic_id
      if (selectedItem.topicId) {
        return manualItem.topic_id === selectedItem.topicId && !manualItem.subtopic_id;
      }
      return false;
    });

    if (matchingManualItems.length > 0) {
      conflicts.push({
        topicId: selectedItem.topicId,
        subtopicId: selectedItem.subtopicId,
        title: selectedItem.title,
        existingItems: matchingManualItems.map((item) => ({
          id: item.id,
          scheduled_date: item.scheduled_date,
          estimated_duration: item.estimated_duration || 0,
          title: item.title,
        })),
        action: 'convert', // Padrão recomendado
      });

      // Marcar esses itens como conflitantes
      matchingManualItems.forEach((item) => conflictingManualItemIds.add(item.id));
    }
  });

  // Itens manuais que não conflitam
  const manualItemsWithoutConflict = manualItemsDetailed
    .filter((item) => !conflictingManualItemIds.has(item.id))
    .map((item) => ({
      scheduled_date: item.scheduled_date,
      estimated_duration: item.estimated_duration || 0,
      title: item.title,
    }));

  return {
    conflicts,
    manualItemsWithoutConflict,
  };
}

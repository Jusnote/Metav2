import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useStudyGoals } from '@/hooks/useStudyGoals';
import { useStudyConfig } from '@/contexts/StudyConfigContext';
import { useToast } from '@/hooks/use-toast';
import { SubtopicSelector } from './SubtopicSelector';
import { GoalPreviewSummary } from './GoalPreviewSummary';
import { AvailabilityPreview } from './AvailabilityPreview';
import { AvailabilityAdjustmentDrawer } from './AvailabilityAdjustmentDrawer';
import { TopicConflictResolver } from './TopicConflictResolver';
import { validateGoalFeasibility, distributeItems, fetchManualItems, detectTopicConflicts, type StudyItem, type DayConflict, type TopicConflict } from '@/lib/schedule-distribution';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

// Validation schema
const goalSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  date_range: z.object({
    from: z.date(),
    to: z.date(),
  })
    .refine((data) => data.from, { message: 'Data de início é obrigatória' })
    .refine((data) => data.to, { message: 'Data de término é obrigatória' })
    .refine((data) => data.to > data.from, {
      message: 'Data de término deve ser maior que data de início',
    }),
  study_weekends: z.boolean(),
  enable_fsrs: z.boolean(),
});

type GoalFormData = z.infer<typeof goalSchema>;

interface Subtopico {
  id: string;
  nome: string;
  estimated_duration_minutes?: number;
  topico_id: string;
}

interface Topico {
  id: string;
  nome: string;
  estimated_duration_minutes?: number;
  subtopicos: Subtopico[];
}

interface Disciplina {
  id: string;
  nome: string;
  topicos: Topico[];
}

interface DayException {
  date: Date;
  hours: number;
  reason?: string;
  diff: number;
}

interface GoalCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalCreationDialog({ open, onOpenChange }: GoalCreationDialogProps) {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set()); // Tópicos sem subtópicos
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [overlappingGoals, setOverlappingGoals] = useState<any[]>([]);
  const [showAvailabilityDrawer, setShowAvailabilityDrawer] = useState(false);
  const [availabilityRefreshTrigger, setAvailabilityRefreshTrigger] = useState(0);
  const [topicConflicts, setTopicConflicts] = useState<TopicConflict[]>([]);
  const [manualItemsWithoutConflict, setManualItemsWithoutConflict] = useState<Array<{
    scheduled_date: string;
    estimated_duration: number;
    title: string;
  }>>([]);

  const { createGoalWithSchedule, checkGoalOverlap, convertManualItemsToGoal, deleteManualItems } = useStudyGoals();
  const { getDailyHours, getDayException, setDayException, removeDayException, config, refreshConfig } = useStudyConfig();
  const { toast } = useToast();

  // DEBUGGING: Rastrear mudanças no config
  useEffect(() => {
    if (config) {
      console.log('💎 [GoalCreationDialog] CONFIG CHANGED');
      console.log('💎 [GoalCreationDialog] config.daily_exceptions:', config.daily_exceptions);
      console.log('💎 [GoalCreationDialog] Available exceptions:', Object.keys(config.daily_exceptions || {}).length);
    }
  }, [config]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      study_weekends: false,
      enable_fsrs: true,
    },
  });

  const dateRange = watch('date_range');
  const studyWeekends = watch('study_weekends');
  const enableFSRS = watch('enable_fsrs');

  // Calcular disponibilidade com base no período selecionado
  const availabilityData = useMemo(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🟡 [availabilityData useMemo] RECALCULATING');
    console.log('🟡 [availabilityData useMemo] config object:', config);
    console.log('🟡 [availabilityData useMemo] config.daily_exceptions:', config?.daily_exceptions);
    console.log('🟡 [availabilityData useMemo] availabilityRefreshTrigger:', availabilityRefreshTrigger);

    if (!dateRange?.from || !dateRange?.to || !config) {
      console.log('🟡 [availabilityData useMemo] Missing data, returning null');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return null;
    }

    const startDate = dateRange.from;
    const endDate = dateRange.to;
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    let weekdayCount = 0;
    let weekendCount = 0;
    let totalHours = 0;
    const exceptions: DayException[] = [];

    allDays.forEach((currentDate) => {
      const dayOfWeek = getDay(currentDate);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Determinar horas padrão para este dia
      const defaultHours = isWeekend
        ? (config.weekend_hours ?? 5)
        : (config.weekday_hours ?? 3);

      // Obter exceção diretamente do config (não usar getDayException para evitar closure stale)
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const dayException = config.daily_exceptions?.[dateKey] || null;

      // Calcular horas reais
      const actualHours = dayException ? dayException.hours : defaultHours;

      // Verificar se tem exceção configurada
      if (dayException) {
        const diff = dayException.hours - defaultHours;
        exceptions.push({
          date: currentDate,
          hours: dayException.hours,
          reason: dayException.reason,
          diff,
        });
      }

      // Contabilizar dias e horas
      if (isWeekend) {
        if (studyWeekends) {
          weekendCount++;
          totalHours += actualHours;
        }
      } else {
        weekdayCount++;
        totalHours += actualHours;
      }
    });

    // Ordenar exceções por data
    exceptions.sort((a, b) => a.date.getTime() - b.date.getTime());

    const result = {
      weekdayHours: config.weekday_hours ?? 3,
      weekendHours: config.weekend_hours ?? 5,
      weekdayCount,
      weekendCount,
      totalHours,
      exceptions,
    };

    console.log('🟡 [availabilityData useMemo] RESULT:', result);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return result;
  }, [dateRange, studyWeekends, config, availabilityRefreshTrigger]); // ← Usar config inteiro em vez de propriedades individuais

  // Carregar hierarquia completa (unidades → tópicos → subtópicos) e resetar ao abrir/fechar
  useEffect(() => {
    if (open) {
      // Refresh config to get latest values
      refreshConfig();
      loadHierarchy();
    } else {
      // Resetar formulário quando fechar
      reset({
        study_weekends: false,
        enable_fsrs: true,
      });
      setSelectedSubtopics(new Set());
      setSelectedTopics(new Set());
      setPreview(null);
      setOverlappingGoals([]);
    }
  }, [open, reset, refreshConfig]);

  // Verificar overlap de metas ao mudar datas
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const overlapping = checkGoalOverlap(dateRange.from, dateRange.to);
      setOverlappingGoals(overlapping || []);
    } else {
      setOverlappingGoals([]);
    }
  }, [dateRange, checkGoalOverlap]);

  const loadHierarchy = async () => {
    try {
      setIsLoadingData(true);

      // Buscar hierarquia completa com join
      const { data: disciplinasData, error: disciplinasError } = await supabase
        .from('disciplinas')
        .select(`
          id,
          nome,
          topicos (
            id,
            nome,
            estimated_duration_minutes,
            subtopicos (
              id,
              nome,
              estimated_duration_minutes,
              topico_id
            )
          )
        `)
        .order('nome')
        .order('nome', { foreignTable: 'topicos' })
        .order('nome', { foreignTable: 'topicos.subtopicos' });

      if (disciplinasError) throw disciplinasError;

      const formattedDisciplinas: Disciplina[] = (disciplinasData || []).map((disciplina: any) => ({
        id: disciplina.id,
        nome: disciplina.nome,
        topicos: (disciplina.topicos || []).map((topico: any) => ({
          id: topico.id,
          nome: topico.nome,
          estimated_duration_minutes: topico.estimated_duration_minutes,
          subtopicos: (topico.subtopicos || []).map((subtopico: any) => ({
            id: subtopico.id,
            nome: subtopico.nome,
            estimated_duration_minutes: subtopico.estimated_duration_minutes,
            topico_id: subtopico.topico_id,
          })),
        })),
      }));

      setDisciplinas(formattedDisciplinas);
    } catch (error: any) {
      console.error('Error loading hierarchy:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error?.message || 'Erro desconhecido ao buscar disciplinas, topicos e subtopicos',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Toggle seleção de subtópico
  const toggleSubtopic = (subtopicId: string) => {
    const newSelected = new Set(selectedSubtopics);
    if (newSelected.has(subtopicId)) {
      newSelected.delete(subtopicId);
    } else {
      newSelected.add(subtopicId);
    }
    setSelectedSubtopics(newSelected);
  };

  // Toggle seleção de tópico (sem subtópicos)
  const toggleTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopics(newSelected);
  };

  // Toggle todos os subtópicos de um tópico de uma vez (atalho)
  const toggleAllSubtopics = (subtopicIds: string[]) => {
    const newSelected = new Set(selectedSubtopics);
    const allSelected = subtopicIds.every(id => newSelected.has(id));

    if (allSelected) {
      // Deselecionar todos
      subtopicIds.forEach(id => newSelected.delete(id));
    } else {
      // Selecionar todos
      subtopicIds.forEach(id => newSelected.add(id));
    }

    setSelectedSubtopics(newSelected);
  };

  // Calcular média de horas disponíveis por dia no período
  const calculateAverageHoursPerDay = (startDate: Date, endDate: Date, studyWeekends: boolean): number => {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let totalHours = 0;
    let validDays = 0;

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // Pular fins de semana se não estudar
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend && !studyWeekends) continue;

      const dailyHours = getDailyHours(currentDate);
      if (dailyHours > 0) {
        totalHours += dailyHours;
        validDays++;
      }
    }

    return validDays > 0 ? totalHours / validDays : 3; // Fallback: 3h/dia
  };

  // Calcular preview baseado nos subtópicos e tópicos selecionados COM VALIDAÇÃO e CONFLITOS
  useEffect(() => {
    const calculatePreview = async () => {
      const totalSelected = selectedSubtopics.size + selectedTopics.size;
      if (!dateRange?.from || !dateRange?.to || totalSelected === 0) {
        return null;
      }

      // Calcular horas médias por dia baseado na disponibilidade configurada
      const hoursPerDay = calculateAverageHoursPerDay(dateRange.from, dateRange.to, studyWeekends);

      // Preparar items para validação
      const studyItems: StudyItem[] = [];
      const previewItems: Array<{ id: string; title: string; estimatedMinutes: number; type: 'topico' | 'subtopico' }> = [];

      disciplinas.forEach(disciplina => {
        disciplina.topicos.forEach(topico => {
          // Topico sem subtopicos selecionado
          if (selectedTopics.has(topico.id) && topico.subtopicos.length === 0) {
            const estimatedMinutes = topico.estimated_duration_minutes || 120;
            studyItems.push({
              id: topico.id,
              title: topico.nome,
              estimatedMinutes,
              topicoId: topico.id,
            });
            previewItems.push({
              id: topico.id,
              title: topico.nome,
              estimatedMinutes,
              type: 'topico',
            });
          }
          // Subtopicos selecionados
          topico.subtopicos.forEach(subtopico => {
            if (selectedSubtopics.has(subtopico.id)) {
              const estimatedMinutes = subtopico.estimated_duration_minutes || 90;
              studyItems.push({
                id: subtopico.id,
                title: subtopico.nome,
                estimatedMinutes,
                subtopicoId: subtopico.id,
                topicoId: topico.id,
              });
              previewItems.push({
                id: subtopico.id,
                title: subtopico.nome,
                estimatedMinutes,
                type: 'subtopico',
              });
            }
          });
        });
      });

      // Validar viabilidade
      console.log('[DEBUG] Input params:', {
        hoursPerDay,
        studyWeekends,
        studyItemsCount: studyItems.length,
        dateRange: { from: dateRange.from, to: dateRange.to }
      });

      const validation = validateGoalFeasibility({
        items: studyItems,
        startDate: dateRange.from,
        endDate: dateRange.to,
        hoursPerDay,
        studyWeekends,
      });

      // Detectar conflitos de tópicos com itens manuais existentes
      try {
        const conflictDetection = await detectTopicConflicts(
          studyItems,
          dateRange.from,
          dateRange.to
        );
        setTopicConflicts(conflictDetection.conflicts);
        setManualItemsWithoutConflict(conflictDetection.manualItemsWithoutConflict);
        console.log('[DEBUG] Topic conflicts detected:', conflictDetection.conflicts);
      } catch (error) {
        console.error('Error detecting topic conflicts:', error);
        setTopicConflicts([]);
        setManualItemsWithoutConflict([]);
      }

      // Buscar items manuais existentes no período (para distribuição)
      let manualItems: Array<{ scheduled_date: string; estimated_duration: number; title: string }> = [];
      try {
        manualItems = await fetchManualItems(dateRange.from, dateRange.to);
        console.log('[DEBUG] Manual items found:', manualItems);
      } catch (error) {
        console.error('Error fetching manual items:', error);
      }

      // Distribuir para obter conflitos detalhados (sempre, para mostrar conflitos mesmo em cenários impossíveis)
      let conflicts: DayConflict[] = [];
      let availableMinutes = 0;
      let utilizationPercentage = 0;

      try {
        const distribution = await distributeItems({
          items: studyItems,
          startDate: dateRange.from,
          endDate: dateRange.to,
          hoursPerDay,
          studyWeekends,
          manualItems, // Passar items manuais para considerar na distribuição
          forceScheduling: true, // Preview: força agendamento para detectar conflitos
        });

        conflicts = distribution.conflicts;
        availableMinutes = distribution.availableMinutes;
        utilizationPercentage = distribution.utilizationPercentage;

        console.log('[DEBUG] Distribution result:', {
          conflictsCount: conflicts.length,
          conflicts,
          availableMinutes,
          utilizationPercentage,
          scheduleItemsCount: distribution.scheduleItems.length
        });
      } catch (error) {
        console.error('Error calculating distribution:', error);
      }

      // Calcular estatísticas
      const days = Math.ceil(
        (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      const totalMinutes = studyItems.reduce((sum, item) => sum + item.estimatedMinutes, 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

      return {
        days,
        itemCount: totalSelected,
        subtopicCount: selectedSubtopics.size,
        topicCount: selectedTopics.size,
        totalHours,
        totalMinutes,
        scenario: validation.scenario,
        isValid: validation.isValid,
        warnings: validation.warnings,
        conflicts,
        items: previewItems,
        availableMinutes,
        utilizationPercentage,
        manualItems, // Adicionar items manuais ao preview
      };
    };

    calculatePreview().then(setPreview);
  }, [selectedSubtopics, selectedTopics, dateRange, studyWeekends, disciplinas, getDailyHours]);

  // Submit handler
  const onSubmit = async (data: GoalFormData) => {
    const totalSelected = selectedSubtopics.size + selectedTopics.size;
    if (totalSelected === 0) {
      toast({
        title: 'Nenhum item selecionado',
        description: 'Selecione pelo menos um tópico ou subtópico para criar a meta',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Preparar itens para createGoalWithSchedule (subtópicos + tópicos sem subtópicos)
      const items: Array<{
        subtopicId?: string;
        topicId?: string;
        title: string;
        estimatedMinutes: number
      }> = [];

      // Preparar também para validação
      const studyItems: StudyItem[] = [];

      disciplinas.forEach(disciplina => {
        disciplina.topicos.forEach(topico => {
          // Topicos sem subtopicos selecionados
          if (selectedTopics.has(topico.id) && topico.subtopicos.length === 0) {
            const estimatedMinutes = topico.estimated_duration_minutes || 120;
            items.push({
              topicoId: topico.id,
              title: topico.nome,
              estimatedMinutes,
            });
            studyItems.push({
              id: topico.id,
              title: topico.nome,
              estimatedMinutes,
              topicoId: topico.id,
            });
          }
          // Subtopicos selecionados
          topico.subtopicos.forEach(subtopico => {
            if (selectedSubtopics.has(subtopico.id)) {
              const estimatedMinutes = subtopico.estimated_duration_minutes || 90;
              items.push({
                subtopicoId: subtopico.id,
                title: subtopico.nome,
                estimatedMinutes,
              });
              studyItems.push({
                id: subtopico.id,
                title: subtopico.nome,
                estimatedMinutes,
                subtopicoId: subtopico.id,
                topicoId: topico.id,
              });
            }
          });
        });
      });

      // Calcular horas médias por dia baseado na disponibilidade configurada
      const hoursPerDay = calculateAverageHoursPerDay(data.date_range.from, data.date_range.to, data.study_weekends);

      // Validar viabilidade antes de criar
      const validation = validateGoalFeasibility({
        items: studyItems,
        startDate: data.date_range.from,
        endDate: data.date_range.to,
        hoursPerDay,
        studyWeekends: data.study_weekends,
      });

      if (!validation.isValid) {
        toast({
          title: 'Meta impossível de ser cumprida',
          description: validation.warnings.join(' '),
          variant: 'destructive',
        });
        return;
      }

      // Função para formatar data local (evita problema de timezone UTC)
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      console.log('🔍 DEBUG GOAL CREATION:', {
        from_raw: data.date_range.from,
        to_raw: data.date_range.to,
        from_formatted: formatLocalDate(data.date_range.from),
        to_formatted: formatLocalDate(data.date_range.to),
      });

      // Criar meta com schedule (passando itens: tópicos + subtópicos)
      const result = await createGoalWithSchedule({
        goalData: {
          title: data.title,
          start_date: formatLocalDate(data.date_range.from),
          target_date: formatLocalDate(data.date_range.to),
          study_weekends: data.study_weekends,
          enable_fsrs: data.enable_fsrs,
          // aggressiveness: null, // Usa agressividade global (user_study_config.fsrs_aggressiveness)
        },
        items, // Passando tópicos e subtópicos
      });

      // Processar conflitos de tópicos após criar a meta
      if (topicConflicts.length > 0) {
        let convertedCount = 0;
        let replacedCount = 0;
        let skippedCount = 0;

        for (const conflict of topicConflicts) {
          const itemIds = conflict.existingItems.map((item) => item.id);

          if (conflict.action === 'convert') {
            // Vincular itens manuais à meta
            await convertManualItemsToGoal(itemIds, result.goal.id);
            convertedCount++;
          } else if (conflict.action === 'replace') {
            // Deletar itens manuais (soft delete)
            await deleteManualItems(itemIds);
            replacedCount++;
          }
          // Se action === 'skip', não faz nada (itens manuais permanecem independentes)
          if (conflict.action === 'skip') {
            skippedCount++;
          }
        }

        console.log('[DEBUG] Conflict resolution:', {
          converted: convertedCount,
          replaced: replacedCount,
          skipped: skippedCount,
        });
      }

      // Mensagem de sucesso com resumo de conflitos
      let successMessage = `${result.scheduleItems.length} itens foram agendados`;
      if (topicConflicts.length > 0) {
        const convertedCount = topicConflicts.filter((c) => c.action === 'convert').length;
        const replacedCount = topicConflicts.filter((c) => c.action === 'replace').length;

        if (convertedCount > 0) {
          successMessage += `. ${convertedCount} item${convertedCount > 1 ? 's' : ''} manual${convertedCount > 1 ? 'is' : ''} vinculado${convertedCount > 1 ? 's' : ''} à meta`;
        }
        if (replacedCount > 0) {
          successMessage += `. ${replacedCount} item${replacedCount > 1 ? 's' : ''} manual${replacedCount > 1 ? 'is' : ''} substituído${replacedCount > 1 ? 's' : ''}`;
        }
      }

      toast({
        title: '✅ Meta criada com sucesso!',
        description: successMessage,
      });

      // Limpar form e fechar
      reset();
      setSelectedSubtopics(new Set());
      setSelectedTopics(new Set());
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating goal:', error);
      toast({
        title: 'Erro ao criar meta',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📚 Criar Nova Meta de Estudo</DialogTitle>
          <DialogDescription>
            Configure sua meta de estudo com revisões inteligentes usando FSRS
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título da Meta *</Label>
            <Input
              id="title"
              placeholder="Ex: Preparação para Prova de Física"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Período de Estudo */}
          <div className="space-y-1.5">
            <Label>Período de Estudo *</Label>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => setValue('date_range', range as any)}
            />
            {errors.date_range && (
              <p className="text-sm text-red-500">
                {errors.date_range.message || errors.date_range.from?.message || errors.date_range.to?.message}
              </p>
            )}

            {/* Overlap Alert */}
            {overlappingGoals.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-lg font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 mb-1">
                      ❌ Conflito detectado
                    </h4>
                    <p className="text-sm text-red-800 mb-2">
                      Você já tem {overlappingGoals.length} meta{overlappingGoals.length > 1 ? 's' : ''} ativa{overlappingGoals.length > 1 ? 's' : ''} nesse período:
                    </p>
                    <ul className="space-y-1 mb-3">
                      {overlappingGoals.map((goal) => (
                        <li key={goal.id} className="text-sm text-red-800 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                          <span className="font-medium">{goal.title}</span>
                          <span className="text-xs text-red-600">
                            ({format(new Date(goal.start_date), 'dd/MM')} até {format(new Date(goal.target_date), 'dd/MM')})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="bg-white border border-red-200 rounded p-3 space-y-2">
                      <p className="text-sm font-medium text-red-900">💡 O que fazer?</p>
                      <div className="space-y-1.5 text-sm text-red-800">
                        <p><strong>1.</strong> Adicione os novos tópicos à meta existente, ou</p>
                        <p><strong>2.</strong> Escolha outro período sem sobreposição, ou</p>
                        <p><strong>3.</strong> Arquive/conclua a meta antiga antes de criar nova</p>
                      </div>
                    </div>
                    <p className="text-xs text-red-700 mt-3 italic">
                      ℹ️ Uma meta representa seu objetivo de estudo em um período. Adicione todos os tópicos relacionados dentro da mesma meta para melhor organização.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Availability Preview */}
          {availabilityData && dateRange?.from && dateRange?.to && (
            <AvailabilityPreview
              key={availabilityRefreshTrigger}
              startDate={dateRange.from}
              endDate={dateRange.to}
              studyWeekends={studyWeekends}
              weekdayHours={availabilityData.weekdayHours}
              weekendHours={availabilityData.weekendHours}
              totalHours={availabilityData.totalHours}
              weekdayCount={availabilityData.weekdayCount}
              weekendCount={availabilityData.weekendCount}
              exceptions={availabilityData.exceptions}
              onAdjust={() => setShowAvailabilityDrawer(true)}
            />
          )}

          {/* Estudar Fins de Semana */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="study_weekends"
              checked={studyWeekends}
              onCheckedChange={(checked) => setValue('study_weekends', !!checked)}
            />
            <Label htmlFor="study_weekends" className="cursor-pointer">
              Estudar nos fins de semana (sábado e domingo)
            </Label>
          </div>

          {/* FSRS */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable_fsrs"
              checked={enableFSRS}
              onCheckedChange={(checked) => setValue('enable_fsrs', !!checked)}
            />
            <Label htmlFor="enable_fsrs" className="cursor-pointer">
              Habilitar FSRS (Revisões Inteligentes - Recomendado)
            </Label>
          </div>

          {/* Seleção de Subtópicos */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <Label>Subtópicos * (selecione os subtópicos para esta meta)</Label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 max-w-xs">
                <p className="text-xs text-blue-900">
                  💡 <strong>Dica:</strong> Adicione todos os tópicos relacionados ao seu objetivo de estudo nesta meta.
                </p>
              </div>
            </div>

            {/* SubtopicSelector */}
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <SubtopicSelector
                units={disciplinas}
                selectedSubtopics={selectedSubtopics}
                selectedTopics={selectedTopics}
                onToggleSubtopic={toggleSubtopic}
                onToggleTopic={toggleTopic}
                onToggleAllSubtopics={toggleAllSubtopics}
                isLoading={isLoadingData}
              />
            </div>

            <p className="text-sm text-gray-500">
              {selectedSubtopics.size + selectedTopics.size} item(s) selecionado(s)
              {selectedTopics.size > 0 && ` (${selectedTopics.size} tópico${selectedTopics.size > 1 ? 's' : ''}, ${selectedSubtopics.size} subtópico${selectedSubtopics.size > 1 ? 's' : ''})`}
            </p>
          </div>

          {/* Topic Conflicts Resolver - Aparece ACIMA do preview */}
          {(topicConflicts.length > 0 || manualItemsWithoutConflict.length > 0) && (
            <TopicConflictResolver
              conflicts={topicConflicts}
              manualItemsWithoutConflict={manualItemsWithoutConflict}
              onConflictResolutionChange={setTopicConflicts}
            />
          )}

          {/* Preview */}
          {preview && (
            <GoalPreviewSummary
              scenario={preview.scenario}
              isValid={preview.isValid}
              warnings={preview.warnings}
              conflicts={preview.conflicts || []}
              days={preview.days}
              itemCount={preview.itemCount}
              totalHours={preview.totalHours}
              totalMinutes={preview.totalMinutes}
              availableMinutes={preview.availableMinutes || 0}
              utilizationPercentage={preview.utilizationPercentage || 0}
              items={preview.items || []}
              manualItems={preview.manualItems || []}
              enableFSRS={enableFSRS}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isCreating ||
                selectedTopics.size + selectedSubtopics.size === 0 ||
                preview?.scenario === 'impossible' ||
                overlappingGoals.length > 0
              }
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Availability Adjustment Drawer */}
    {dateRange?.from && dateRange?.to && (
      <AvailabilityAdjustmentDrawer
        open={showAvailabilityDrawer}
        onOpenChange={setShowAvailabilityDrawer}
        startDate={dateRange.from}
        endDate={dateRange.to}
        studyWeekends={studyWeekends}
        config={config}
        getDailyHours={getDailyHours}
        getDayException={getDayException}
        setDayException={setDayException}
        removeDayException={removeDayException}
        onExceptionChange={() => {
          console.log('🟣 [onExceptionChange] CALLBACK FIRED');
          console.log('🟣 [onExceptionChange] Before increment:', availabilityRefreshTrigger);
          // Atualizar preview em tempo real quando exceção é salva/removida
          setAvailabilityRefreshTrigger(prev => {
            console.log('🟣 [onExceptionChange] Incrementing from', prev, 'to', prev + 1);
            return prev + 1;
          });
        }}
      />
    )}
  </>
  );
}

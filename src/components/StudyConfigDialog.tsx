import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStudyConfig, type UpdateStudyConfigParams } from '@/contexts/StudyConfigContext';
import { CalendarIcon, Clock, Target, Zap, ChevronLeft, ChevronRight, Check, Circle, Sun, Moon, Sunrise, CloudMoon, Gauge, Calendar as CalendarDaysIcon, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StudyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Section = 'essential' | 'times' | 'preferences' | 'goals' | 'exceptions';

const SECTIONS: { id: Section; label: string; optional: boolean }[] = [
  { id: 'essential', label: 'Essencial', optional: false },
  { id: 'times', label: 'Horários', optional: true },
  { id: 'preferences', label: 'Estilo', optional: true },
  { id: 'goals', label: 'Metas', optional: true },
  { id: 'exceptions', label: 'Exceções', optional: true },
];

export function StudyConfigDialog({ open, onOpenChange, onComplete }: StudyConfigDialogProps) {
  const { config, isLoading, updateConfig, markSectionCompleted, removeDayException, refreshConfig } = useStudyConfig();
  const [currentSection, setCurrentSection] = useState<Section>('essential');
  const [exceptionsRefresh, setExceptionsRefresh] = useState(0);

  // Form state
  const [weekdayHours, setWeekdayHours] = useState(3);
  const [weekendHours, setWeekendHours] = useState(5);
  const [studySaturday, setStudySaturday] = useState(true);
  const [studySunday, setStudySunday] = useState(true);
  const [sessionDuration, setSessionDuration] = useState<'short' | 'medium' | 'long'>('medium');

  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [avoidTimes, setAvoidTimes] = useState<string[]>([]);

  const [fsrsMode, setFsrsMode] = useState<'aggressive' | 'balanced' | 'spaced'>('balanced');

  const [hasExam, setHasExam] = useState(false);
  const [examDate, setExamDate] = useState<Date>();
  const [goalType, setGoalType] = useState<'exam' | 'continuous' | 'review'>('continuous');

  // Load config when available
  useEffect(() => {
    if (config) {
      setWeekdayHours(config.weekday_hours);
      setWeekendHours(config.weekend_hours);
      setStudySaturday(config.study_saturday);
      setStudySunday(config.study_sunday);

      // Map duration to category
      if (config.preferred_session_duration <= 45) setSessionDuration('short');
      else if (config.preferred_session_duration <= 90) setSessionDuration('medium');
      else setSessionDuration('long');

      setPreferredTimes(config.preferred_times || []);
      setAvoidTimes(config.avoid_times || []);
      setFsrsMode(config.fsrs_aggressiveness);
      setHasExam(config.has_exam);
      if (config.exam_date) setExamDate(new Date(config.exam_date));
      setGoalType(config.study_goal_type);
    }
  }, [config]);

  // Refresh exceptions when switching to exceptions tab
  useEffect(() => {
    if (currentSection === 'exceptions') {
      setExceptionsRefresh(prev => prev + 1);
    }
  }, [currentSection, config?.daily_exceptions]);

  const currentIndex = SECTIONS.findIndex(s => s.id === currentSection);
  const isFirstSection = currentIndex === 0;
  const isLastSection = currentIndex === SECTIONS.length - 1;
  const isEssential = currentSection === 'essential';

  const toggleTime = (time: string, type: 'prefer' | 'avoid') => {
    if (type === 'prefer') {
      setPreferredTimes(prev =>
        prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
      );
      // Remove from avoid if adding to prefer
      setAvoidTimes(prev => prev.filter(t => t !== time));
    } else {
      setAvoidTimes(prev =>
        prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
      );
      // Remove from prefer if adding to avoid
      setPreferredTimes(prev => prev.filter(t => t !== time));
    }
  };

  const handleSave = async () => {
    const durationMap = { short: 45, medium: 90, long: 120 };

    const updates: UpdateStudyConfigParams = {
      weekday_hours: weekdayHours,
      weekend_hours: weekendHours,
      study_saturday: studySaturday,
      study_sunday: studySunday,
      preferred_session_duration: durationMap[sessionDuration],
      preferred_times: preferredTimes,
      avoid_times: avoidTimes,
      fsrs_aggressiveness: fsrsMode,
      has_exam: hasExam,
      exam_date: examDate ? format(examDate, 'yyyy-MM-dd') : null,
      study_goal_type: goalType,
    };

    await updateConfig(updates);
    await markSectionCompleted(currentSection);

    onOpenChange(false);
    if (onComplete) onComplete();
  };

  const handleNext = async () => {
    // Save current section
    await markSectionCompleted(currentSection);

    if (isLastSection) {
      await handleSave();
    } else {
      setCurrentSection(SECTIONS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (!isFirstSection) {
      setCurrentSection(SECTIONS[currentIndex - 1].id);
    }
  };

  const getNextSectionLabel = () => {
    if (isLastSection) return 'Concluir';
    return `Próximo: ${SECTIONS[currentIndex + 1].label}`;
  };

  if (isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-normal">Perfil de Estudo</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Configure suas preferências para receber sugestões personalizadas
          </DialogDescription>
        </DialogHeader>

        {/* Progress Stepper - Minimalista */}
        <div className="mb-8 mt-6">
          <div className="relative">
            {/* Circles and Lines Row */}
            <div className="flex items-center mb-3">
              {SECTIONS.map((section, idx) => (
                <div key={section.id} className="flex items-center" style={{ flex: '1 1 0%' }}>
                  <div className="flex flex-col items-center" style={{ width: '32px', margin: '0 auto' }}>
                    <button
                      onClick={() => setCurrentSection(section.id)}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                        currentSection === section.id
                          ? "bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2"
                          : config?.metadata?.completedSections?.includes(section.id)
                          ? "bg-slate-700 text-white"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      )}
                    >
                      {config?.metadata?.completedSections?.includes(section.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        idx + 1
                      )}
                    </button>
                  </div>

                  {/* Connector Line */}
                  {idx < SECTIONS.length - 1 && (
                    <div className={cn(
                      "h-px flex-1 mx-2",
                      section.optional ? "border-t border-dashed border-slate-200" : "bg-slate-200"
                    )} />
                  )}
                </div>
              ))}
            </div>

            {/* Labels Row - Perfectly aligned */}
            <div className="flex">
              {SECTIONS.map((section, idx) => (
                <div key={`label-${section.id}`} className="text-center" style={{ flex: '1 1 0%' }}>
                  <span className={cn(
                    "text-xs transition-colors",
                    currentSection === section.id
                      ? "text-slate-900 font-medium"
                      : "text-slate-500"
                  )}>
                    {section.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status text - Discreto */}
          <p className="text-center text-xs text-slate-400 mt-3">
            Passo {currentIndex + 1} de {SECTIONS.length}
            {isEssential && <span className="ml-1">• Obrigatório</span>}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* SECTION 1: ESSENCIAL */}
          {currentSection === 'essential' && (
            <div className="space-y-8">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <Label className="text-base font-normal text-slate-900">Disponibilidade de Estudo</Label>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">Configure quanto tempo você dedica aos estudos</p>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Dias úteis (Seg-Sex)</span>
                        <span className="text-sm font-medium text-slate-900">{weekdayHours}h por dia</span>
                      </div>
                      <Slider
                        value={[weekdayHours]}
                        onValueChange={(v) => setWeekdayHours(v[0])}
                        min={0}
                        max={10}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Finais de semana</span>
                        <span className="text-sm font-medium text-slate-900">{weekendHours}h por dia</span>
                      </div>
                      <Slider
                        value={[weekendHours]}
                        onValueChange={(v) => setWeekendHours(v[0])}
                        min={0}
                        max={10}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          id="saturday"
                          checked={studySaturday}
                          onCheckedChange={(checked) => setStudySaturday(checked as boolean)}
                        />
                        <span className="text-sm text-slate-600">Sábados</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          id="sunday"
                          checked={studySunday}
                          onCheckedChange={(checked) => setStudySunday(checked as boolean)}
                        />
                        <span className="text-sm text-slate-600">Domingos</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-slate-500" />
                    <Label className="text-base font-normal text-slate-900">Duração das Sessões</Label>
                  </div>
                  <RadioGroup value={sessionDuration} onValueChange={(v) => setSessionDuration(v as any)} className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                      <RadioGroupItem value="short" id="short" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Curtas</div>
                        <div className="text-xs text-slate-500">30-45 minutos</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                      <RadioGroupItem value="medium" id="medium" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Médias</div>
                        <div className="text-xs text-slate-500">1-1.5 horas • Recomendado</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                      <RadioGroupItem value="long" id="long" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Longas</div>
                        <div className="text-xs text-slate-500">2+ horas</div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  As próximas etapas são opcionais e ajudarão a personalizar ainda mais sua experiência
                </p>
              </div>
            </div>
          )}

          {/* SECTION 2: HORÁRIOS */}
          {currentSection === 'times' && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <Label className="text-base font-normal text-slate-900">Horários Preferenciais</Label>
                </div>
                <p className="text-sm text-slate-500 mb-6">Indique quando você prefere ou evita estudar (opcional)</p>

                <div className="space-y-3">
                  {[
                    { id: 'morning', label: 'Manhã', time: '6h-12h', Icon: Sunrise },
                    { id: 'afternoon', label: 'Tarde', time: '12h-18h', Icon: Sun },
                    { id: 'night', label: 'Noite', time: '18h-23h', Icon: Moon },
                    { id: 'dawn', label: 'Madrugada', time: '23h-6h', Icon: CloudMoon },
                  ].map((time) => {
                    const isPreferred = preferredTimes.includes(time.id);
                    const isAvoided = avoidTimes.includes(time.id);

                    return (
                      <div key={time.id} className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                        <time.Icon className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900">{time.label}</div>
                          <div className="text-xs text-slate-500">{time.time}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => toggleTime(time.id, 'prefer')}
                            className={cn(
                              "px-3 py-1.5 text-xs rounded-md transition-colors border",
                              isPreferred
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            )}
                          >
                            Prefiro
                          </button>
                          <button
                            onClick={() => toggleTime(time.id, 'avoid')}
                            className={cn(
                              "px-3 py-1.5 text-xs rounded-md transition-colors border",
                              isAvoided
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            )}
                          >
                            Evito
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  Essas preferências nos ajudam a sugerir horários mais adequados ao seu perfil
                </p>
              </div>
            </div>
          )}

          {/* SECTION 3: PREFERÊNCIAS */}
          {currentSection === 'preferences' && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="w-4 h-4 text-slate-500" />
                  <Label className="text-base font-normal text-slate-900">Intervalo entre Revisões</Label>
                </div>
                <p className="text-sm text-slate-500 mb-6">Ajuste a frequência das revisões baseadas no algoritmo FSRS</p>

                <RadioGroup value={fsrsMode} onValueChange={(v) => setFsrsMode(v as any)} className="space-y-3">
                  <label className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                    fsrsMode === 'aggressive'
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}>
                    <RadioGroupItem value="aggressive" id="aggressive" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Agressivo</div>
                      <p className="text-xs text-slate-500 mt-1">Revisões mais frequentes • Ideal para preparação rápida</p>
                    </div>
                  </label>

                  <label className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                    fsrsMode === 'balanced'
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}>
                    <RadioGroupItem value="balanced" id="balanced" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">
                        Balanceado
                        <span className="ml-2 text-xs text-slate-500">• Recomendado</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Equilíbrio entre retenção e tempo investido</p>
                    </div>
                  </label>

                  <label className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                    fsrsMode === 'spaced'
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}>
                    <RadioGroupItem value="spaced" id="spaced" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Espaçado</div>
                      <p className="text-xs text-slate-500 mt-1">Revisões menos frequentes • Para aprendizado de longo prazo</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  O sistema aprenderá com seu desempenho e ajustará automaticamente as sugestões ao longo do tempo
                </p>
              </div>
            </div>
          )}

          {/* SECTION 4: METAS */}
          {currentSection === 'goals' && (
            <div className="space-y-8">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-slate-500" />
                    <Label className="text-base font-normal text-slate-900">Objetivos de Estudo</Label>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">Defina o tipo de objetivo para ajustar prioridades e intensidade</p>

                  <RadioGroup value={goalType} onValueChange={(v) => setGoalType(v as any)} className="space-y-3">
                    <label className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                      goalType === 'exam'
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    )}>
                      <RadioGroupItem value="exam" id="exam" className="mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Preparação para prova/concurso</div>
                        <p className="text-xs text-slate-500 mt-1">Estudo focado com prazo definido</p>
                      </div>
                    </label>

                    <label className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                      goalType === 'continuous'
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    )}>
                      <RadioGroupItem value="continuous" id="continuous" className="mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Aprendizado contínuo</div>
                        <p className="text-xs text-slate-500 mt-1">Sem prazo específico • Foco em longo prazo</p>
                      </div>
                    </label>

                    <label className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                      goalType === 'review'
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    )}>
                      <RadioGroupItem value="review" id="review" className="mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Revisão de conteúdo</div>
                        <p className="text-xs text-slate-500 mt-1">Reforçar conhecimentos já estudados</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {goalType === 'exam' && (
                  <div className="pt-2">
                    <div className="h-px bg-slate-100 mb-6" />
                    <Label className="text-sm font-normal text-slate-700">Data da prova</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal mt-3 border-slate-200 hover:border-slate-300",
                            !examDate && "text-slate-500"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                          {examDate ? format(examDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={examDate}
                          onSelect={setExamDate}
                          locale={ptBR}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  Seus objetivos ajudam o sistema a priorizar conteúdos e ajustar a intensidade das revisões
                </p>
              </div>
            </div>
          )}

          {/* SECTION 5: EXCEÇÕES */}
          {currentSection === 'exceptions' && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDaysIcon className="w-4 h-4 text-slate-500" />
                  <Label className="text-base font-normal text-slate-900">Exceções de Disponibilidade</Label>
                </div>
                <p className="text-sm text-slate-500 mb-6">Gerencie dias com disponibilidade personalizada</p>

                {config?.daily_exceptions && Object.keys(config.daily_exceptions).length > 0 ? (
                  <div key={exceptionsRefresh} className="space-y-3">
                    {Object.entries(config.daily_exceptions)
                      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                      .map(([dateStr, exception]) => {
                        // Parse da data em formato local (yyyy-MM-dd) sem conversão UTC
                        const [year, month, day] = dateStr.split('-').map(Number);
                        const localDate = new Date(year, month - 1, day);

                        return (
                        <div
                          key={dateStr}
                          className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {format(localDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500">{dateStr}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs font-medium text-blue-600">{exception.hours}h 📌</span>
                              {exception.reason && (
                                <>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs text-slate-600">{exception.reason}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                              onClick={() => {
                                // TODO: Open edit modal
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                              onClick={() => removeDayException(localDate)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                    <CalendarDaysIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 mb-1">Nenhuma exceção configurada</p>
                    <p className="text-xs text-slate-500">Todos os dias seguem a disponibilidade padrão</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-3">
                  💡 Para adicionar ou editar exceções, ajuste diretamente no calendário (clique direito no dia)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                  onClick={() => {
                    onOpenChange(false);
                    // TODO: Navigate to calendar
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Calendário
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {!isEssential && "Você pode pular as próximas etapas"}
          </div>
          <div className="flex gap-2">
            {!isFirstSection && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            <Button
              onClick={handleSave}
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            >
              Salvar
            </Button>
            <Button
              onClick={handleNext}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {getNextSectionLabel()}
              {!isLastSection && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { ReactNode, useState, useEffect, useRef } from 'react';
import {
  Flag,
  Clock,
  Hourglass,
  CheckCircle2,
  RotateCw,
  Lock,
  Rocket,
  Play,
  SkipForward,
  Check,
  Hash,
  Tag,
  Goal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { useCronogramaActivo } from '../hooks/useCronogramaActivo';
import { useWeekTasks, type WeekTask } from '../hooks/useWeekTasks';
import { ScheduleItemTitle } from '@/components/cronograma/ScheduleItemTitle';
import type { WeeklyStats } from '@/types/cronograma';

type CronogramaStatus = 'normal' | 'atencao' | 'urgente';

interface CronogramaSheetProps {
  children: ReactNode;
  devStatus?: CronogramaStatus;
  devSetStatus?: (s: CronogramaStatus) => void;
  enableShortcut?: boolean;
}

type Task = WeekTask;

// Placeholder values for weeks without weekly_stats persistidas.
// Substituídos pelos números reais quando o hook retorna stats.
// TODO: quando houver consulta multi-semana de weekly_stats, derivar mapas reais aqui.
const FALLBACK_PAST_COMPLETION = 1;
const FALLBACK_DESEMPENHO = 0;

function getWeekCompletion(
  idx: number,
  currentWeek: number,
  currentProgress: number,
): number {
  if (idx < currentWeek - 1) return FALLBACK_PAST_COMPLETION;
  if (idx === currentWeek - 1) return currentProgress;
  return 0;
}

function formatMinutes(min: number): string {
  if (min <= 0) return '00h00m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m`;
}

function getWeekMetrics(stats: WeeklyStats | null) {
  if (!stats) {
    return {
      desempenho: FALLBACK_DESEMPENHO,
      horas: '—',
      questoes: '—',
      media: '—',
    };
  }
  const minutos = stats.minutes_actual ?? 0;
  const mediaDiaria = Math.round(minutos / 7);
  return {
    desempenho: stats.desempenho_pct ?? FALLBACK_DESEMPENHO,
    horas: formatMinutes(minutos),
    questoes: String(stats.questoes_total ?? 0),
    media: formatMinutes(mediaDiaria),
  };
}

function getWeekStatusLabel(weekIdx0: number, completion: number, currentWeek: number) {
  if (weekIdx0 === currentWeek - 1) return { label: 'atual', tone: 'emerald' as const };
  if (weekIdx0 > currentWeek - 1) return { label: 'futura', tone: 'slate' as const };
  if (completion >= 0.95) return { label: 'concluída', tone: 'emerald' as const };
  return { label: 'com pendências', tone: 'amber' as const };
}

function WeekTimeline({
  selectedWeek,
  setSelectedWeek,
  showHistory,
  setShowHistory,
  currentWeek,
  totalWeeks,
  currentWeekProgress,
  startDate,
}: {
  selectedWeek: number;
  setSelectedWeek: (w: number) => void;
  showHistory: boolean;
  setShowHistory: (b: boolean) => void;
  currentWeek: number;
  totalWeeks: number;
  currentWeekProgress: number;
  startDate: Date | null;
}) {
  // TODO: derivar `completedCount` real de uma consulta multi-semana de weekly_stats.
  const completedCount = Math.max(0, currentWeek - 1);

  const WINDOW = 7;
  const currentIdx = currentWeek - 1;
  let start = Math.max(0, currentIdx - 3);
  let end = Math.min(totalWeeks, start + WINDOW);
  if (end - start < WINDOW) start = Math.max(0, end - WINDOW);
  const visibleIndices = Array.from({ length: end - start }, (_, i) => start + i);

  const r = 7;
  const c = 2 * Math.PI * r;

  return (
    <div className="px-7 pt-5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-400 shrink-0">
          Cronograma
        </span>

        {start > 0 && (
          <span className="text-slate-600 text-[10px] tabular-nums">…</span>
        )}

        <div className="flex items-center gap-2">
          {visibleIndices.map((i) => {
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;
            const isSelected = i === selectedWeek - 1;
            const completion = getWeekCompletion(i, currentWeek, currentWeekProgress);
            const fullyCompleted = isPast && completion >= 0.95;
            const partialPast = isPast && completion < 0.95;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedWeek(i + 1)}
                className="relative h-[20px] w-[20px] shrink-0 hover:scale-110 transition-transform"
                title={`Semana ${i + 1}${isPast ? ` · ${Math.round(completion * 100)}% concluída` : isCurrent ? ' (atual)' : ' (futura)'}`}
              >
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full bg-slate-300 opacity-25 animate-ping" />
                )}
                {isSelected && !isCurrent && (
                  <span
                    className="absolute -inset-[3px] rounded-full pointer-events-none"
                    style={{
                      border: '1.5px solid rgba(96,165,250,0.7)',
                      boxShadow: '0 0 6px rgba(96,165,250,0.5)',
                    }}
                  />
                )}
                {partialPast && (
                  <span
                    className="absolute -inset-[2px] rounded-full pointer-events-none"
                    style={{
                      border: '1px solid rgba(245,158,11,0.5)',
                      boxShadow: '0 0 5px rgba(245,158,11,0.35)',
                    }}
                  />
                )}
                <svg viewBox="0 0 20 20" className="relative h-full w-full -rotate-90">
                  <circle
                    cx="10"
                    cy="10"
                    r={r}
                    fill="none"
                    stroke={
                      isCurrent
                        ? 'rgba(226,232,240,0.2)'
                        : isPast
                        ? partialPast
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(148,163,184,0.15)'
                        : 'rgba(71,85,105,0.4)'
                    }
                    strokeWidth="1.8"
                  />
                  {(isPast || isCurrent) && completion > 0 && (
                    <circle
                      cx="10"
                      cy="10"
                      r={r}
                      fill="none"
                      stroke={
                        isCurrent ? '#e2e8f0' : partialPast ? '#f59e0b' : '#94a3b8'
                      }
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={c * (1 - completion)}
                      style={{
                        filter: isCurrent
                          ? 'drop-shadow(0 0 5px rgba(226,232,240,0.55))'
                          : partialPast
                          ? 'drop-shadow(0 0 3px rgba(245,158,11,0.4))'
                          : undefined,
                        transition: 'stroke-dashoffset 0.6s',
                      }}
                    />
                  )}
                </svg>
                {fullyCompleted && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-2 w-2 text-slate-300" strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {end < totalWeeks && (
          <span className="text-slate-600 text-[10px] tabular-nums">…</span>
        )}

        <span className="text-[10px] text-slate-400 ml-2 shrink-0 leading-tight">
          Semana{' '}
          <span className="text-slate-100 font-semibold tabular-nums">
            {currentWeek}
          </span>
          <span className="text-slate-500"> de </span>
          <span className="text-slate-300 tabular-nums">{totalWeeks}</span>
          <span className="text-slate-500 mx-1">·</span>
          <span className="text-slate-200 font-semibold tabular-nums">{completedCount}</span> concluídas
        </span>

        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-blue-300 hover:text-blue-200 transition shrink-0"
        >
          {showHistory ? 'Ocultar histórico' : 'Ver histórico'}
          <span
            className="transition-transform"
            style={{ transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▾
          </span>
        </button>
      </div>

      {showHistory && (
        <div className="mt-3 rounded-xl border border-slate-800/70 overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(30,41,59,0.45) 0%, rgba(15,23,42,0.35) 100%)',
          }}
        >
          <div className="grid grid-cols-[60px_120px_1fr_90px_60px_28px] gap-x-3 px-4 py-2 text-[9px] tracking-[0.12em] uppercase text-slate-500 font-semibold border-b border-slate-800">
            <div>Semana</div>
            <div>Período</div>
            <div>Conclusão</div>
            <div>Desempenho</div>
            <div className="text-center">Status</div>
            <div />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {Array.from({ length: totalWeeks }).map((_, i) => {
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isFuture = i > currentIdx;
              const isSelected = i === selectedWeek - 1;
              const completion = getWeekCompletion(i, currentWeek, currentWeekProgress);
              // TODO: substituir por consulta multi-semana de weekly_stats.desempenho_pct.
              const desempenho: number | undefined = undefined;
              const pct = completion * 100;
              const fully = isPast && completion >= 0.95;
              const partial = isPast && completion < 0.95;
              const journeyStart = startDate ?? new Date();
              const baseDate = new Date(journeyStart);
              baseDate.setDate(journeyStart.getDate() + i * 7);
              const endDate = new Date(baseDate);
              endDate.setDate(baseDate.getDate() + 6);
              const fmt = (d: Date) =>
                `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedWeek(i + 1)}
                  className={`w-full text-left grid grid-cols-[60px_120px_1fr_90px_60px_28px] gap-x-3 px-4 py-2 items-center text-[11px] border-b border-slate-800/40 hover:bg-slate-800/40 transition ${
                    isSelected ? 'bg-slate-800/60' : ''
                  }`}
                >
                  <div className="font-semibold text-slate-100 tabular-nums">
                    {i + 1}
                    {isCurrent && (
                      <span className="ml-1 text-[8px] text-emerald-400 font-medium">
                        ATUAL
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 tabular-nums text-[10px]">
                    {fmt(baseDate)} – {fmt(endDate)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: partial
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : isFuture
                            ? 'transparent'
                            : 'linear-gradient(90deg, #10b981, #34d399)',
                          boxShadow:
                            !isFuture && pct > 0
                              ? `0 0 4px ${partial ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`
                              : undefined,
                        }}
                      />
                    </div>
                    <span className="tabular-nums text-[10px] text-slate-400 w-8 text-right">
                      {isFuture ? '—' : `${Math.round(pct)}%`}
                    </span>
                  </div>
                  <div
                    className={`tabular-nums text-[10px] ${
                      isFuture
                        ? 'text-slate-600'
                        : partial
                        ? 'text-amber-400 font-semibold'
                        : 'text-emerald-400 font-semibold'
                    }`}
                  >
                    {desempenho !== undefined ? `${desempenho}%` : '—'}
                  </div>
                  <div className="flex justify-center">
                    {fully && <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />}
                    {partial && (
                      <span className="h-2 w-2 rounded-full bg-amber-400" style={{ boxShadow: '0 0 4px rgba(245,158,11,0.6)' }} />
                    )}
                    {isCurrent && (
                      <span className="relative flex items-center justify-center">
                        <span className="absolute h-2 w-2 rounded-full bg-emerald-400 opacity-50 animate-ping" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                    )}
                    {isFuture && <span className="h-2 w-2 rounded-full border border-slate-600" />}
                  </div>
                  <div className="text-slate-500 text-[14px] leading-none">›</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = value;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

type HeroTone = 'emerald' | 'blue' | 'amber' | 'slate';

const HERO_TONES: Record<HeroTone, {
  bg: string;
  border: string;
  shadow: string;
  glow: string;
  eyebrow: string;
  number: string;
  trackColor: string;
  ringStop0: string;
  ringStop1: string;
  ringFilter: string;
  iconColor: string;
  footerBg: string;
  footerBorder: string;
  deltaColor: string;
}> = {
  emerald: {
    bg: 'linear-gradient(160deg, rgba(16,185,129,0.18) 0%, rgba(6,95,70,0.22) 100%)',
    border: 'rgba(16,185,129,0.22)',
    shadow: '0 8px 24px -16px rgba(16,185,129,0.35)',
    glow: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 70%)',
    eyebrow: 'text-emerald-200/80',
    number: 'text-emerald-100',
    trackColor: 'rgba(16,185,129,0.18)',
    ringStop0: '#a7f3d0',
    ringStop1: '#10b981',
    ringFilter: 'drop-shadow(0 0 5px rgba(16,185,129,0.45))',
    iconColor: 'text-emerald-200',
    footerBg: 'rgba(16,185,129,0.05)',
    footerBorder: 'rgba(16,185,129,0.15)',
    deltaColor: 'text-emerald-300',
  },
  blue: {
    bg: 'linear-gradient(160deg, rgba(59,130,246,0.18) 0%, rgba(30,58,138,0.22) 100%)',
    border: 'rgba(96,165,250,0.22)',
    shadow: '0 8px 24px -16px rgba(59,130,246,0.35)',
    glow: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 70%)',
    eyebrow: 'text-blue-200/80',
    number: 'text-blue-100',
    trackColor: 'rgba(59,130,246,0.18)',
    ringStop0: '#bfdbfe',
    ringStop1: '#3b82f6',
    ringFilter: 'drop-shadow(0 0 5px rgba(59,130,246,0.45))',
    iconColor: 'text-blue-200',
    footerBg: 'rgba(59,130,246,0.05)',
    footerBorder: 'rgba(59,130,246,0.15)',
    deltaColor: 'text-blue-300',
  },
  amber: {
    bg: 'linear-gradient(160deg, rgba(245,158,11,0.18) 0%, rgba(120,53,15,0.22) 100%)',
    border: 'rgba(251,191,36,0.22)',
    shadow: '0 8px 24px -16px rgba(245,158,11,0.35)',
    glow: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0) 70%)',
    eyebrow: 'text-amber-200/80',
    number: 'text-amber-100',
    trackColor: 'rgba(245,158,11,0.18)',
    ringStop0: '#fde68a',
    ringStop1: '#f59e0b',
    ringFilter: 'drop-shadow(0 0 5px rgba(245,158,11,0.45))',
    iconColor: 'text-amber-200',
    footerBg: 'rgba(245,158,11,0.05)',
    footerBorder: 'rgba(245,158,11,0.15)',
    deltaColor: 'text-amber-300',
  },
  slate: {
    bg: 'linear-gradient(160deg, rgba(100,116,139,0.15) 0%, rgba(51,65,85,0.2) 100%)',
    border: 'rgba(148,163,184,0.18)',
    shadow: '0 8px 24px -16px rgba(100,116,139,0.2)',
    glow: 'radial-gradient(circle, rgba(148,163,184,0.1) 0%, rgba(148,163,184,0) 70%)',
    eyebrow: 'text-slate-400',
    number: 'text-slate-300',
    trackColor: 'rgba(148,163,184,0.18)',
    ringStop0: '#cbd5e1',
    ringStop1: '#94a3b8',
    ringFilter: 'none',
    iconColor: 'text-slate-400',
    footerBg: 'rgba(148,163,184,0.05)',
    footerBorder: 'rgba(148,163,184,0.15)',
    deltaColor: 'text-slate-400',
  },
};

function DesempenhoHero({
  open,
  value,
  archive,
  tone = 'emerald',
}: {
  open: boolean;
  value: number;
  archive?: boolean;
  tone?: HeroTone;
}) {
  const animated = useCountUp(open ? value : 0, 900);
  const r = 25;
  const c = 2 * Math.PI * r;
  const pct = animated / 100;
  const t = HERO_TONES[tone];
  const gradId = `ring-grad-${tone}`;

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        boxShadow: t.shadow,
      }}
    >
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full"
        style={{ background: t.glow }}
      />

      <div className="relative flex-1 px-5 py-3">
        <div className={`text-[10px] font-semibold leading-tight uppercase tracking-[0.08em] ${t.eyebrow}`}>
          Desempenho atingido
        </div>

        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div>
            <div
              className={`text-[32px] font-bold leading-none tabular-nums ${t.number}`}
              style={{ letterSpacing: '-0.025em' }}
            >
              {animated.toFixed(1).replace('.', ',')}%
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400">
              Média semanal nas atividades concluídas
            </div>
          </div>

          <div className="relative h-[58px] w-[58px] shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 58 58">
              <circle
                cx="29"
                cy="29"
                r={r}
                fill="none"
                stroke={t.trackColor}
                strokeWidth="3.5"
              />
              <circle
                cx="29"
                cy="29"
                r={r}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct)}
                style={{ filter: t.ringFilter }}
              />
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={t.ringStop0} />
                  <stop offset="100%" stopColor={t.ringStop1} />
                </linearGradient>
              </defs>
            </svg>
            <Goal
              className={`absolute inset-0 m-auto h-4 w-4 ${t.iconColor}`}
              strokeWidth={2}
            />
          </div>
        </div>
      </div>

      {/* Minimal footer */}
      <div
        className="relative px-5 py-2 flex items-center justify-between text-[10px] border-t"
        style={{ borderColor: t.footerBorder, background: t.footerBg }}
      >
        <span className="text-slate-400">
          {archive ? 'Histórico desta semana' : 'Comparado à última semana'}
        </span>
        {!archive && (
          <span className={`font-semibold tabular-nums ${t.deltaColor}`}>↑ 13,6</span>
        )}
      </div>
    </div>
  );
}

export function CronogramaSheet({
  children,
  devStatus,
  devSetStatus,
  enableShortcut = false,
}: CronogramaSheetProps) {
  const [open, setOpen] = useState(false);
  const { plano, totalWeeks, currentWeek, currentWeekProgress, startDate } = useCronogramaActivo();

  useEffect(() => {
    if (!enableShortcut) return;
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Alt + C (Option + C no Mac) — use e.code to ignore layout-specific output (e.g., Option+C = ç no Mac)
      if (e.code !== 'KeyC') return;
      if (!e.altKey) return;
      if (e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen((o) => !o);
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [enableShortcut]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  // Sync selected week with current week when journey config loads
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);
  const viewingPast = selectedWeek !== currentWeek;
  const selectedWeekIdx = selectedWeek - 1;

  const { tasks, stats, isLoading: tasksLoading, toggleDone } = useWeekTasks(
    plano?.id,
    selectedWeek,
  );

  // Completion: usa completion_pct real quando há stats da semana selecionada,
  // senão cai no derivado do tempo decorrido / fallback.
  const selectedCompletion =
    stats?.completion_pct != null
      ? stats.completion_pct / 100
      : getWeekCompletion(selectedWeekIdx, currentWeek, currentWeekProgress);

  const selectedMetrics = getWeekMetrics(stats);
  const selectedWeekStatus = getWeekStatusLabel(
    selectedWeekIdx,
    selectedCompletion,
    currentWeek,
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="!max-w-none w-[min(1000px,95vw)] p-0 border-0 text-slate-100 overflow-y-auto"
        style={{
          background:
            'linear-gradient(160deg, #1a1f3a 0%, #131a30 35%, #0f172a 100%)',
        }}
      >
        {devSetStatus && (
          <div className="px-7 pt-5 flex items-center gap-2 text-[10px]">
            <span className="text-amber-400/70 font-semibold tracking-wider uppercase">
              DEV · estado:
            </span>
            {(['normal', 'atencao', 'urgente'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => devSetStatus(s)}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium capitalize transition ${
                  devStatus === s
                    ? s === 'normal'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : s === 'atencao'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-red-500/20 border-red-400 text-red-200'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <WeekTimeline
          selectedWeek={selectedWeek}
          setSelectedWeek={setSelectedWeek}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          currentWeek={currentWeek}
          totalWeeks={totalWeeks}
          currentWeekProgress={currentWeekProgress}
          startDate={startDate}
        />

        <div className="px-7 mt-3 h-[36px]">
          <div
            className={`rounded-lg px-4 py-2 flex items-center justify-between border transition-opacity duration-200 ${
              viewingPast ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{
              background: 'rgba(96,165,250,0.08)',
              borderColor: 'rgba(96,165,250,0.25)',
            }}
          >
            <span className="text-[11px] text-blue-200">
              Visualizando: <span className="font-semibold">Semana {selectedWeek}</span>
              {selectedWeek < currentWeek && (
                <span className="text-blue-300/70 ml-1">
                  · {selectedCompletion >= 0.95 ? 'concluída' : 'com pendências'}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setSelectedWeek(currentWeek)}
              className="text-[11px] font-medium text-blue-300 hover:text-blue-100 transition inline-flex items-center gap-1"
            >
              ← Voltar para semana atual
            </button>
          </div>
        </div>

        <div className="px-7 pt-14 pb-4 flex items-start gap-5">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase font-semibold">
                <Flag
                  className={`h-3.5 w-3.5 ${
                    viewingPast
                      ? selectedWeekStatus.tone === 'amber'
                        ? 'text-amber-400'
                        : 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                  strokeWidth={1.8}
                />
                <span className="text-slate-400">
                  {viewingPast ? `Semana ${selectedWeek}` : 'Semana atual'}
                </span>
                {viewingPast && (
                  <span
                    className={`text-[9px] tracking-wider ${
                      selectedWeekStatus.tone === 'amber'
                        ? 'text-amber-400/90'
                        : 'text-slate-500'
                    }`}
                  >
                    · {selectedWeekStatus.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[12px] text-slate-500">
                <span>
                  <span className="text-slate-200 font-semibold">
                    {new Set(tasks.map((t) => t.disc).filter((d) => d && d !== '—')).size || '—'}
                  </span>{' '}
                  disciplinas
                </span>
                <span className="text-slate-700">·</span>
                <span>
                  <span className="text-slate-200 font-semibold">{tasks.length || '—'}</span>{' '}
                  atividades
                </span>
                <span className="text-slate-700">·</span>
                <span>
                  Iniciada{' '}
                  <span className="text-slate-200 tabular-nums">
                    {startDate
                      ? `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}`
                      : '—'}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[13px] text-slate-200 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} />
                <span className="tabular-nums font-semibold">{tasks.filter((t) => t.done).length}</span>
                <span className="text-slate-500 text-[12px]">de {tasks.length || '—'}</span>
              </div>

              <div className="flex-1 relative">
                <div className="h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${selectedCompletion * 100}%`,
                      background:
                        selectedWeekStatus.tone === 'amber'
                          ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
                          : 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)',
                      boxShadow:
                        selectedWeekStatus.tone === 'amber'
                          ? '0 0 8px rgba(245,158,11,0.6)'
                          : '0 0 8px rgba(74,222,128,0.6)',
                    }}
                  />
                </div>
                {selectedWeek === currentWeek && (
                  <Rocket
                    className="absolute h-4 w-4 text-emerald-300 -translate-y-1/2"
                    strokeWidth={2}
                    style={{
                      top: '50%',
                      left: `calc(${selectedCompletion * 100}% - 8px)`,
                      filter: 'drop-shadow(0 0 5px rgba(74,222,128,0.7))',
                    }}
                  />
                )}
              </div>

              <span className="text-[12px] italic text-slate-500 shrink-0">
                + <span className="text-slate-200 tabular-nums font-semibold not-italic">25</span> reforços
              </span>
            </div>
          </div>

          {viewingPast ? (
            <div
              className="w-[180px] shrink-0 rounded-2xl px-4 py-4 border text-center flex flex-col items-center justify-center gap-2"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,41,59,0.4) 0%, rgba(15,23,42,0.3) 100%)',
                borderColor: 'rgba(96,165,250,0.25)',
              }}
            >
              <div className="text-[10px] tracking-[0.12em] uppercase text-blue-300 font-semibold">
                Navegar histórico
              </div>
              <div className="flex items-center gap-2 w-full justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                  disabled={selectedWeek <= 1}
                  className="h-7 w-7 rounded-full flex items-center justify-center bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <span className="text-[12px] tabular-nums text-slate-200">
                  Semana {selectedWeek}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedWeek(Math.min(totalWeeks, selectedWeek + 1))}
                  disabled={selectedWeek >= totalWeeks}
                  className="h-7 w-7 rounded-full flex items-center justify-center bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                  aria-label="Próxima semana"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWeek(currentWeek)}
                className="text-[10px] font-medium text-blue-300 hover:text-blue-100 transition"
              >
                Voltar para atual
              </button>
            </div>
          ) : (
            <div
              className="shrink-0 min-w-[250px] rounded-xl px-4 py-2 border"
              style={{
                background: 'rgba(148,163,184,0.04)',
                borderColor: 'rgba(148,163,184,0.15)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase font-semibold text-slate-400">
                  <Lock className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.8} />
                  Próxima semana
                </div>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:bg-slate-700/60 hover:text-white transition"
                  aria-label="Atualizar"
                >
                  <RotateCw className="h-2.5 w-2.5" strokeWidth={2} />
                </button>
              </div>

              <div className="mt-1 flex items-center gap-3 text-[13px]">
                <span className="text-slate-200 font-medium">
                  Semana {currentWeek + 1}
                </span>
                <span className="text-slate-700">·</span>
                <span className="text-slate-500 text-[12px]">
                  Libera em{' '}
                  <span className="text-slate-300 font-semibold tabular-nums">
                    {startDate
                      ? (() => {
                          const next = new Date(startDate);
                          next.setDate(startDate.getDate() + currentWeek * 7);
                          return `${String(next.getDate()).padStart(2, '0')}/${String(next.getMonth() + 1).padStart(2, '0')}`;
                        })()
                      : '—'}
                  </span>
                </span>
              </div>

              <div className="mt-1 text-[10px] italic text-slate-500 leading-tight">
                Finalize ou ignore as atividades da semana atual para desbloquear.
              </div>
            </div>
          )}
        </div>

        <div className="px-7 grid grid-cols-[1.4fr_2.6fr] gap-4">
          <DesempenhoHero
            open={open}
            value={selectedMetrics.desempenho}
            archive={viewingPast}
            tone={
              !viewingPast
                ? 'emerald'
                : selectedWeek > currentWeek
                ? 'slate'
                : selectedWeekStatus.tone === 'amber'
                ? 'amber'
                : 'blue'
            }
          />

          {/* Stats line: 3 métricas minimalistas */}
          <div
            className={`rounded-2xl px-5 py-3 flex items-stretch divide-x divide-slate-800/70 border border-slate-800/60 transition-opacity ${
              viewingPast ? 'opacity-80' : ''
            }`}
            style={{
              background:
                'linear-gradient(180deg, rgba(30,41,59,0.45) 0%, rgba(15,23,42,0.35) 100%)',
            }}
          >
            {[
              { icon: Clock, label: 'Horas estudadas', value: selectedMetrics.horas },
              { icon: CheckCircle2, label: 'Questões resolvidas', value: selectedMetrics.questoes },
              { icon: Hourglass, label: 'Média diária', value: selectedMetrics.media },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className={`flex-1 flex flex-col justify-center ${
                    i === 0 ? 'pr-5' : 'px-5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-400">
                    <Icon className="h-3 w-3" strokeWidth={2} />
                    {m.label}
                  </div>
                  <div
                    className="mt-1.5 text-[20px] font-bold leading-none tabular-nums text-slate-100"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {m.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-7 mt-5 flex items-center gap-5 border-b border-slate-800">
          <button type="button" className="relative pb-2 text-[13px] font-semibold text-slate-100">
            Atividades da semana
            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 tabular-nums">
              32
            </span>
            <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-blue-500" />
          </button>
          <button
            type="button"
            className="pb-2 text-[13px] font-medium text-slate-500 hover:text-slate-300 transition"
          >
            Reforços sugeridos
            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-400 tabular-nums">
              0
            </span>
          </button>
        </div>

        <div className="px-7 pb-8 pt-3">
          <div className="grid grid-cols-[28px_1.4fr_0.9fr_2.5fr_1fr_0.7fr_0.9fr] gap-x-3 px-2 py-2 text-[10px] tracking-[0.12em] uppercase text-slate-500 font-semibold border-b border-slate-800">
            <div>#</div>
            <div>Disciplina</div>
            <div>Tipo</div>
            <div>Título</div>
            <div className="text-center">Relevância</div>
            <div>Tempo</div>
            <div>Desempenho</div>
          </div>
          {tasks.length === 0 && (
            <div className="py-10 text-center text-[12px] text-slate-500 italic">
              {tasksLoading
                ? 'Carregando atividades…'
                : 'Nenhuma atividade agendada para esta semana.'}
            </div>
          )}
          {tasks.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(row);
                }
              }}
              className="cursor-pointer w-full text-left grid grid-cols-[28px_1.4fr_0.9fr_2.5fr_1fr_0.7fr_0.9fr] gap-x-3 px-2 py-2.5 items-center text-[12px] border-b border-slate-800/60 hover:bg-slate-800/40 active:bg-slate-800/60 transition"
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDone(row.id);
                  }}
                  aria-label={row.done ? 'Desmarcar concluída' : 'Marcar como concluída'}
                  className={`h-3.5 w-3.5 rounded-full flex items-center justify-center transition hover:scale-110 ${
                    row.done
                      ? 'bg-emerald-400 border border-emerald-300'
                      : 'bg-transparent border border-slate-600 hover:border-slate-400'
                  }`}
                  style={row.done ? { boxShadow: '0 0 6px rgba(74,222,128,0.7)' } : undefined}
                >
                  {row.done && <Check className="h-2 w-2 text-emerald-900" strokeWidth={3.5} />}
                </button>
              </div>
              <div className="text-slate-100">{row.disc}</div>
              <div className="text-slate-400">{row.tipo}</div>
              <div className="truncate">
                <ScheduleItemTitle
                  conceitoPai={row.conceitoPai}
                  nome={row.titulo}
                  size="sm"
                  className={row.done ? 'opacity-50' : undefined}
                />
              </div>
              {(() => {
                const heights = [4, 6, 8, 10, 12];
                const activeColor =
                  row.rel >= 4 ? '#ef4444' : row.rel >= 3 ? '#f97316' : '#f59e0b';
                const glowRgb =
                  row.rel >= 4 ? '239,68,68' : row.rel >= 3 ? '249,115,22' : '251,191,36';
                return (
                  <div
                    className="flex items-end justify-center gap-[2px] h-[12px]"
                    title={`Relevância ${row.rel}/5`}
                  >
                    {heights.map((h, i) => {
                      const active = i < row.rel;
                      return (
                        <span
                          key={i}
                          style={{
                            width: '2.5px',
                            height: `${h}px`,
                            borderRadius: '1px',
                            background: active ? activeColor : 'rgba(71,85,105,0.5)',
                            boxShadow:
                              active && row.rel >= 3
                                ? `0 0 ${3 + i * 0.6}px rgba(${glowRgb}, 0.65)`
                                : undefined,
                            transition: 'all 0.2s',
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })()}
              <div className="text-slate-400 tabular-nums">{row.time}</div>
              <div
                className={`tabular-nums ${
                  row.desemp === '—' ? 'text-slate-500' : 'text-emerald-400 font-semibold'
                }`}
              >
                {row.desemp}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>

      {/* Task detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-xl border border-slate-200 bg-white">
              <DialogHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      selected.tipo === 'Teoria'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <Tag className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {selected.tipo}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 tabular-nums">
                    <Hash className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {selected.code}
                  </span>
                  {selected.done && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      Concluída
                    </span>
                  )}
                </div>
                <DialogTitle asChild>
                  <ScheduleItemTitle
                    conceitoPai={selected.conceitoPai}
                    nome={selected.titulo}
                    size="lg"
                    className="text-slate-900"
                  />
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-[12px]">
                  {selected.disc}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="text-[9px] tracking-[0.12em] uppercase text-slate-400 font-semibold">
                    Relevância
                  </div>
                  <div className="mt-1.5 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`text-[14px] ${
                          i < selected.rel ? 'text-amber-500' : 'text-slate-200'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="text-[9px] tracking-[0.12em] uppercase text-slate-400 font-semibold">
                    Tempo
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[14px] font-semibold text-slate-900 tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.8} />
                    {selected.time}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="text-[9px] tracking-[0.12em] uppercase text-slate-400 font-semibold">
                    Desempenho
                  </div>
                  <div
                    className={`mt-1.5 text-[14px] font-semibold tabular-nums ${
                      selected.desemp === '—' ? 'text-slate-400' : 'text-emerald-600'
                    }`}
                  >
                    {selected.desemp}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600 leading-relaxed">
                <span className="italic">
                  {selected.done
                    ? 'Você já concluiu esta atividade. Pode revisá-la quando quiser.'
                    : 'Esta atividade ainda não foi iniciada. Comece quando estiver pronto.'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                {!selected.done && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    <SkipForward className="h-3.5 w-3.5" strokeWidth={2} />
                    Pular
                  </button>
                )}
                {!selected.done && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleDone(selected.id);
                      setSelected({ ...selected, done: true });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Marcar como concluída
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
                >
                  <Play className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {selected.done ? 'Revisar' : 'Iniciar'}
                </button>
              </div>
          </DialogContent>
        )}
      </Dialog>
    </Sheet>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Clock, Sparkles, FileText, CreditCard, HelpCircle, Scale, NotebookPen,
} from 'lucide-react';
import { Bar as BarLocal, BarChart as BarChartLocal, CartesianGrid as CartesianGridLocal, XAxis as XAxisLocal } from 'recharts';
import {
  ChartContainer as ChartContainerLocal,
  ChartTooltip as ChartTooltipLocal,
  ChartTooltipContent as ChartTooltipContentLocal,
} from '@/components/ui/chart';
import { DesempenhoChart } from '@/components/DesempenhoChart';
import { StudyCompletionForm, type CompletionData } from './StudyCompletionForm';
import { useStudyCompletion } from '@/hooks/useStudyCompletion';
import { TopicoIntelligence } from './TopicoIntelligence';
import { ProgressDots, calculateProgressDots } from './ProgressDots';
import { MasteryBadge } from './MasteryBadge';
import { useTopicoIntelligence } from '@/hooks/useTopicoIntelligence';
import type { Topico, Subtopico } from '@/hooks/useDisciplinasManager';

// ============ Types ============

interface DetailData {
  type: 'topico' | 'subtopico';
  disciplinaId: string;
  topicoId?: string;
  item: Topico | Subtopico;
  disciplinaNome: string;
  topicoNome?: string;
}

interface TopicDetailDrawerProps {
  detail: DetailData | null;
  onClose: () => void;
  materialCounts: { documents: number; flashcards: number; questions: number };
  onOpenNotes: (id: string, title: string, type: 'topico' | 'subtopico') => void;
  onOpenAI: () => void;
  onPlaySubtopico: (id: string, title: string) => void;
}

// ============ Helpers ============

function formatTimeInvested(mins: number | string | undefined): string {
  const m = Number(mins) || 0;
  if (m === 0) return 'Nenhum';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  return `${h}h${r > 0 ? ` ${r}m` : ''}`;
}

function formatLastAccess(raw: string | undefined): string {
  if (!raw) return 'Nunca';
  const date = new Date(raw);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    if (diffHours === 0) return 'Agora';
    return `Ha ${diffHours}h`;
  }
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atras`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getLevel(_item: Topico | Subtopico): string {
  // Placeholder - could be computed from review data
  return 'Intermediario';
}

// ============ Importance Ring ============

function ImportanceRing({ priority }: { priority: number }) {
  // priority: 0-100
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (priority / 100) * circumference;

  const color = priority >= 70 ? '#DC2626' : priority >= 40 ? '#D97706' : '#059669';
  const label = priority >= 70 ? 'Alta' : priority >= 40 ? 'Media' : 'Baixa';

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28" cy="28" r={radius}
            fill="none" stroke="currentColor"
            className="text-gray-100"
            strokeWidth="4"
          />
          <circle
            cx="28" cy="28" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${offset}`}
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
          {priority}
        </span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Importancia</div>
        <div className="text-sm font-semibold" style={{ color }}>{label} prioridade</div>
      </div>
    </div>
  );
}

// ============ Material Pill ============

function MaterialPill({ icon: Icon, label, count, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/80 border border-border/50`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-semibold text-foreground">{count}</div>
      </div>
    </div>
  );
}

// ============ Compact Revisions + Chart ============

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: 'Excelente', color: 'text-emerald-600' };
  if (score >= 80) return { text: 'Muito bom', color: 'text-[#6c63ff]' };
  if (score >= 70) return { text: 'Bom', color: 'text-blue-500' };
  if (score >= 60) return { text: 'Regular', color: 'text-amber-600' };
  return { text: 'Ruim', color: 'text-red-500' };
}

function CompactRevisionsChart() {
  // Mock data — will be connected to real questoes_log + schedule_items
  const chartData = [
    { revisao: 'Rev 1', score: 72 },
    { revisao: 'Rev 2', score: 68 },
    { revisao: 'Rev 3', score: 78 },
    { revisao: 'Rev 4', score: 85 },
    { revisao: 'Rev 5', score: 90 },
    { revisao: 'Rev 6', score: 88 },
  ];
  const scores = chartData.map(d => d.score);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const label = getScoreLabel(avg);
  const nextReview = '18/01';

  const chartConfig = {
    score: {
      label: 'Score',
      color: '#6c63ff',
    },
  } satisfies import('@/components/ui/chart').ChartConfig;

  return (
    <div>
      <div className="text-[9px] font-semibold text-[#9e99ae] uppercase tracking-wide mb-3">Desempenho prático</div>

      {/* Score + label */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[28px] font-extrabold leading-none bg-gradient-to-r from-[#4f46e5] to-[#9b8afb] bg-clip-text text-transparent">
          {avg}%
        </span>
        <span className={`text-[10px] font-semibold ${label.color}`}>
          {label.text}
        </span>
        <span className="text-[9px] text-[#9e99ae]">
          · {scores.length} revisões
        </span>
      </div>

      {/* Bar chart — compact */}
      <div className="h-[155px]">
        <ChartContainerLocal config={chartConfig} className="!aspect-auto h-full w-full">
          <BarChartLocal accessibilityLayer data={chartData}>
            <CartesianGridLocal vertical={false} />
            <XAxisLocal
              dataKey="revisao"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tickFormatter={(value) => value.replace('Rev ', 'R')}
            />
            <ChartTooltipLocal
              content={<ChartTooltipContentLocal hideLabel formatter={(value) => `${value}%`} />}
            />
            <BarLocal
              dataKey="score"
              fill="var(--color-score)"
              radius={[4, 4, 0, 0]}
            />
          </BarChartLocal>
        </ChartContainerLocal>
      </div>

      {/* Detail + next review */}
      <div className="flex items-center justify-between mt-3 text-[10px] text-[#9e99ae]">
        <span>Última · 15/01 · 12/15 questões · 23min</span>
        <span>Próxima: <span className="text-[#d97706] font-medium">{nextReview}</span></span>
      </div>
    </div>
  );
}

// ============ Revisions Section (legacy, kept for reference) ============

function RevisionsSection() {
  // Placeholder revision data - will be connected to real data later
  const revisions = [
    { date: '15/01', score: 85, status: 'done' as const },
    { date: '12/01', score: 78, status: 'done' as const },
    { date: '18/01', score: null, status: 'pending' as const },
    { date: '22/01', score: null, status: 'future' as const },
  ];

  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground mb-2">Revisoes</h4>
      <div className="space-y-1.5">
        {revisions.map((rev, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
              rev.status === 'done' ? 'hover:bg-green-50' :
              rev.status === 'pending' ? 'hover:bg-orange-50' : ''
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              rev.status === 'done' ? 'bg-green-100 border-green-500' :
              rev.status === 'pending' ? 'bg-orange-100 border-orange-400' :
              'bg-gray-100 border-gray-300'
            }`}>
              {rev.status === 'done' && (
                <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {rev.status === 'pending' && (
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
              )}
              {rev.status === 'future' && (
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
              )}
            </div>
            <span className={`text-[11px] font-medium ${
              rev.status === 'pending' ? 'text-orange-600' :
              rev.status === 'future' ? 'text-muted-foreground' :
              'text-foreground'
            }`}>{rev.date}</span>
            {rev.score !== null && (
              <span className="text-[11px] font-bold text-green-600 ml-auto">{rev.score}%</span>
            )}
            {rev.status === 'pending' && (
              <button className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded-full hover:bg-orange-200 transition-colors ml-auto">
                Fazer
              </button>
            )}
            {rev.status === 'future' && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {4 + i}d
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Main Component ============

export const TopicDetailDrawer: React.FC<TopicDetailDrawerProps> = ({
  detail,
  onClose,
  materialCounts,
  onOpenNotes,
  onOpenAI,
  onPlaySubtopico,
}) => {
  const [mobileSheet, setMobileSheet] = useState<'half' | 'full'>('half');
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const isOpen = detail !== null;

  // Close on overlay click (desktop)
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Mobile drag handle
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;

    if (diff > 80) {
      // Drag down
      if (mobileSheet === 'full') {
        setMobileSheet('half');
      } else {
        onClose();
      }
    } else if (diff < -80) {
      // Drag up
      setMobileSheet('full');
    }
  }, [mobileSheet, onClose]);

  // Reset mobile sheet on open
  useEffect(() => {
    if (isOpen) setMobileSheet('half');
  }, [isOpen, detail?.item]);

  if (!detail) {
    return null;
  }

  const item = detail.item;
  const isTopico = detail.type === 'topico';
  const title = item.nome;
  const lastAccess = (item as any).lastAccess;
  const tempoInvestido = (item as any).tempoInvestido;
  const estimatedMinutes = (item as any).estimated_duration_minutes || 0;
  const level = getLevel(item);
  const moduleLabel = isTopico ? detail.disciplinaNome : detail.topicoNome || detail.disciplinaNome;

  // Priority heuristic
  const priority = (() => {
    if ((item as Subtopico).status === 'completed') return 25;
    if ((item as Subtopico).status === 'in-progress') return 65;
    return 80;
  })();

  const itemId = item.id;
  const itemTitle = item.nome;

  return (
    <>
      {/* ===== DESKTOP DRAWER ===== */}
      <div className="hidden lg:contents">
        {/* Overlay */}
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className={`fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Drawer panel */}
        <div
          className={`fixed top-0 right-0 h-full w-[35%] max-w-[480px] min-w-[360px] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-300 ease-out flex flex-col ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <DrawerContent
              detail={detail}
              title={title}
              moduleLabel={moduleLabel}
              lastAccess={lastAccess}
              tempoInvestido={tempoInvestido}
              estimatedMinutes={estimatedMinutes}
              level={level}
              priority={priority}
              materialCounts={materialCounts}
              itemId={itemId}
              itemTitle={itemTitle}
              isTopico={isTopico}
              onOpenNotes={onOpenNotes}
              onOpenAI={onOpenAI}
              onPlaySubtopico={onPlaySubtopico}
            />
          </div>
        </div>
      </div>

      {/* ===== MOBILE BOTTOM SHEET ===== */}
      <div className="lg:hidden">
        {/* Overlay */}
        <div
          onClick={onClose}
          className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Sheet */}
        <div
          ref={sheetRef}
          className={`fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
            isOpen
              ? mobileSheet === 'full'
                ? 'translate-y-0'
                : 'translate-y-[15%]'
              : 'translate-y-full'
          }`}
          style={{ height: '85vh' }}
        >
          {/* Drag handle */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto h-[calc(85vh-28px)]">
            <DrawerContent
              detail={detail}
              title={title}
              moduleLabel={moduleLabel}
              lastAccess={lastAccess}
              tempoInvestido={tempoInvestido}
              estimatedMinutes={estimatedMinutes}
              level={level}
              priority={priority}
              materialCounts={materialCounts}
              itemId={itemId}
              itemTitle={itemTitle}
              isTopico={isTopico}
              onOpenNotes={onOpenNotes}
              onOpenAI={onOpenAI}
              onPlaySubtopico={onPlaySubtopico}
            />
          </div>
        </div>
      </div>
    </>
  );
};

// ============ Shared Drawer Content ============

interface DrawerContentProps {
  detail: DetailData;
  title: string;
  moduleLabel: string;
  lastAccess: string | undefined;
  tempoInvestido: string | number | undefined;
  estimatedMinutes: number;
  level: string;
  priority: number;
  materialCounts: { documents: number; flashcards: number; questions: number };
  itemId: string;
  itemTitle: string;
  isTopico: boolean;
  onOpenNotes: (id: string, title: string, type: 'topico' | 'subtopico') => void;
  onOpenAI: () => void;
  onPlaySubtopico: (id: string, title: string) => void;
}

function DrawerContent({
  detail,
  title,
  moduleLabel,
  lastAccess,
  tempoInvestido,
  estimatedMinutes,
  level,
  priority,
  materialCounts,
  itemId,
  itemTitle,
  isTopico,
  onOpenNotes,
  onOpenAI,
  onPlaySubtopico,
}: DrawerContentProps) {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const { completeStudy } = useStudyCompletion();
  const { data: intelligence, isLoading: intelligenceLoading } = useTopicoIntelligence(
    moduleLabel,
    itemTitle,
    null,
  );

  const item = detail.item;
  const hasProgress = !item.id.startsWith('api-') && ((item as any).tempo_investido > 0 || (item as any).questoes_acertos > 0 || (item as any).completed_at);

  const dots = calculateProgressDots({
    completed_at: (item as any).completed_at,
    teoria_finalizada: (item as any).teoria_finalizada,
    tempo_investido: (item as any).tempo_investido,
    questoes_acertos: (item as any).questoes_acertos,
    questoes_erros: (item as any).questoes_erros,
    leis_lidas: (item as any).leis_lidas,
  });

  return (
    <div className="px-6 pb-8">
      {/* Module label */}
      <div className="mt-4 mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
          {moduleLabel}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-[15px] font-semibold text-[#6b667a] leading-tight pr-8">
        {title}
      </h2>

      {/* Mastery + Progress */}
      <div className="flex items-center gap-2 mt-1">
        <MasteryBadge
          stage={(item as any).learning_stage || 'new'}
          score={(item as any).mastery_score || 0}
        />
        <ProgressDots {...dots} size="md" />
      </div>

      {/* Meta row: time + level */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatLastAccess(lastAccess)}</span>
        </div>
        {estimatedMinutes > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {estimatedMinutes >= 60
                ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}`
                : `${estimatedMinutes}m`
              }
            </span>
          </div>
        )}
        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {level}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-border my-5" />

      {/* Revisões + Desempenho compacto */}
      <CompactRevisionsChart />

      {/* Divider */}
      <div className="h-px bg-border my-5" />

      {/* Material pills */}
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-3">Materiais</h4>
        <div className="grid grid-cols-2 gap-2">
          <MaterialPill
            icon={FileText}
            label="Resumos"
            count={materialCounts.documents}
            color="text-green-600"
          />
          <MaterialPill
            icon={CreditCard}
            label="Cards"
            count={materialCounts.flashcards}
            color="text-purple-600"
          />
          <MaterialPill
            icon={HelpCircle}
            label="Questoes"
            count={materialCounts.questions}
            color="text-orange-600"
          />
          <MaterialPill
            icon={Scale}
            label="Leis"
            count={0}
            color="text-sky-600"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border my-5" />

      {/* Intelligence from API */}
      <TopicoIntelligence data={intelligence} isLoading={intelligenceLoading} />

      {/* Divider */}
      <div className="h-px bg-border my-5" />

      {/* Blur overlay for stats when no progress */}
      <div className={`relative ${!hasProgress ? 'select-none' : ''}`}>
        {!hasProgress && (
          <div className="absolute inset-0 z-10 backdrop-blur-[3px] bg-white/50 rounded-xl flex items-center justify-center cursor-default">
            <span className="text-xs font-semibold text-[#9e99ae]">
              Estude para desbloquear suas estatísticas
            </span>
          </div>
        )}
        <div className={!hasProgress ? 'pointer-events-none' : ''}>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] text-muted-foreground uppercase">Ultimo acesso</div>
            <div className="text-xs font-semibold text-foreground truncate">
              {formatLastAccess(lastAccess)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
          <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div className="min-w-0">
            <div className="text-[9px] text-muted-foreground uppercase">Tempo investido</div>
            <div className="text-xs font-semibold text-foreground">
              {formatTimeInvested(tempoInvestido)}
            </div>
          </div>
        </div>
        <button
          onClick={() => onOpenNotes(itemId, itemTitle, isTopico ? 'topico' : 'subtopico')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-blue-50 transition-all text-left"
        >
          <NotebookPen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] text-muted-foreground uppercase">Anotacoes</div>
            <div className="text-xs font-semibold text-blue-700">Ver notas</div>
          </div>
        </button>
      </div>

      {/* Divider before AI */}
      <div className="h-px bg-border my-5" />

      {/* AI Section */}
      <div className="rounded-xl bg-zinc-900 dark:bg-zinc-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-100 text-sm leading-none">Assistente IA</h4>
            <span className="text-[9px] text-blue-400 font-medium">Beta</span>
          </div>
        </div>

        <p className="text-[12px] text-zinc-400 leading-relaxed mb-4">
          Seu desempenho em revisoes esta crescendo. Foque nos detalhes de excecoes e qualificadoras para alcancar 90%.
        </p>

        <div className="space-y-2">
          <button
            onClick={onOpenAI}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-100 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
            Conversar sobre este topico
          </button>
          <button className="w-full text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all px-4 py-2 rounded-lg">
            Gerar questoes
          </button>
        </div>
      </div>

      </div>{/* End pointer-events wrapper */}
      </div>{/* End blur overlay wrapper */}

      {/* Divider */}
      <div className="h-px bg-border my-5" />

      {/* Registrar Estudo */}
      <button
        onClick={() => setShowCompletionForm(true)}
        className="w-full py-2.5 rounded-xl bg-[#6c63ff] hover:bg-[#4f46e5] text-white text-xs font-bold transition-all shadow-sm"
      >
        Registrar Estudo
      </button>

      {/* Completion Form Modal */}
      {showCompletionForm && (
        <StudyCompletionForm
          topicoNome={itemTitle}
          disciplinaNome={moduleLabel}
          estimatedMinutes={estimatedMinutes || 120}
          onCancel={() => setShowCompletionForm(false)}
          onSave={async (data: CompletionData) => {
            await completeStudy({
              localTopicoId: detail.item.id.startsWith('api-') ? undefined : detail.item.id,
              apiTopicoId: (detail.item as any)._apiId,
              apiDisciplinaId: (detail.item as any)._apiDisciplinaId,
              topicoNome: itemTitle,
              disciplinaNome: moduleLabel,
              estimatedMinutes: estimatedMinutes || 120,
              data,
            });
            setShowCompletionForm(false);
          }}
        />
      )}
    </div>
  );
}

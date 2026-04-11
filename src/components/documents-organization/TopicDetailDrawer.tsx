import React, { useState } from 'react';
import {
  Clock, Sparkles, FileText, CreditCard, HelpCircle, Scale, NotebookPen,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Bar as BarLocal, BarChart as BarChartLocal, CartesianGrid as CartesianGridLocal, XAxis as XAxisLocal } from 'recharts';
import {
  ChartContainer as ChartContainerLocal,
  ChartTooltip as ChartTooltipLocal,
  ChartTooltipContent as ChartTooltipContentLocal,
} from '@/components/ui/chart';

import { StudyCompletionForm, type CompletionData } from './StudyCompletionForm';
import { useStudyCompletion } from '@/hooks/useStudyCompletion';
import { TopicoIntelligence } from './TopicoIntelligence';
import { ProgressDots, calculateProgressDots } from './ProgressDots';
import { MasteryBadge } from './MasteryBadge';
import { useTopicoIntelligence } from '@/hooks/useTopicoIntelligence';
import { useLocalProgress } from '@/hooks/useLocalProgress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

function getAIInsight(mastery: number): string {
  if (mastery === 0) return 'Comece a estudar este tópico para receber insights personalizados.';
  if (mastery < 30) return 'Tópico em fase inicial. Foque na teoria e questões básicas para construir uma base sólida.';
  if (mastery < 50) return 'Progresso inicial. Continue praticando com questões de dificuldade média para consolidar.';
  if (mastery < 75) return 'Bom progresso! Aumente a dificuldade das questões e pratique discriminação entre conceitos similares.';
  if (mastery < 90) return 'Próximo de dominar. Revise os pontos que mais erra e faça questões de nível avançado.';
  return 'Tópico dominado! Mantenha revisões periódicas para preservar a retenção.';
}

function CompactRevisionsChart({ acertos, erros, localTopicoId }: { acertos: number; erros: number; localTopicoId: string | null }) {
  // Query recent sessions from questoes_log
  const { data: sessions } = useQuery({
    queryKey: ['topic-sessions', localTopicoId],
    queryFn: async () => {
      if (!localTopicoId) return [];
      const { data } = await supabase
        .from('questoes_log' as any)
        .select('correto, created_at')
        .eq('topico_id', localTopicoId)
        .order('created_at', { ascending: true })
        .limit(6);
      return (data || []) as Array<{ correto: boolean; created_at: string }>;
    },
    enabled: !!localTopicoId,
    staleTime: 30_000,
  });

  // Build chart data from sessions, fallback to aggregate
  const chartData = sessions && sessions.length > 0
    ? sessions.map((s, i) => ({
        revisao: `S${i + 1}`,
        acertos: s.correto ? 1 : 0,
        erros: s.correto ? 0 : 1,
      }))
    : acertos + erros > 0
      ? [{ revisao: 'Total', acertos, erros }]
      : [];

  // Empty state when no data recorded yet
  if (acertos === 0 && erros === 0 && (!sessions || sessions.length === 0)) {
    return (
      <div className="py-4 text-center">
        <div className="text-[9px] font-semibold text-[#9e99ae] uppercase tracking-wide mb-3">Desempenho pratico</div>
        <div className="text-[11px] text-[#9e99ae]">Registre seu primeiro estudo para ver o desempenho</div>
      </div>
    );
  }

  const totalAcertos = sessions && sessions.length > 0
    ? sessions.filter(s => s.correto).length
    : acertos;
  const totalErros = sessions && sessions.length > 0
    ? sessions.filter(s => !s.correto).length
    : erros;
  const totalQuestions = totalAcertos + totalErros;
  const avg = totalQuestions > 0 ? Math.round((totalAcertos / totalQuestions) * 100) : 0;
  const label = getScoreLabel(avg);

  const chartConfig = {
    acertos: {
      label: 'Acertos',
      color: '#6c63ff',
    },
    erros: {
      label: 'Erros',
      color: '#eeecfb',
    },
  } satisfies import('@/components/ui/chart').ChartConfig;

  return (
    <div>
      <div className="text-[9px] font-semibold text-[#9e99ae] uppercase tracking-wide mb-3">Desempenho pratico</div>

      {/* Score + label */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[28px] font-extrabold leading-none bg-gradient-to-r from-[#4f46e5] to-[#9b8afb] bg-clip-text text-transparent">
          {avg}%
        </span>
        <span className={`text-[10px] font-semibold ${label.color}`}>
          {label.text}
        </span>
        <span className="text-[9px] text-[#9e99ae]">
          · {totalAcertos} acertos · {totalErros} erros
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
              cursor={false}
              content={<ChartTooltipContentLocal indicator="dashed" />}
            />
            <BarLocal
              dataKey="acertos"
              fill="var(--color-acertos)"
              radius={4}
            />
            <BarLocal
              dataKey="erros"
              fill="var(--color-erros)"
              radius={4}
            />
          </BarChartLocal>
        </ChartContainerLocal>
      </div>

      {/* Detail summary */}
      <div className="flex items-center justify-between mt-3 text-[10px] text-[#9e99ae]">
        <span>{totalQuestions} questoes respondidas</span>
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
  const isOpen = detail !== null;

  const item = detail?.item;
  const isTopico = detail?.type === 'topico';
  const title = item?.nome || '';
  const lastAccess = (item as any)?.lastAccess;
  const tempoInvestido = (item as any)?.tempoInvestido;
  const estimatedMinutes = (item as any)?.estimated_duration_minutes || 0;
  const level = item ? getLevel(item) : 'Estudante';
  const moduleLabel = isTopico ? (detail?.disciplinaNome || '') : (detail?.topicoNome || detail?.disciplinaNome || '');

  const priority = (() => {
    if (!item) return 50;
    if ((item as Subtopico).status === 'completed') return 25;
    if ((item as Subtopico).status === 'in-progress') return 65;
    return 80;
  })();

  const itemId = item?.id || '';
  const itemTitle = item?.nome || '';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[35%] max-w-[480px] min-w-[360px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-5 pb-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
            {moduleLabel}
          </span>
          <SheetTitle className="text-[15px] font-semibold text-[#6b667a] leading-tight">
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto flex-1">
          {detail && (
            <DrawerInnerContent
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
              isTopico={!!isTopico}
              onOpenNotes={onOpenNotes}
              onOpenAI={onOpenAI}
              onPlaySubtopico={onPlaySubtopico}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ============ Shared Drawer Content ============

interface DrawerInnerContentProps {
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

function DrawerInnerContent({
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
}: DrawerInnerContentProps) {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const { completeStudy } = useStudyCompletion();
  const { data: intelligence, isLoading: intelligenceLoading } = useTopicoIntelligence(
    moduleLabel,
    itemTitle,
    null,
  );

  const item = detail.item;

  // Query local progress from Supabase by origin_topico_ref
  const originRef = (item as any)._originRef as number | undefined;
  const { progress: localProgress, isLoading } = useLocalProgress(originRef || null);

  const hasProgress = localProgress !== null && (
    (localProgress.tempo_investido || 0) > 0 ||
    (localProgress.questoes_acertos || 0) > 0 ||
    localProgress.completed_at !== null
  );

  const dots = calculateProgressDots({
    completed_at: localProgress?.completed_at ?? (item as any).completed_at,
    teoria_finalizada: localProgress?.teoria_finalizada ?? (item as any).teoria_finalizada,
    tempo_investido: localProgress?.tempo_investido ?? (item as any).tempo_investido,
    questoes_acertos: localProgress?.questoes_acertos ?? (item as any).questoes_acertos,
    questoes_erros: localProgress?.questoes_erros ?? (item as any).questoes_erros,
    leis_lidas: localProgress?.leis_lidas ?? (item as any).leis_lidas,
  });

  return (
    <div className="px-6 pb-8">
      {/* Mastery + Progress */}
      <div className="flex items-center gap-2 mt-1">
        <MasteryBadge
          stage={localProgress?.learning_stage || (item as any).learning_stage || 'new'}
          score={localProgress?.mastery_score || (item as any).mastery_score || 0}
        />
        <ProgressDots {...dots} size="md" />
      </div>

      {/* Meta row: time + level */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatLastAccess(localProgress?.last_access || lastAccess)}</span>
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
      <CompactRevisionsChart
        acertos={localProgress?.questoes_acertos || 0}
        erros={localProgress?.questoes_erros || 0}
        localTopicoId={localProgress?.id || null}
      />

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

      {/* Loading skeleton or blur overlay for stats */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          <div className="h-4 bg-[#f0eef5] rounded animate-pulse w-2/3" />
          <div className="h-20 bg-[#f0eef5] rounded animate-pulse" />
          <div className="h-4 bg-[#f0eef5] rounded animate-pulse w-1/2" />
        </div>
      ) : (
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
              {formatLastAccess(localProgress?.last_access || lastAccess)}
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
              {formatTimeInvested(localProgress?.tempo_investido || tempoInvestido)}
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
          {getAIInsight(localProgress?.mastery_score || 0)}
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
      )}{/* End isLoading ternary */}

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
            const result = await completeStudy({
              localTopicoId: detail.item.id.startsWith('api-') ? undefined : detail.item.id,
              originTopicoRef: (detail.item as any)._originRef,
              originDisciplinaRef: (detail.item as any)._originDisciplinaRef,
              topicoNome: itemTitle,
              disciplinaNome: moduleLabel,
              estimatedMinutes: estimatedMinutes || 120,
              data,
            });

            if (result.success) {
              toast.success(`Estudo registrado! Mastery: ${result.masteryScore || 0}%`);
              // Progress queries invalidated automatically via React Query in completeStudy
            } else {
              toast.error('Erro ao registrar estudo. Tente novamente.');
            }
            setShowCompletionForm(false);
          }}
        />
      )}
    </div>
  );
}

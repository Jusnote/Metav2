/**
 * CronogramaPage — versão clean-slate sobre o schema novo.
 *
 * Composta por blocos minimalistas para evoluir com facilidade:
 *  - useCronogramaActivo: plano + jornada
 *  - useCronogramaWeek:  items + stats da semana selecionada
 *  - useGerarCronograma: trigger do RPC de geração
 *
 * Mantém a navegação tradicional (`/cronograma`). O drawer (CronogramaSheet)
 * continua sendo a vista resumida; esta página é a vista detalhada.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useCronogramaActivo } from '@/hooks/useCronogramaActivo';
import { useCronogramaWeek } from '@/hooks/useCronogramaWeek';
import { useGerarCronograma } from '@/hooks/useGerarCronograma';
import { ScheduleItemTitle } from '@/components/cronograma/ScheduleItemTitle';
import type {
  ScheduleItem,
  ScheduleItemType,
} from '@/types/cronograma';

const TYPE_LABEL: Record<ScheduleItemType, string> = {
  estudo_inicial_p1: 'Teoria',
  estudo_inicial_p2: 'Prática',
  revisao: 'Revisão',
  questoes: 'Questões',
  flashcards: 'Flashcards',
  simulado: 'Simulado',
  lei_seca: 'Lei seca',
};

const TYPE_TONE: Record<ScheduleItemType, string> = {
  estudo_inicial_p1: 'bg-amber-100 text-amber-700 border-amber-200',
  estudo_inicial_p2: 'bg-orange-100 text-orange-700 border-orange-200',
  revisao: 'bg-blue-100 text-blue-700 border-blue-200',
  questoes: 'bg-violet-100 text-violet-700 border-violet-200',
  flashcards: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  simulado: 'bg-rose-100 text-rose-700 border-rose-200',
  lei_seca: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function formatMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function groupByDay(items: ScheduleItem[]): Array<{ date: string; items: ScheduleItem[] }> {
  const map = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const arr = map.get(item.scheduled_date) ?? [];
    arr.push(item);
    map.set(item.scheduled_date, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dayMonth = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${dayMonth}`;
}

export default function CronogramaPage() {
  const navigate = useNavigate();
  const {
    plano,
    isLoading: planoLoading,
    hasActivePlan,
    totalWeeks,
    currentWeek,
    refresh: refreshPlano,
  } = useCronogramaActivo();

  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  const {
    items,
    stats,
    isLoading: weekLoading,
    toggleComplete,
    refresh: refreshWeek,
  } = useCronogramaWeek(plano?.id, selectedWeek);

  const { isGenerating, gerar, error: gerarError } = useGerarCronograma();

  const grouped = useMemo(() => groupByDay(items), [items]);

  const completedCount = items.filter((i) => i.status === 'concluido').length;
  const completionPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const handleGerar = async () => {
    if (!plano?.id) return;
    try {
      await gerar(plano.id);
      await refreshWeek();
      await refreshPlano();
    } catch {
      // erro já capturado em gerarError
    }
  };

  if (planoLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!hasActivePlan || !plano) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader plano={null} currentWeek={0} totalWeeks={0} />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-12">
            <Sparkles className="h-8 w-8 text-slate-400 mx-auto" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Nenhum plano de estudo ativo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Crie um plano com data de início, data da prova e disciplinas para liberar
              a geração automática do cronograma.
            </p>
            <button
              type="button"
              onClick={() => navigate('/cronograma/setup')}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              <Calendar className="h-4 w-4" />
              Criar plano
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader plano={plano.nome} currentWeek={currentWeek} totalWeeks={totalWeeks} />

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <WeekPicker
          totalWeeks={totalWeeks}
          currentWeek={currentWeek}
          selectedWeek={selectedWeek}
          onSelect={setSelectedWeek}
        />

        <SummaryRow
          completed={completedCount}
          total={items.length}
          completionPct={
            stats?.completion_pct != null ? Math.round(stats.completion_pct) : completionPct
          }
          minutesEstimated={stats?.minutes_estimated ?? null}
          minutesActual={stats?.minutes_actual ?? null}
          desempenhoPct={stats?.desempenho_pct ?? null}
        />

        {items.length === 0 ? (
          <EmptyWeek
            isLoading={weekLoading}
            isGenerating={isGenerating}
            onGerar={handleGerar}
            error={gerarError}
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ date, items: dayItems }) => (
              <DayGroup
                key={date}
                date={date}
                items={dayItems}
                onToggle={toggleComplete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PageHeader({
  plano,
  currentWeek,
  totalWeeks,
}: {
  plano: string | null;
  currentWeek: number;
  totalWeeks: number;
}) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Cronograma de Estudos
            </h1>
            {plano && (
              <p className="text-xs text-slate-500 tabular-nums">
                {plano} · Semana {currentWeek} de {totalWeeks}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekPicker({
  totalWeeks,
  currentWeek,
  selectedWeek,
  onSelect,
}: {
  totalWeeks: number;
  currentWeek: number;
  selectedWeek: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        {Array.from({ length: totalWeeks }, (_, i) => {
          const w = i + 1;
          const isSelected = w === selectedWeek;
          const isCurrent = w === currentWeek;
          return (
            <button
              key={w}
              type="button"
              onClick={() => onSelect(w)}
              className={`h-8 min-w-[36px] px-2 rounded-md text-[12px] font-medium tabular-nums transition ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isCurrent
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {w}
              {isCurrent && !isSelected && (
                <span className="ml-1 text-[9px] text-emerald-600">·</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({
  completed,
  total,
  completionPct,
  minutesEstimated,
  minutesActual,
  desempenhoPct,
}: {
  completed: number;
  total: number;
  completionPct: number;
  minutesEstimated: number | null;
  minutesActual: number | null;
  desempenhoPct: number | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <StatCard
        label="Conclusão"
        value={`${completionPct}%`}
        sub={`${completed} de ${total}`}
        tone="blue"
      />
      <StatCard
        label="Tempo estimado"
        value={formatMinutes(minutesEstimated)}
        sub="esta semana"
        tone="slate"
      />
      <StatCard
        label="Tempo realizado"
        value={formatMinutes(minutesActual)}
        sub="esta semana"
        tone="emerald"
      />
      <StatCard
        label="Desempenho"
        value={desempenhoPct != null ? `${Math.round(desempenhoPct)}%` : '—'}
        sub="questões corretas"
        tone="amber"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'blue' | 'emerald' | 'amber' | 'slate';
}) {
  const TONE = {
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700',
  } as const;
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-[22px] font-bold tabular-nums leading-none ${TONE[tone]}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}

function EmptyWeek({
  isLoading,
  isGenerating,
  onGerar,
  error,
}: {
  isLoading: boolean;
  isGenerating: boolean;
  onGerar: () => void;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center">
        <Loader2 className="h-5 w-5 text-slate-400 animate-spin mx-auto" />
        <p className="mt-3 text-sm text-slate-500">Carregando atividades…</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
      <Sparkles className="h-7 w-7 text-slate-400 mx-auto" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">
        Nenhuma atividade nesta semana
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Gere o cronograma completo do plano em um único passo. O sistema distribui as
        disciplinas pelos dias respeitando sua disponibilidade.
      </p>
      <button
        type="button"
        onClick={onGerar}
        disabled={isGenerating}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Gerar cronograma
          </>
        )}
      </button>
      {error && (
        <p className="mt-3 text-xs text-rose-600">Erro: {error}</p>
      )}
    </div>
  );
}

function DayGroup({
  date,
  items,
  onToggle,
}: {
  date: string;
  items: ScheduleItem[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {formatDate(date)}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
}: {
  item: ScheduleItem;
  onToggle: (id: string) => void;
}) {
  const done = item.status === 'concluido';
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-label={done ? 'Desmarcar concluído' : 'Marcar como concluído'}
        className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
          done
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300 hover:border-emerald-400'
        }`}
      >
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </button>

      <span
        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${TYPE_TONE[item.type]}`}
      >
        {TYPE_LABEL[item.type]}
        {item.revision_number > 0 && ` ${item.revision_number}`}
      </span>

      <div className="flex-1 min-w-0">
        <ScheduleItemTitle
          conceitoPai={item.subtopicos?.conceito_pai}
          nome={item.title}
          size="default"
          className={done ? 'opacity-50 line-through' : undefined}
        />
      </div>

      <div className="shrink-0 flex items-center gap-1 text-[12px] text-slate-500 tabular-nums">
        <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
        {formatMinutes(item.estimated_duration_minutes)}
      </div>
    </div>
  );
}

/**
 * CronogramaSetupPage — wizard spotlight com Papiro.
 *
 * Cada pergunta domina o centro do palco. Entre steps, Papiro entrega uma
 * reação curta em itálico. Painel direito monta o plano ao vivo conforme
 * as respostas chegam. Tom escuro, accent emerald, accent secundário roxo
 * para o avatar/persona.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCargoAtivo } from '@/hooks/useCargoAtivo';
import type { Carreira } from '@/types/carreira';

// =============================================================================
// Types
// =============================================================================

type StepId =
  | 'objetivo'
  | 'data'
  | 'horasUtil'
  | 'fimDeSemana'
  | 'estilo'
  | 'disciplinas'
  | 'reveal';

const STEPS: StepId[] = [
  'objetivo', 'data', 'horasUtil', 'fimDeSemana', 'estilo', 'disciplinas', 'reveal',
];

type Objetivo = 'concurso' | 'oab' | 'vestibular' | 'outro';
type WeekendMode = 'mesmo' | 'leve' | 'folga';
type Estilo = 'teorico' | 'equilibrado' | 'pratico';
type Prioridade = 'alta' | 'media' | 'baixa';

interface SelectedDisciplina {
  id: string;
  peso: number;
  prioridade: Prioridade;
  nivel_conhecimento?: 'iniciante' | 'intermediario' | 'avancado';
  is_ponto_fraco?: boolean;
}

interface Answers {
  objetivo?: Objetivo;
  daysToExam?: number;
  weekdayMinutes?: number;
  weekendMode?: WeekendMode;
  estilo?: Estilo;
  selectedDisciplinas?: Map<string, SelectedDisciplina>;
  cargo?: Carreira | null;
  simulados_freq?: 'nenhum' | 'mensal' | 'quinzenal' | 'semanal';
  tem_redacao?: boolean;
  tipo_material?: 'video' | 'pdf' | 'livro' | 'questoes' | 'misto';
  horario_preferido?: 'manha' | 'tarde' | 'noite' | 'madrugada' | 'flexivel';
}

interface MixRatio {
  teoria: number;
  questoes: number;
  revisao: number;
  flashcards: number;
}

type Scenario = 'vazio' | 'relaxado' | 'normal' | 'apertado' | 'impossivel';

interface Disciplina {
  id: string;
  nome: string;
  baseMinutes: number;
  subtopicCount: number;
}

// =============================================================================
// Constants
// =============================================================================

const QUESTIONS: Record<StepId, { eyebrow: string; title: string; hint?: string }> = {
  objetivo: {
    eyebrow: 'Vamos começar',
    title: 'O que você está estudando?',
    hint: 'Isso me ajuda a estruturar o plano do jeito certo.',
  },
  data: {
    eyebrow: 'Tempo',
    title: 'E quando é o grande dia?',
    hint: 'Vou calcular tudo a partir daqui.',
  },
  horasUtil: {
    eyebrow: 'Ritmo',
    title: 'Quanto tempo, em dias úteis?',
    hint: 'Conta com o tempo que você realmente terá. Sem chutar.',
  },
  fimDeSemana: {
    eyebrow: 'Fim de semana',
    title: 'E sábado e domingo?',
    hint: 'Decide com sinceridade — o plano se molda ao seu ritmo real.',
  },
  estilo: {
    eyebrow: 'Perfil',
    title: 'Qual estilo combina com você?',
    hint: 'Cada perfil distribui o tempo entre teoria, questões, revisão e flashcards.',
  },
  disciplinas: {
    eyebrow: 'Conteúdo',
    title: 'Quais matérias entram?',
    hint: 'Marque o que estuda. Ajuste a intensidade conforme a importância.',
  },
  reveal: {
    eyebrow: 'Pronto',
    title: 'Olha o que saiu daqui.',
  },
};

const OBJETIVO_LABEL: Record<Objetivo, string> = {
  concurso: 'Concurso público',
  oab: 'OAB',
  vestibular: 'Vestibular',
  outro: 'Outro',
};
const WEEKEND_LABEL: Record<WeekendMode, string> = {
  mesmo: 'Mesmo ritmo',
  leve: 'Mais leve',
  folga: 'Folgo no fim de semana',
};
const ESTILO_LABEL: Record<Estilo, string> = {
  teorico: 'Teórico',
  equilibrado: 'Equilibrado',
  pratico: 'Prático',
};
const ESTILO_MIX: Record<Estilo, MixRatio> = {
  teorico: { teoria: 60, questoes: 20, revisao: 15, flashcards: 5 },
  equilibrado: { teoria: 40, questoes: 40, revisao: 15, flashcards: 5 },
  pratico: { teoria: 25, questoes: 55, revisao: 15, flashcards: 5 },
};

const PRIORIDADE_PESO: Record<Prioridade, number> = { alta: 1.5, media: 1, baixa: 0.6 };
const FALLBACK_MIN_PER_DISCIPLINA = 600;

const MIX_COLORS = {
  teoria: '#fbbf24',
  questoes: '#a78bfa',
  revisao: '#60a5fa',
  flashcards: '#22d3ee',
} as const;

const SCENARIO_UI: Record<Scenario, { label: string; accent: string }> = {
  vazio: { label: 'Aguardando', accent: '#64748b' },
  relaxado: { label: 'Folgado', accent: '#60a5fa' },
  normal: { label: 'Equilibrado', accent: '#34d399' },
  apertado: { label: 'Apertado', accent: '#fbbf24' },
  impossivel: { label: 'Inviável', accent: '#fb7185' },
};

// =============================================================================
// Utilities
// =============================================================================

function todayPlusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayISO(): string { return todayPlusDaysISO(0); }
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function countWeekdaysWeekendsBetween(startISO: string, endISO: string) {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (end <= start) return { weekdays: 0, saturdays: 0, sundays: 0, totalDays: 0, totalWeeks: 0 };
  let weekdays = 0, saturdays = 0, sundays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 6) saturdays++; else if (day === 0) sundays++; else weekdays++;
    cursor.setDate(cursor.getDate() + 1);
  }
  const totalDays = weekdays + saturdays + sundays;
  return { weekdays, saturdays, sundays, totalDays, totalWeeks: Math.ceil(totalDays / 7) };
}
function fmtHours(min: number): string {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// =============================================================================
// Papiro's reactions
// =============================================================================

function reactObjetivo(o: Objetivo): string {
  if (o === 'concurso') return 'Boa. Esse caminho exige consistência.';
  if (o === 'oab') return 'OAB tem padrão bem definido — dá pra montar com precisão.';
  if (o === 'vestibular') return 'Vestibular. Vou pensar na divisão por matéria.';
  return 'Entendi. Vou tratar como ciclo contínuo.';
}
function reactData(days: number): string {
  if (days <= 30) return 'Pouco tempo. Foco máximo, então.';
  if (days <= 60) return 'Dá pra estruturar algo denso e equilibrado.';
  if (days <= 90) return 'Três meses é um bom horizonte. Vou distribuir com folga.';
  return 'Tempo confortável. Dá pra ir fundo.';
}
function reactHoras(horas: number, days: number): string {
  if (days <= 30 && horas <= 1) return `${horas}h em ${days} dias é apertado. Vou ser cirúrgico.`;
  if (days <= 30 && horas >= 4) return `${horas}h em ${days} dias é um sprint. Vai render.`;
  if (days <= 60 && horas <= 2) return `${horas}h em ${days} dias é viável, com fim de semana firme.`;
  if (horas >= 4) return `${horas}h por dia já é sólido.`;
  if (horas === 3) return 'Três horas é um ritmo equilibrado.';
  if (horas === 2) return 'Duas horas é o mínimo confortável.';
  return 'Anotado.';
}
function reactWeekend(m: WeekendMode): string {
  if (m === 'mesmo') return 'Show. Você vai produzir bastante.';
  if (m === 'leve') return 'Faz sentido — fim de semana com menos carga.';
  return 'Sem problema. Redistribuo o peso pros dias úteis.';
}
function reactEstilo(e: Estilo): string {
  if (e === 'teorico') return 'Bom pra quem ainda está absorvendo conteúdo novo.';
  if (e === 'pratico') return 'Foco em questões — clássico de quem já tem base.';
  return 'A divisão padrão. Funciona pra maioria.';
}
function reactDisciplinas(count: number, s: Scenario): string {
  if (s === 'impossivel') return `${count} disciplinas não cabem nesse ritmo. Vou sugerir reduzir.`;
  if (s === 'apertado') return `${count} disciplinas é ambicioso — mas dá. Vai exigir disciplina.`;
  if (s === 'normal') return `${count} disciplinas cabem bem no ritmo definido.`;
  return `${count} disciplinas — sobra tempo, dá pra ir fundo em cada uma.`;
}

// =============================================================================
// Main
// =============================================================================

export default function CronogramaSetupPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<StepId>('objetivo');
  const [phase, setPhase] = useState<'asking' | 'reacting' | 'transitioning'>('asking');
  const [reaction, setReaction] = useState<string>('');
  const [answers, setAnswers] = useState<Answers>({});
  const [revealed, setRevealed] = useState({
    duration: false, weekly: false, weekendBars: false, donut: false, viability: false,
  });
  const [finalReveal, setFinalReveal] = useState(false);

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [discsLoading, setDiscsLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { cargo, hydrated: cargoHydrated } = useCargoAtivo();

  const stepIdx = STEPS.indexOf(step);

  // Sync cargo from navbar into answers when hydrated
  useEffect(() => {
    if (cargoHydrated && cargo && !answers.cargo) {
      setAnswers(prev => ({ ...prev, cargo }));
    }
  }, [cargoHydrated, cargo, answers.cargo]);

  // Transition: question → fade out → reaction (hold) → fade out → next question
  const advance = useCallback(async (nextStep: StepId, reactionText: string) => {
    setPhase('transitioning');
    await new Promise((r) => setTimeout(r, 280));
    setReaction(reactionText);
    setPhase('reacting');
    await new Promise((r) => setTimeout(r, 1500));
    setPhase('transitioning');
    await new Promise((r) => setTimeout(r, 280));
    setStep(nextStep);
    setPhase('asking');
  }, []);

  const onPickObjetivo = useCallback(async (o: Objetivo) => {
    setAnswers((a) => ({ ...a, objetivo: o }));
    loadDisciplinas();
    await advance('data', reactObjetivo(o));
  }, [advance]);

  const onPickData = useCallback(async (days: number) => {
    setAnswers((a) => ({ ...a, daysToExam: days }));
    setRevealed((r) => ({ ...r, duration: true }));
    await advance('horasUtil', reactData(days));
  }, [advance]);

  const onPickHoras = useCallback(async (h: number) => {
    setAnswers((a) => ({ ...a, weekdayMinutes: h * 60 }));
    setRevealed((r) => ({ ...r, weekly: true }));
    await advance('fimDeSemana', reactHoras(h, answers.daysToExam ?? 60));
  }, [advance, answers.daysToExam]);

  const onPickWeekend = useCallback(async (m: WeekendMode) => {
    setAnswers((a) => ({ ...a, weekendMode: m }));
    setRevealed((r) => ({ ...r, weekendBars: true }));
    await advance('estilo', reactWeekend(m));
  }, [advance]);

  const onPickEstilo = useCallback(async (e: Estilo) => {
    setAnswers((a) => ({ ...a, estilo: e }));
    setRevealed((r) => ({ ...r, donut: true }));
    await advance('disciplinas', reactEstilo(e));
  }, [advance]);

  const onConfirmDisciplinas = useCallback(async (sel: Map<string, SelectedDisciplina>) => {
    if (sel.size === 0) return;
    setAnswers((a) => ({ ...a, selectedDisciplinas: sel }));
    setRevealed((r) => ({ ...r, viability: true }));
    const scenario = computeScenarioPreview(sel, answers, disciplinas);
    await advance('reveal', reactDisciplinas(sel.size, scenario));
    setFinalReveal(true);
  }, [advance, answers, disciplinas]);

  const loadDisciplinas = useCallback(async () => {
    setDiscsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDiscsLoading(false); return; }
    const { data: discRows } = await supabase
      .from('disciplinas')
      .select('id, nome, topicos!inner(id, subtopicos(estimated_duration_minutes))')
      .eq('user_id', user.id)
      .order('nome', { ascending: true });
    const mapped: Disciplina[] = (discRows ?? []).map((d: any) => {
      let baseMinutes = 0, subtopicCount = 0;
      for (const t of d.topicos ?? []) for (const s of t.subtopicos ?? []) {
        baseMinutes += s.estimated_duration_minutes ?? 0;
        subtopicCount += 1;
      }
      return { id: d.id, nome: d.nome, baseMinutes, subtopicCount };
    });
    const { data: allDisc } = await supabase.from('disciplinas').select('id, nome').eq('user_id', user.id);
    const mappedIds = new Set(mapped.map((d) => d.id));
    for (const d of allDisc ?? []) {
      if (!mappedIds.has(d.id)) mapped.push({ id: d.id, nome: d.nome, baseMinutes: 0, subtopicCount: 0 });
    }
    mapped.sort((a, b) => a.nome.localeCompare(b.nome));
    setDisciplinas(mapped);
    setDiscsLoading(false);
  }, []);

  // Computed for preview
  const computed = useMemo(() => {
    const dataInicio = todayISO();
    const days = answers.daysToExam ?? 0;
    const dataProva = days > 0 ? todayPlusDaysISO(days) : todayPlusDaysISO(90);
    const periodo = countWeekdaysWeekendsBetween(dataInicio, dataProva);
    const weekdayMinutes = answers.weekdayMinutes ?? 0;
    const weekendMode = answers.weekendMode ?? 'mesmo';
    const weekendMinutes = weekendMode === 'mesmo' ? weekdayMinutes
      : weekendMode === 'leve' ? Math.round(weekdayMinutes * 0.5) : 0;
    const studySat = weekendMode !== 'folga';
    const studySun = weekendMode !== 'folga';
    const weekMinutes = 5 * weekdayMinutes + (studySat ? weekendMinutes : 0) + (studySun ? weekendMinutes : 0);
    const sabDays = studySat ? periodo.saturdays : 0;
    const domDays = studySun ? periodo.sundays : 0;
    const capacidadeMin = periodo.weekdays * weekdayMinutes + (sabDays + domDays) * weekendMinutes;
    const mix = answers.estilo ? ESTILO_MIX[answers.estilo] : { teoria: 40, questoes: 40, revisao: 15, flashcards: 5 };
    const sel = answers.selectedDisciplinas ?? new Map();
    let baseTeoria = 0;
    for (const s of sel.values()) {
      const disc = disciplinas.find((d) => d.id === s.id);
      if (!disc) continue;
      const base = disc.baseMinutes > 0 ? disc.baseMinutes : FALLBACK_MIN_PER_DISCIPLINA;
      baseTeoria += base * s.peso;
    }
    const teoriaFrac = mix.teoria / 100;
    const necessarioMin = teoriaFrac > 0 ? baseTeoria / teoriaFrac : 0;
    const ratio = capacidadeMin > 0 ? necessarioMin / capacidadeMin : 0;
    let scenario: Scenario;
    if (sel.size === 0) scenario = 'vazio';
    else if (ratio > 1) scenario = 'impossivel';
    else if (ratio > 0.9) scenario = 'apertado';
    else if (ratio > 0.6) scenario = 'normal';
    else scenario = 'relaxado';
    return {
      totalWeeks: periodo.totalWeeks, weekMinutes, capacidadeMin, necessarioMin, ratio, scenario,
      folgaMin: Math.max(0, capacidadeMin - necessarioMin),
      faltaMin: Math.max(0, necessarioMin - capacidadeMin),
      mix,
      perDay: {
        sun: studySun ? weekendMinutes : 0,
        mon: weekdayMinutes, tue: weekdayMinutes, wed: weekdayMinutes,
        thu: weekdayMinutes, fri: weekdayMinutes,
        sat: studySat ? weekendMinutes : 0,
      },
      maxDay: Math.max(weekdayMinutes, weekendMinutes),
      dataInicio, dataProva, weekdayMinutes, weekendMinutes, studySaturday: studySat, studySunday: studySun,
    };
  }, [answers, disciplinas]);

  // Submit
  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');
      const { data: planoRow, error: planoErr } = await supabase
        .from('planos_estudo')
        .insert({
          user_id: user.id, nome: 'Meu plano de estudo',
          data_inicio: computed.dataInicio, data_prova: computed.dataProva,
          mode: 'continuo', status: 'ativo',
        }).select('id').single();
      if (planoErr) throw planoErr;
      if (!planoRow) throw new Error('Falha ao criar plano.');
      const planoId = planoRow.id;
      const { error: configErr } = await supabase.from('plano_config').insert({
        plano_id: planoId,
        weekday_minutes: computed.weekdayMinutes,
        weekend_minutes: computed.weekendMinutes,
        block_duration_minutes: 50,
        mix_ratio: {
          teoria: computed.mix.teoria / 100,
          questoes: computed.mix.questoes / 100,
          revisao: computed.mix.revisao / 100,
          flashcards: computed.mix.flashcards / 100,
        },
      });
      if (configErr) throw configErr;
      const rows = Array.from((answers.selectedDisciplinas ?? new Map()).values()).map((s, idx) => ({
        plano_id: planoId, disciplina_id: s.id, peso: s.peso, prioridade: s.prioridade, enabled: true, ordem: idx,
      }));
      const { error: discErr } = await supabase.from('plano_disciplinas').insert(rows);
      if (discErr) throw discErr;
      navigate('/cronograma');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('uniq_one_active_per_user')) setSubmitError('Você já tem um plano ativo. Arquive-o antes de criar outro.');
      else setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen text-slate-100 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 600px at 0% 0%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(16,185,129,0.08) 0%, transparent 60%), linear-gradient(160deg, #0a0f1f 0%, #0d1428 40%, #111a36 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.10) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Header */}
      <div className="relative max-w-[1200px] mx-auto px-10 pt-7 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/cronograma')}
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-200 transition tracking-wide"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <ProgressDots current={stepIdx} total={STEPS.length - 1} />

        <div className="flex items-center gap-2.5">
          <PapiroAvatar small />
          <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold">
            Papiro
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="relative max-w-[1200px] mx-auto px-10 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-16 items-start">
          {/* SPOTLIGHT */}
          <div className="min-h-[480px] flex items-start">
            {phase === 'reacting' ? (
              <ReactionStage text={reaction} />
            ) : (
              <QuestionStage
                step={step}
                phase={phase}
                answers={answers}
                disciplinas={disciplinas}
                discsLoading={discsLoading}
                onPickObjetivo={onPickObjetivo}
                onPickData={onPickData}
                onPickHoras={onPickHoras}
                onPickWeekend={onPickWeekend}
                onPickEstilo={onPickEstilo}
                onConfirmDisciplinas={onConfirmDisciplinas}
                onCreate={handleSubmit}
                onAdjust={() => navigate('/cronograma')}
                submitting={submitting}
                submitError={submitError}
              />
            )}
          </div>

          {/* PREVIEW RAIL */}
          <PreviewRail computed={computed} revealed={revealed} finalReveal={finalReveal} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Scenario preview (no state)
// =============================================================================
function computeScenarioPreview(
  sel: Map<string, SelectedDisciplina>,
  ans: Answers,
  disciplinas: Disciplina[],
): Scenario {
  const weekdayMinutes = ans.weekdayMinutes ?? 0;
  const weekendMode = ans.weekendMode ?? 'mesmo';
  const weekendMinutes = weekendMode === 'mesmo' ? weekdayMinutes
    : weekendMode === 'leve' ? Math.round(weekdayMinutes * 0.5) : 0;
  const studySat = weekendMode !== 'folga';
  const studySun = weekendMode !== 'folga';
  const days = ans.daysToExam ?? 60;
  const periodo = countWeekdaysWeekendsBetween(todayISO(), todayPlusDaysISO(days));
  const sabDays = studySat ? periodo.saturdays : 0;
  const domDays = studySun ? periodo.sundays : 0;
  const capacidadeMin = periodo.weekdays * weekdayMinutes + (sabDays + domDays) * weekendMinutes;
  const mix = ans.estilo ? ESTILO_MIX[ans.estilo] : { teoria: 40, questoes: 40, revisao: 15, flashcards: 5 };
  let baseTeoria = 0;
  for (const s of sel.values()) {
    const disc = disciplinas.find((d) => d.id === s.id);
    if (!disc) continue;
    const base = disc.baseMinutes > 0 ? disc.baseMinutes : FALLBACK_MIN_PER_DISCIPLINA;
    baseTeoria += base * s.peso;
  }
  const teoriaFrac = mix.teoria / 100;
  const necessario = teoriaFrac > 0 ? baseTeoria / teoriaFrac : 0;
  const ratio = capacidadeMin > 0 ? necessario / capacidadeMin : 0;
  if (sel.size === 0) return 'vazio';
  if (ratio > 1) return 'impossivel';
  if (ratio > 0.9) return 'apertado';
  if (ratio > 0.6) return 'normal';
  return 'relaxado';
}

// =============================================================================
// Papiro avatar
// =============================================================================

function PapiroAvatar({ small = false, large = false }: { small?: boolean; large?: boolean }) {
  const size = large ? 'h-14 w-14' : small ? 'h-7 w-7' : 'h-10 w-10';
  return (
    <div className="relative shrink-0">
      <div
        className="absolute -inset-1.5 rounded-full opacity-50 blur-md"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)' }}
      />
      <div
        className={`relative ${size} rounded-full overflow-hidden`}
        style={{
          boxShadow:
            '0 6px 16px -4px rgba(99,102,241,0.5), 0 0 0 1px rgba(139,92,246,0.4)',
        }}
      >
        <img
          src="/papiro-avatar.png"
          alt="Papiro"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Progress dots
// =============================================================================

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const passed = i < current;
        const active = i === current;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: active ? 20 : 4,
              height: 4,
              background: passed || active ? '#34d399' : 'rgba(148,163,184,0.2)',
              boxShadow: active ? '0 0 10px rgba(52,211,153,0.6)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// Reaction interlude
// =============================================================================

function ReactionStage({ text }: { text: string }) {
  return (
    <div className="w-full pt-12 animate-fade-up flex items-start gap-4">
      <PapiroAvatar large />
      <div className="pt-2">
        <div className="text-[10px] tracking-[0.2em] uppercase text-violet-300/80 mb-2">
          Papiro
        </div>
        <div
          className="text-[28px] leading-snug text-slate-100 max-w-[560px]"
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontStyle: 'italic',
            letterSpacing: '-0.01em',
          }}
        >
          “{text}”
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Question stage
// =============================================================================

function QuestionStage(props: {
  step: StepId;
  phase: 'asking' | 'transitioning' | 'reacting';
  answers: Answers;
  disciplinas: Disciplina[];
  discsLoading: boolean;
  onPickObjetivo: (o: Objetivo) => void;
  onPickData: (d: number) => void;
  onPickHoras: (h: number) => void;
  onPickWeekend: (m: WeekendMode) => void;
  onPickEstilo: (e: Estilo) => void;
  onConfirmDisciplinas: (s: Map<string, SelectedDisciplina>) => void;
  onCreate: () => void;
  onAdjust: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const { step, phase } = props;
  const q = QUESTIONS[step];
  const transitioning = phase === 'transitioning';
  return (
    <div
      className="w-full transition-all duration-300 ease-out"
      style={{
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
      }}
    >
      <div className="mb-10">
        <div className="text-[10px] tracking-[0.2em] uppercase text-emerald-300/70 mb-3">
          {q.eyebrow}
        </div>
        <h1
          className="text-[36px] leading-[1.08] tracking-tight text-slate-50 font-semibold max-w-[600px]"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.02em' }}
        >
          {q.title}
        </h1>
        {q.hint && (
          <p className="mt-3 text-[13px] text-slate-500 max-w-[480px] leading-relaxed">
            {q.hint}
          </p>
        )}
      </div>

      <div>
        {step === 'objetivo' && <ObjetivoOptions onPick={props.onPickObjetivo} />}
        {step === 'data' && <DataOptions onPick={props.onPickData} />}
        {step === 'horasUtil' && <HorasOptions onPick={props.onPickHoras} />}
        {step === 'fimDeSemana' && <WeekendOptions onPick={props.onPickWeekend} />}
        {step === 'estilo' && <EstiloOptions onPick={props.onPickEstilo} />}
        {step === 'disciplinas' && (
          <DisciplinasPicker
            disciplinas={props.disciplinas}
            loading={props.discsLoading}
            onConfirm={props.onConfirmDisciplinas}
          />
        )}
        {step === 'reveal' && (
          <RevealActions
            onCreate={props.onCreate}
            onAdjust={props.onAdjust}
            submitting={props.submitting}
            error={props.submitError}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Card base
// =============================================================================

function MinimalCard({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left rounded-2xl transition-all duration-300 ease-out hover:-translate-y-0.5 ${className}`}
      style={{
        background: 'rgba(15,23,42,0.4)',
        border: '1px solid rgba(148,163,184,0.08)',
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: '0 0 0 1px rgba(52,211,153,0.35), 0 14px 40px -16px rgba(16,185,129,0.4)',
        }}
      />
      {children}
    </button>
  );
}

// =============================================================================
// STEP UIs
// =============================================================================

// Step 1: Objetivo
function ObjetivoOptions({ onPick }: { onPick: (o: Objetivo) => void }) {
  const items: Array<{ o: Objetivo; label: string; sub: string }> = [
    { o: 'concurso', label: 'Concurso público', sub: 'banca + edital' },
    { o: 'oab', label: 'OAB', sub: '1ª ou 2ª fase' },
    { o: 'vestibular', label: 'Vestibular', sub: 'tradicional ou ENEM' },
    { o: 'outro', label: 'Outro', sub: 'estudo contínuo' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[560px]">
      {items.map((it) => (
        <MinimalCard key={it.o} onClick={() => onPick(it.o)} className="px-5 py-5">
          <div className="relative">
            <div
              className="text-[18px] text-slate-100 font-semibold leading-tight"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.01em' }}
            >
              {it.label}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{it.sub}</div>
          </div>
        </MinimalCard>
      ))}
    </div>
  );
}

// Step 2: Data
function DataOptions({ onPick }: { onPick: (days: number) => void }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState(todayPlusDaysISO(60));

  if (showCustom) {
    const days = Math.max(1, Math.round((parseISO(customDate).getTime() - parseISO(todayISO()).getTime()) / 86400000));
    return (
      <div className="flex items-center gap-4 max-w-[560px]">
        <input
          type="date" value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          min={todayPlusDaysISO(1)}
          className="bg-transparent border-0 border-b border-slate-700/60 px-0 py-2 text-[16px] text-slate-100 tabular-nums [color-scheme:dark] focus:outline-none focus:border-emerald-400 transition"
        />
        <span className="text-[12px] text-slate-500 tabular-nums">{days} dias</span>
        <button
          type="button" onClick={() => onPick(days)}
          className="ml-auto px-5 py-2 rounded-full text-[12px] font-semibold text-emerald-100 bg-emerald-500/15 border border-emerald-400/40 hover:bg-emerald-500/25 transition"
        >
          Confirmar
        </button>
      </div>
    );
  }
  const opts = [
    { days: 30, big: '30', hint: 'sprint' },
    { days: 60, big: '60', hint: 'denso' },
    { days: 90, big: '90', hint: 'estruturado' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-[560px]">
      {opts.map((o) => (
        <MinimalCard key={o.days} onClick={() => onPick(o.days)} className="px-4 py-5">
          <div className="relative flex flex-col items-center">
            <div
              className="text-[44px] font-bold tabular-nums leading-none text-slate-50"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.03em' }}
            >
              {o.big}
            </div>
            <div className="mt-1.5 text-[10px] text-slate-500 uppercase tracking-[0.16em]">
              dias · {o.hint}
            </div>
          </div>
        </MinimalCard>
      ))}
      <MinimalCard onClick={() => setShowCustom(true)} className="px-4 py-5">
        <div className="relative flex flex-col items-center justify-center h-full">
          <div
            className="text-[14px] font-semibold text-slate-300"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            data exata
          </div>
          <div className="mt-1.5 text-[10px] text-slate-600 uppercase tracking-[0.18em]">escolher</div>
        </div>
      </MinimalCard>
    </div>
  );
}

// Step 3: Horas
function HorasOptions({ onPick }: { onPick: (h: number) => void }) {
  const opts = [
    { v: 1, label: '1h', hint: 'leve' },
    { v: 2, label: '2h', hint: 'mínimo' },
    { v: 3, label: '3h', hint: 'sólido' },
    { v: 5, label: '4h+', hint: 'intenso' },
  ];
  const maxH = 5;
  return (
    <div className="grid grid-cols-4 gap-3 max-w-[560px]">
      {opts.map((o) => {
        const heightPct = (o.v / maxH) * 100;
        return (
          <MinimalCard key={o.v} onClick={() => onPick(o.v)} className="h-[140px] flex flex-col">
            <div className="relative flex-1 px-4 pt-4 flex flex-col justify-end">
              <div
                className="rounded-md transition-all duration-500"
                style={{
                  height: `${heightPct}%`,
                  minHeight: '4px',
                  background: 'linear-gradient(180deg, rgba(110,231,183,0.7) 0%, rgba(16,185,129,0.95) 100%)',
                  boxShadow: '0 0 12px rgba(52,211,153,0.3)',
                }}
              />
            </div>
            <div className="relative px-4 pt-2 pb-3 text-center border-t border-slate-700/30">
              <div
                className="text-[20px] font-bold text-slate-50 leading-none"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.02em' }}
              >
                {o.label}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-[0.14em]">{o.hint}</div>
            </div>
          </MinimalCard>
        );
      })}
    </div>
  );
}

// Step 4: Weekend
function WeekendOptions({ onPick }: { onPick: (m: WeekendMode) => void }) {
  const opts: Array<{ mode: WeekendMode; label: string; sub: string; weekendH: number }> = [
    { mode: 'mesmo', label: 'Mesmo ritmo', sub: 'estudo sáb e dom', weekendH: 1 },
    { mode: 'leve', label: 'Mais leve', sub: 'metade do tempo', weekendH: 0.5 },
    { mode: 'folga', label: 'Folga total', sub: 'só dias úteis', weekendH: 0 },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[560px]">
      {opts.map((o) => (
        <MinimalCard key={o.mode} onClick={() => onPick(o.mode)} className="px-5 py-5">
          <div className="relative space-y-3">
            <MiniWeekBars weekendHeight={o.weekendH} />
            <div>
              <div
                className="text-[16px] text-slate-100 font-semibold leading-tight"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              >
                {o.label}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">{o.sub}</div>
            </div>
          </div>
        </MinimalCard>
      ))}
    </div>
  );
}
function MiniWeekBars({ weekendHeight }: { weekendHeight: number }) {
  const days = [
    { label: 'D', wknd: true }, { label: 'S', wknd: false }, { label: 'T', wknd: false },
    { label: 'Q', wknd: false }, { label: 'Q', wknd: false }, { label: 'S', wknd: false },
    { label: 'S', wknd: true },
  ];
  return (
    <div className="flex items-end justify-between gap-1 h-9">
      {days.map((d, i) => {
        const h = d.wknd ? weekendHeight * 100 : 100;
        const active = h > 0;
        const dim = d.wknd && weekendHeight < 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative flex-1 w-full flex items-end">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${h}%`,
                  minHeight: active ? '3px' : '2px',
                  background: active
                    ? dim
                      ? 'rgba(52,211,153,0.45)'
                      : 'linear-gradient(180deg, rgba(110,231,183,0.7) 0%, rgba(16,185,129,0.95) 100%)'
                    : 'rgba(71,85,105,0.25)',
                  boxShadow: active && !dim ? '0 0 5px rgba(52,211,153,0.3)' : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Step 5: Estilo
function EstiloOptions({ onPick }: { onPick: (e: Estilo) => void }) {
  const opts: Array<{ e: Estilo; label: string; sub: string }> = [
    { e: 'teorico', label: 'Teórico', sub: '60% teoria · 20% questões' },
    { e: 'equilibrado', label: 'Equilibrado', sub: '40% teoria · 40% questões' },
    { e: 'pratico', label: 'Prático', sub: '25% teoria · 55% questões' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[560px]">
      {opts.map((o) => (
        <MinimalCard key={o.e} onClick={() => onPick(o.e)} className="px-5 py-5">
          <div className="relative flex flex-col items-center gap-3">
            <MiniDonut mix={ESTILO_MIX[o.e]} />
            <div className="text-center">
              <div
                className="text-[16px] text-slate-100 font-semibold"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              >
                {o.label}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">{o.sub}</div>
            </div>
          </div>
        </MinimalCard>
      ))}
    </div>
  );
}
function MiniDonut({ mix }: { mix: MixRatio }) {
  const total = mix.teoria + mix.questoes + mix.revisao + mix.flashcards;
  const r = 22;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const segs = [
    { color: MIX_COLORS.teoria, value: mix.teoria },
    { color: MIX_COLORS.questoes, value: mix.questoes },
    { color: MIX_COLORS.revisao, value: mix.revisao },
    { color: MIX_COLORS.flashcards, value: mix.flashcards },
  ];
  return (
    <div className="relative h-[56px] w-[56px]">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(71,85,105,0.25)" strokeWidth="4" />
        {segs.map((s, i) => {
          const frac = total > 0 ? s.value / total : 0;
          const len = c * frac;
          const offset = c - acc;
          acc += len;
          return (
            <circle
              key={i} cx="28" cy="28" r={r} fill="none" stroke={s.color} strokeWidth="4"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={offset}
            />
          );
        })}
      </svg>
    </div>
  );
}

// Step 6: Disciplinas
function DisciplinasPicker({
  disciplinas, loading, onConfirm,
}: {
  disciplinas: Disciplina[];
  loading: boolean;
  onConfirm: (sel: Map<string, SelectedDisciplina>) => void;
}) {
  const [sel, setSel] = useState<Map<string, SelectedDisciplina>>(new Map());
  const toggle = (id: string) => {
    setSel((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { id, peso: 1, prioridade: 'media' });
      return next;
    });
  };
  const setIntensity = (id: string, peso: number) => {
    setSel((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (!cur) return prev;
      const prioridade: Prioridade = peso >= 1.3 ? 'alta' : peso <= 0.7 ? 'baixa' : 'media';
      next.set(id, { ...cur, peso, prioridade });
      return next;
    });
  };
  const totalBaseMin = useMemo(() => {
    let total = 0;
    for (const s of sel.values()) {
      const disc = disciplinas.find((d) => d.id === s.id);
      if (!disc) continue;
      const base = disc.baseMinutes > 0 ? disc.baseMinutes : FALLBACK_MIN_PER_DISCIPLINA;
      total += base * s.peso;
    }
    return total;
  }, [sel, disciplinas]);

  if (loading) return <div className="py-4"><Loader2 className="h-5 w-5 text-slate-500 animate-spin" /></div>;
  if (disciplinas.length === 0) return (
    <div className="text-[13px] text-slate-500 py-3 max-w-[560px]">
      Nenhuma disciplina cadastrada ainda. Crie disciplinas antes de montar o plano.
    </div>
  );

  return (
    <div className="max-w-[680px] space-y-5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-slate-500 uppercase tracking-[0.14em] text-[10px]">
          <span className="text-slate-100 font-semibold tabular-nums">{sel.size}</span> selecionada
          {sel.size === 1 ? '' : 's'}
          <span className="text-slate-700 mx-2">·</span>
          <span className="text-slate-100 font-semibold tabular-nums">{fmtHours(totalBaseMin)}</span> base
        </span>
        <button
          type="button"
          onClick={() => onConfirm(sel)}
          disabled={sel.size === 0}
          className="px-5 py-2 rounded-full text-[12px] font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: sel.size === 0
              ? 'rgba(71,85,105,0.2)'
              : 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)',
            color: sel.size === 0 ? '#94a3b8' : '#022c22',
            boxShadow: sel.size === 0 ? 'none' : '0 8px 28px -10px rgba(16,185,129,0.6)',
          }}
        >
          Pronto
        </button>
      </div>

      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
        {disciplinas.map((d) => (
          <DisciplinaRow
            key={d.id} disc={d} selected={sel.get(d.id)}
            onToggle={() => toggle(d.id)}
            onIntensity={(p) => setIntensity(d.id, p)}
          />
        ))}
      </div>
    </div>
  );
}

function DisciplinaRow({
  disc, selected, onToggle, onIntensity,
}: {
  disc: Disciplina;
  selected: SelectedDisciplina | undefined;
  onToggle: () => void;
  onIntensity: (peso: number) => void;
}) {
  const on = !!selected;
  const peso = selected?.peso ?? 1;
  const intensityColor = peso <= 0.7 ? '#60a5fa' : peso >= 1.3 ? '#fb7185' : '#34d399';
  const intensityLabel = peso <= 0.7 ? 'baixa' : peso >= 1.3 ? 'alta' : 'média';
  return (
    <div
      className="relative rounded-xl transition-all duration-200"
      style={{
        background: on ? 'rgba(16,185,129,0.04)' : 'transparent',
        borderBottom: '1px solid rgba(148,163,184,0.06)',
      }}
    >
      <div className="flex items-center gap-4 px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center transition ${
            on ? 'bg-emerald-400 border-emerald-400' : 'border-slate-600 hover:border-slate-400'
          }`}
        >
          {on && <Check className="h-2.5 w-2.5 text-emerald-950" strokeWidth={4} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-[14px] truncate ${on ? 'text-slate-100' : 'text-slate-400'}`}>
            {disc.nome}
          </div>
          {disc.subtopicCount > 0 && (
            <div className="text-[10px] text-slate-500 tabular-nums">
              {disc.subtopicCount} subtópicos · {fmtHours(disc.baseMinutes)}
            </div>
          )}
        </div>
        {on && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right min-w-[60px]">
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: intensityColor }}
              >
                {intensityLabel}
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums">×{peso.toFixed(1)}</div>
            </div>
            <IntensityDrag value={peso} onChange={onIntensity} accent={intensityColor} />
          </div>
        )}
      </div>
    </div>
  );
}

function IntensityDrag({
  value, onChange, accent,
}: { value: number; onChange: (v: number) => void; accent: string }) {
  const min = 0.5, max = 1.5;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-[100px]">
      <div
        className="h-1 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, rgba(96,165,250,0.4) 0%, rgba(52,211,153,0.4) 50%, rgba(251,113,133,0.4) 100%)',
        }}
      />
      <input
        type="range"
        min={min} max={max} step={0.1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full pointer-events-none transition-all"
        style={{
          left: `calc(${pct}% - 7px)`,
          background: accent,
          boxShadow: `0 0 0 2px #0a0f1f, 0 2px 8px ${accent}aa`,
        }}
      />
    </div>
  );
}

// --- Reveal CTA ---
function RevealActions({
  onCreate, onAdjust, submitting, error,
}: {
  onCreate: () => void;
  onAdjust: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4 max-w-[560px]">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onCreate}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)',
            color: '#022c22',
            boxShadow: '0 14px 36px -12px rgba(16,185,129,0.55), 0 0 0 1px rgba(16,185,129,0.3)',
          }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {submitting ? 'Criando…' : 'Criar plano'}
        </button>
        <button
          type="button"
          onClick={onAdjust}
          className="text-[12px] font-medium text-slate-400 hover:text-slate-100 transition"
        >
          Quero ajustar antes
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-[12px] text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Preview rail
// =============================================================================

interface Computed {
  totalWeeks: number;
  weekMinutes: number;
  capacidadeMin: number;
  necessarioMin: number;
  ratio: number;
  scenario: Scenario;
  folgaMin: number;
  faltaMin: number;
  mix: MixRatio;
  perDay: { sun: number; mon: number; tue: number; wed: number; thu: number; fri: number; sat: number };
  maxDay: number;
  weekdayMinutes: number;
  weekendMinutes: number;
  studySaturday: boolean;
  studySunday: boolean;
}

function PreviewRail({
  computed, revealed, finalReveal,
}: {
  computed: Computed;
  revealed: { duration: boolean; weekly: boolean; weekendBars: boolean; donut: boolean; viability: boolean };
  finalReveal: boolean;
}) {
  const ui = SCENARIO_UI[computed.scenario];
  return (
    <aside className="lg:sticky lg:top-24 self-start space-y-8">
      <div className="relative">
        <div
          className="absolute -inset-8 rounded-full pointer-events-none transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle, ${ui.accent}22 0%, transparent 70%)`,
            opacity: revealed.viability ? 1 : 0.2,
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <ViabilityRing
            ratio={computed.ratio} scenario={computed.scenario}
            accent={ui.accent} active={revealed.viability} pulse={finalReveal}
          />
          <div className="mt-5">
            <div className="text-[9px] tracking-[0.2em] uppercase font-semibold" style={{ color: ui.accent }}>
              Status
            </div>
            <div
              className="mt-1 text-[22px] font-semibold tracking-tight transition-colors"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                color: revealed.viability ? '#f1f5f9' : '#475569',
                letterSpacing: '-0.015em',
              }}
            >
              {revealed.viability ? ui.label : '—'}
            </div>
            {finalReveal && computed.scenario === 'impossivel' && (
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-200 border border-rose-500/30 animate-fade-up">
                Faltam {fmtHours(computed.faltaMin)}
              </div>
            )}
            {finalReveal && (computed.scenario === 'normal' || computed.scenario === 'relaxado') && (
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-200 border border-emerald-500/30 animate-fade-up">
                Folga {fmtHours(computed.folgaMin)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-700/30 pt-5">
        <StatLine
          label="Duração"
          value={revealed.duration ? `${computed.totalWeeks}` : '—'}
          suffix={revealed.duration ? (computed.totalWeeks === 1 ? 'semana' : 'semanas') : ''}
          active={revealed.duration}
        />
        <StatLine
          label="Por semana"
          value={revealed.weekly ? `${(computed.weekMinutes / 60).toFixed(1).replace('.', ',')}` : '—'}
          suffix={revealed.weekly ? 'h' : ''}
          active={revealed.weekly}
        />
        <StatLine
          label="Capacidade"
          value={revealed.viability ? `${Math.round(computed.capacidadeMin / 60)}` : '—'}
          suffix={revealed.viability ? 'h' : ''}
          active={revealed.viability}
        />
        <StatLine
          label="Necessário"
          value={
            revealed.viability && isFinite(computed.necessarioMin) && computed.necessarioMin > 0
              ? `${Math.round(computed.necessarioMin / 60)}` : '—'
          }
          suffix={revealed.viability && computed.necessarioMin > 0 && isFinite(computed.necessarioMin) ? 'h' : ''}
          active={revealed.viability}
        />
      </div>

      <div className="border-t border-slate-700/30 pt-5">
        <div className="text-[9px] tracking-[0.2em] uppercase text-slate-500 mb-3">
          Distribuição semanal
        </div>
        <WeekdayBars
          perDay={computed.perDay} maxDay={computed.maxDay}
          weekdayActive={revealed.weekly} weekendActive={revealed.weekendBars}
        />
      </div>

      <div className="border-t border-slate-700/30 pt-5">
        <div className="text-[9px] tracking-[0.2em] uppercase text-slate-500 mb-3">
          Mix
        </div>
        <MixSummary mix={computed.mix} active={revealed.donut} />
      </div>
    </aside>
  );
}

function StatLine({
  label, value, suffix, active,
}: { label: string; value: string; suffix: string; active: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0.35 }}
    >
      <span className="text-[10px] tracking-[0.16em] uppercase text-slate-500">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className="text-[22px] font-bold tabular-nums text-slate-100"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.02em' }}
        >
          {value}
        </span>
        {suffix && <span className="text-[11px] text-slate-500">{suffix}</span>}
      </span>
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

function ViabilityRing({
  ratio, scenario, accent, active, pulse,
}: { ratio: number; scenario: Scenario; accent: string; active: boolean; pulse: boolean }) {
  const safe = !active || scenario === 'vazio' || !isFinite(ratio) ? 0 : Math.min(1, ratio);
  const animated = useCountUp(safe, 1000);
  const pct = animated * 100;
  const r = 64;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[170px] w-[170px]">
      {pulse && (
        <>
          <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${accent}20`, animationDuration: '2.2s' }} />
          <div className="absolute inset-3 rounded-full animate-ping" style={{ background: `${accent}15`, animationDuration: '2.6s', animationDelay: '0.4s' }} />
        </>
      )}
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="4" />
        <circle
          cx="80" cy="80" r={r} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - animated)}
          style={{ filter: `drop-shadow(0 0 10px ${accent}88)`, transition: 'stroke-dashoffset 0.4s, stroke 0.4s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="text-[44px] font-bold tabular-nums leading-none"
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            color: active ? '#f1f5f9' : '#475569',
            letterSpacing: '-0.03em',
            transition: 'color 0.4s',
          }}
        >
          {active && scenario !== 'vazio' ? Math.round(pct) : '—'}
        </div>
        <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-500">
          {active && scenario !== 'vazio' ? 'da capacidade' : ''}
        </div>
      </div>
    </div>
  );
}

function WeekdayBars({
  perDay, maxDay, weekdayActive, weekendActive,
}: {
  perDay: { sun: number; mon: number; tue: number; wed: number; thu: number; fri: number; sat: number };
  maxDay: number;
  weekdayActive: boolean;
  weekendActive: boolean;
}) {
  const days: Array<{ key: keyof typeof perDay; label: string; isWeekend: boolean }> = [
    { key: 'sun', label: 'D', isWeekend: true },
    { key: 'mon', label: 'S', isWeekend: false },
    { key: 'tue', label: 'T', isWeekend: false },
    { key: 'wed', label: 'Q', isWeekend: false },
    { key: 'thu', label: 'Q', isWeekend: false },
    { key: 'fri', label: 'S', isWeekend: false },
    { key: 'sat', label: 'S', isWeekend: true },
  ];
  const max = Math.max(60, maxDay);
  return (
    <div className="flex items-end justify-between gap-1.5 h-14">
      {days.map(({ key, label, isWeekend }, idx) => {
        const v = perDay[key];
        const shouldShow = isWeekend ? weekendActive : weekdayActive;
        const h = shouldShow && max > 0 ? (v / max) * 100 : 0;
        const active = shouldShow && v > 0;
        return (
          <div key={key} className="flex flex-col items-center gap-1.5 flex-1">
            <div className="relative flex-1 w-full flex items-end">
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: `${h}%`,
                  background: active
                    ? 'linear-gradient(180deg, rgba(52,211,153,0.7) 0%, rgba(16,185,129,0.9) 100%)'
                    : 'rgba(71,85,105,0.25)',
                  boxShadow: active ? '0 0 6px rgba(52,211,153,0.3)' : undefined,
                  minHeight: active ? '3px' : '2px',
                  transitionDelay: active ? `${idx * 60}ms` : '0ms',
                }}
              />
            </div>
            <span className={`text-[8px] tracking-[0.16em] uppercase transition-colors ${active ? 'text-slate-400' : 'text-slate-600'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MixSummary({ mix, active }: { mix: MixRatio; active: boolean }) {
  return (
    <div className="space-y-2.5 transition-opacity duration-500" style={{ opacity: active ? 1 : 0.4 }}>
      {(['teoria', 'questoes', 'revisao', 'flashcards'] as const).map((k) => (
        <div key={k} className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: MIX_COLORS[k] }} />
          <span className="text-[11px] text-slate-400 capitalize flex-1">{k}</span>
          <div className="flex-1 h-1 rounded-full bg-slate-800/60 overflow-hidden max-w-[100px]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${active ? mix[k] : 0}%`,
                background: MIX_COLORS[k],
                boxShadow: `0 0 8px ${MIX_COLORS[k]}66`,
              }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-slate-200 font-semibold w-8 text-right">
            {active ? `${mix[k]}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

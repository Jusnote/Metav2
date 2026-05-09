'use client';

import {
  Brain,
  Sparkles,
  Calendar,
  TrendingUp,
  TrendingDown,
  Flame,
  Target,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Star,
  ChevronRight,
  Play,
  Clock,
  FileText,
  BookOpen,
  Layers,
  ClipboardCheck,
  Lightbulb,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuroraBackground } from '../components/ui/aurora-background';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const cardBase =
  'bg-white border border-slate-200/70 rounded-2xl shadow-[0_10px_30px_-10px_rgba(30,41,59,0.08),0_2px_8px_-2px_rgba(30,41,59,0.04)]';

// ───────── Mock data ─────────
const SEMANA_ATUAL = 3;
const TOTAL_SEMANAS = 12;
const PROGRESSO_SEMANA = 68;
const FOCO = 'Direito Administrativo';

const PROGRESSO_ITENS = [
  { label: 'Questões', sub: 'Resolver questões', icon: ClipboardCheck, color: 'bg-indigo-500', done: 120, total: 180 },
  { label: 'Lei Seca', sub: 'Leitura e marcação', icon: BookOpen, color: 'bg-emerald-500', done: 6, total: 10 },
  { label: 'Resumos', sub: 'Estudar resumos', icon: FileText, color: 'bg-amber-500', done: 3, total: 5 },
  { label: 'Revisões (programadas)', sub: 'Revisões inteligentes', icon: Brain, color: 'bg-violet-500', done: 46, total: 60 },
  { label: 'Simulado', sub: 'Simulado parcial', icon: Target, color: 'bg-slate-400', done: 0, total: 1 },
];

const SEMANA_AGENDA = [
  { label: '120 questões de Direito Administrativo', status: 'Em andamento', tone: 'amber' as const },
  { label: 'Leitura dos Arts. 37 ao 41 da CF', status: 'Em andamento', tone: 'amber' as const },
  { label: '2 revisões críticas programadas', status: 'Prioritário', tone: 'red' as const },
];

const REVISOES_PROGRAMADAS = [
  { titulo: 'Direito Administrativo', sub: 'Licitações e Contratos · Arts. 37 ao 41', tag: '2 críticas', tone: 'red' },
  { titulo: 'Controle de Constitucionalidade', sub: 'ADI, ADC e ADPF', tag: '3 moderadas', tone: 'amber' },
  { titulo: 'Servidor Público', sub: 'Regime Jurídico', tag: '6 leves', tone: 'emerald' },
];

const SEMANAS_PROGRESSO = Array.from({ length: TOTAL_SEMANAS }, (_, i) => {
  const n = i + 1;
  if (n < SEMANA_ATUAL) return { n, pct: 100, done: true, current: false };
  if (n === SEMANA_ATUAL) return { n, pct: PROGRESSO_SEMANA, done: false, current: true };
  return { n, pct: 0, done: false, current: false };
});

const APROVEITAMENTO = 72;
const APROVEITAMENTO_TREND = 8;

const APROVEITAMENTO_CHART = [
  { day: 1, value: 64 }, { day: 2, value: 66 }, { day: 3, value: 65 }, { day: 4, value: 68 },
  { day: 5, value: 67 }, { day: 6, value: 70 }, { day: 7, value: 69 }, { day: 8, value: 71 },
  { day: 9, value: 70 }, { day: 10, value: 72 }, { day: 11, value: 71 }, { day: 12, value: 73 },
  { day: 13, value: 72 }, { day: 14, value: 72 },
];

const MELHORES_DISC = [
  { nome: 'Constitucional', pct: 78 },
  { nome: 'Administrativo', pct: 74 },
];
const PIORES_DISC = [
  { nome: 'Português', pct: 58 },
  { nome: 'RLM', pct: 52 },
];

const STREAK_DIAS = 7;
const SEMANA_DAYS = [
  { letra: 'S', done: true }, { letra: 'T', done: true }, { letra: 'Q', done: true },
  { letra: 'Q', done: true }, { letra: 'S', done: true }, { letra: 'S', done: true },
  { letra: 'D', done: false },
];

const EVOLUCAO_QUESTOES = 1248;
const EVOLUCAO_QUESTOES_TREND = 18;
const EVOLUCAO_HORAS = '18h 40m';
const EVOLUCAO_HORAS_TREND = 12;

const EVOLUCAO_CHART = [
  { week: 'S1', questoes: 80, horas: 12 },
  { week: 'S2', questoes: 110, horas: 14 },
  { week: 'S3', questoes: 130, horas: 13 },
  { week: 'S4', questoes: 140, horas: 15 },
  { week: 'S5', questoes: 160, horas: 17 },
  { week: 'S6', questoes: 175, horas: 16 },
  { week: 'S7', questoes: 190, horas: 18 },
];

const ACESSO_RAPIDO = [
  { nome: 'Questões', sub: 'Resolver questões', href: '/questoes', icon: ClipboardCheck, tint: 'indigo' },
  { nome: 'Flashcards', sub: 'Estudar cards', href: '/flashcards', icon: Layers, tint: 'emerald' },
  { nome: 'Lei Seca', sub: 'Ler legislação', href: '/lei-seca', icon: BookOpen, tint: 'amber' },
  { nome: 'Resumos', sub: 'Ver resumos', href: '/resumos', icon: FileText, tint: 'rose' },
  { nome: 'Cadernos', sub: 'Meus cadernos', href: '/cadernos', icon: Calendar, tint: 'violet' },
  { nome: 'Simulados', sub: 'Fazer simulados', href: '/simulados', icon: Target, tint: 'slate' },
];

const TINT_CLASSES: Record<string, string> = {
  indigo: 'text-indigo-600 bg-indigo-50',
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
  rose: 'text-rose-600 bg-rose-50',
  violet: 'text-violet-600 bg-violet-50',
  slate: 'text-slate-600 bg-slate-100',
};

// ───────── Reusable bits ─────────

function RingProgress({ pct, size = 96, stroke = 8, color = '#6366f1' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
    </svg>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'red' | 'emerald' | 'slate' }) {
  const map = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[tone]}`}>
      {children}
    </span>
  );
}

// ───────── Sections ─────────

function JornadaSemana() {
  return (
    <section className={`${cardBase} p-6 relative overflow-hidden`}>
      {/* Faixa de ilustração à direita (mountains) */}
      <div className="absolute top-0 right-0 w-2/5 h-full opacity-[0.06] pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <polygon points="0,200 50,80 90,140 130,40 180,160 200,100 200,200" fill="#6366f1" />
        </svg>
      </div>

      <header className="flex items-start justify-between mb-5 relative">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wider">Jornada da Semana</h2>
          <p className="text-xs text-slate-500 mt-0.5">Liberdade para estudar. Direção para evoluir.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700 border border-violet-200">
          <Sparkles className="w-3 h-3" /> Semana {SEMANA_ATUAL} de {TOTAL_SEMANAS}
        </span>
      </header>

      <div className="flex items-center gap-5 mb-6 relative">
        <div className="relative shrink-0">
          <RingProgress pct={PROGRESSO_SEMANA} size={104} stroke={9} color="#8b5cf6" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[24px] font-bold text-slate-900 leading-none">{PROGRESSO_SEMANA}%</span>
            <span className="text-[10px] text-slate-500 mt-0.5">concluída</span>
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
          <div className="flex items-start gap-2">
            <Star className="w-4 h-4 text-violet-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Foco da semana</p>
              <p className="text-[15px] font-semibold text-slate-900 mt-0.5">{FOCO}</p>
              <button className="text-[11px] text-violet-600 hover:underline mt-1">Alterar foco</button>
            </div>
          </div>
        </div>
      </div>

      {/* Progresso por categoria */}
      <div className="mb-5 relative">
        <header className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Seu progresso na semana</h3>
          <button className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-0.5">
            Ver jornada completa <ChevronRight className="w-3 h-3" />
          </button>
        </header>
        <ul className="space-y-2.5">
          {PROGRESSO_ITENS.map((it) => {
            const pct = it.total === 0 ? 0 : Math.round((it.done / it.total) * 100);
            const Icon = it.icon;
            return (
              <li key={it.label} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-md ${it.color} flex items-center justify-center text-white shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-slate-800 truncate">{it.label}</p>
                      <p className="text-[10.5px] text-slate-500 truncate">{it.sub}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] tabular-nums">
                      <span className="text-slate-700 font-medium">{it.done} / {it.total}</span>
                      <span className="text-slate-400 w-9 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${it.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Agenda da semana */}
      <div className="relative">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Um pouco do que te espera esta semana</h3>
        <ul className="rounded-xl border border-slate-200 bg-slate-50/40 divide-y divide-slate-200/70">
          {SEMANA_AGENDA.map((item, i) => (
            <li key={i} className="px-3 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span className="text-[12.5px] text-slate-700 truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                {i === 1 && (
                  <button className="text-[11px] text-indigo-600 hover:underline">Ver tudo</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RevisoesInteligentes() {
  return (
    <section className={`${cardBase} p-6`}>
      <header className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">REVISÕES INTELIGENTES</h2>
            <p className="text-xs text-slate-500 mt-0.5">Programadas automaticamente pelo seu cronograma semanal</p>
          </div>
        </div>
        <button className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          Como funciona <Info className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="col-span-2 rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-violet-700">Sua memória hoje</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-[28px] font-bold text-slate-900 leading-none">87%</span>
            <span className="text-[11px] text-emerald-600 font-medium pb-1">↑ 4%</span>
          </div>
          <p className="text-[10.5px] text-slate-500 mt-1">em relação à semana passada</p>
          <div className="h-6 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{ x: 1, y: 80 }, { x: 2, y: 82 }, { x: 3, y: 81 }, { x: 4, y: 84 }, { x: 5, y: 86 }, { x: 6, y: 85 }, { x: 7, y: 87 }]}>
                <Line type="monotone" dataKey="y" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold text-slate-900 leading-none">23</span>
          <div className="flex items-center gap-1 mt-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-700">Leves</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold text-slate-900 leading-none">8</span>
          <div className="flex items-center gap-1 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] font-medium text-amber-700">Moderadas</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 mb-5 flex items-center justify-center">
        <span className="text-[24px] font-bold text-slate-900 leading-none mr-2">2</span>
        <AlertTriangle className="w-3.5 h-3.5 text-red-600 mr-1" />
        <span className="text-[11px] font-medium text-red-700">Críticas</span>
      </div>

      <div className="mb-4">
        <header className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Próximas revisões programadas</h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-semibold">Hoje</span>
            33
          </span>
        </header>
        <ul className="space-y-1.5">
          {REVISOES_PROGRAMADAS.map((rv, i) => (
            <li key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-3 hover:border-slate-300 cursor-pointer transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-1 h-9 rounded-full ${rv.tone === 'red' ? 'bg-red-400' : rv.tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">{rv.titulo}</p>
                  <p className="text-[11px] text-slate-500 truncate">{rv.sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-md px-2 py-0.5 ${
                  rv.tone === 'red' ? 'bg-red-50 text-red-700 border border-red-200' :
                  rv.tone === 'amber' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {rv.tag}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button className="rounded-xl bg-slate-900 text-white text-[13px] font-semibold py-2.5 hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2">
          <Play className="w-4 h-4" /> Iniciar revisões
        </button>
        <button className="rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-semibold py-2.5 hover:bg-slate-50 inline-flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4" /> Ver calendário de revisões
        </button>
      </div>

      <div>
        <header className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Progresso das semanas</h3>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <button className="w-5 h-5 rounded hover:bg-slate-100 inline-flex items-center justify-center">‹</button>
            <span>{SEMANA_ATUAL} de {TOTAL_SEMANAS} semanas</span>
            <button className="w-5 h-5 rounded hover:bg-slate-100 inline-flex items-center justify-center">›</button>
          </div>
        </header>
        <div className="flex items-end gap-2 h-16 px-1">
          {SEMANAS_PROGRESSO.map((s) => (
            <div key={s.n} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-slate-100 rounded-md flex-1 flex items-end overflow-hidden relative">
                <div
                  className={`w-full transition-all rounded-b-md ${
                    s.current ? 'bg-violet-500' : s.done ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                  style={{ height: `${Math.max(s.pct, 6)}%` }}
                />
                {s.current && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-violet-700 bg-white px-1 rounded">
                    {s.pct}%
                  </span>
                )}
              </div>
              <span className="text-[9px] text-slate-400 tabular-nums">
                {s.n === TOTAL_SEMANAS ? <Target className="w-2.5 h-2.5" /> : `S${s.n}`}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 inline-flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-600" /> Você está à frente de 62% dos alunos nesta etapa.
        </p>
      </div>
    </section>
  );
}

function DesempenhoGeral() {
  return (
    <section className={`${cardBase} p-5`}>
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Desempenho Geral</h3>
        <button className="text-[11px] text-indigo-600 hover:underline">Ver detalhes</button>
      </header>

      <div className="flex items-center gap-4 mb-3">
        <div className="relative shrink-0">
          <RingProgress pct={APROVEITAMENTO} size={84} stroke={7} color="#6366f1" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-bold text-slate-900 leading-none">{APROVEITAMENTO}%</span>
            <span className="text-[9px] text-slate-500 mt-0.5">aproveit.</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1 text-emerald-600 text-[12.5px] font-semibold">
            <TrendingUp className="w-3.5 h-3.5" /> {APROVEITAMENTO_TREND}%
          </div>
          <p className="text-[10.5px] text-slate-500">nos últimos 14 dias</p>
          <div className="h-10 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={APROVEITAMENTO_CHART}>
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1.5">Melhores disciplinas</p>
          <ul className="space-y-1">
            {MELHORES_DISC.map((d) => (
              <li key={d.nome} className="flex items-center justify-between text-[12px]">
                <span className="text-slate-700 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {d.nome}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">{d.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 mb-1.5">Piores disciplinas</p>
          <ul className="space-y-1">
            {PIORES_DISC.map((d) => (
              <li key={d.nome} className="flex items-center justify-between text-[12px]">
                <span className="text-slate-700 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {d.nome}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">{d.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ConsistenciaSemanal() {
  return (
    <section className={`${cardBase} p-5`}>
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Consistência Semanal</h3>
        <button className="text-[11px] text-indigo-600 hover:underline">Ver histórico</button>
      </header>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-[32px] font-bold text-slate-900 leading-none">{STREAK_DIAS}</span>
        <span className="text-[13px] text-slate-600">dias</span>
        <span className="ml-auto inline-flex items-center gap-1 text-amber-600 text-[11px] font-medium">
          <Flame className="w-3.5 h-3.5" /> sequência atual
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {SEMANA_DAYS.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">{d.letra}</span>
            <div className={`w-full aspect-square rounded-md flex items-center justify-center ${
              d.done ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'
            }`}>
              {d.done && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Meta semanal</span>
          <span className="text-slate-500 tabular-nums">6 / 7 dias</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: '85%' }} />
        </div>
      </div>
    </section>
  );
}

function Evolucao() {
  return (
    <section className={`${cardBase} p-5`}>
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Evolução</h3>
        <button className="text-[11px] text-indigo-600 hover:underline">Ver mais</button>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10.5px] text-slate-500">Questões resolvidas</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-[20px] font-bold text-slate-900 leading-none tabular-nums">
              {EVOLUCAO_QUESTOES.toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> {EVOLUCAO_QUESTOES_TREND}%
            </span>
          </div>
          <p className="text-[10px] text-slate-400">vs semana passada</p>
        </div>

        <div>
          <p className="text-[10.5px] text-slate-500">Horas estudadas</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-[20px] font-bold text-slate-900 leading-none tabular-nums">{EVOLUCAO_HORAS}</span>
            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> {EVOLUCAO_HORAS_TREND}%
            </span>
          </div>
          <p className="text-[10px] text-slate-400">vs semana passada</p>
        </div>
      </div>

      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={EVOLUCAO_CHART}>
            <defs>
              <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" hide />
            <YAxis hide />
            <Tooltip
              cursor={{ stroke: '#cbd5e1', strokeDasharray: 3 }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Area type="monotone" dataKey="questoes" stroke="#6366f1" strokeWidth={1.8} fill="url(#evGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function AcessoRapido() {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Acesso rápido</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ACESSO_RAPIDO.map((a) => {
          const Icon = a.icon;
          const cls = TINT_CLASSES[a.tint] ?? TINT_CLASSES.slate;
          return (
            <Link
              key={a.nome}
              to={a.href}
              className={`${cardBase} px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow group`}
            >
              <div className={`w-9 h-9 rounded-lg ${cls} flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-slate-900 truncate">{a.nome}</p>
                <p className="text-[10.5px] text-slate-500 truncate">{a.sub}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DicaDoDia() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-2.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
        <Lightbulb className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Dica do dia</p>
        <p className="text-[12.5px] text-slate-700 truncate">
          Pequenas ações diárias, repetidas com consistência, geram grandes resultados.
        </p>
      </div>
      <button className="text-[11px] text-amber-700 hover:underline shrink-0 inline-flex items-center gap-0.5">
        Ver todas as dicas <ChevronRight className="w-3 h-3" />
      </button>
    </section>
  );
}

// ───────── Page ─────────

export default function HomePage() {
  return (
    <>
      <AuroraBackground />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Row 1 — Jornada + Revisões (60/40) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <JornadaSemana />
          </div>
          <div className="lg:col-span-2">
            <RevisoesInteligentes />
          </div>
        </div>

        {/* Row 2 — Desempenho + Consistência + Evolução */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <DesempenhoGeral />
          <ConsistenciaSemanal />
          <Evolucao />
        </div>

        {/* Row 3 — Acesso rápido */}
        <AcessoRapido />

        {/* Footer — Dica */}
        <DicaDoDia />
      </div>
    </>
  );
}

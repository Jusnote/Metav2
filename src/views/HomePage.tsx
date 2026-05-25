import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { CronogramaSheet } from '../components/CronogramaSheet';
import {
  Brain,
  TrendingUp,
  Target,
  BookOpen,
  Play,
  Calendar,
  FileText,
  Zap,
  Award,
  CircleHelp,
  Lightbulb,
  Scale,
  Sparkles,
  Star,
  Flame,
  Trophy,
  Crown,
  Rocket,
  Gem,
  Lock,
  ChevronLeft,
  ChevronRight,
  Medal,
  Heart,
  Crosshair
} from 'lucide-react';
import { SSRSafeNavLink } from '../components/SSRSafeNavLink';
import { AuroraBackground } from '../components/ui/aurora-background';
import { useAuth } from '../hooks/useAuth';

const ALL_MEDALS = [
  { icon: Star, title: 'Primeiros passos', desc: 'Complete 5 questões', unlocked: true, progress: 1 },
  { icon: Target, title: 'Foco inicial', desc: 'Complete 10 questões', unlocked: true, progress: 1 },
  { icon: Flame, title: 'Sequência iniciante', desc: 'Estude 3 semanas seguidas', unlocked: true, progress: 0.55 },
  { icon: BookOpen, title: 'Estudioso', desc: 'Complete 25 questões', unlocked: false },
  { icon: Brain, title: 'Mente ativa', desc: 'Complete 50 questões', unlocked: false },
  { icon: Zap, title: 'Ritmo constante', desc: 'Estude 5 semanas seguidas', unlocked: false },
  { icon: Medal, title: 'Disciplina', desc: 'Estude 10 semanas seguidas', unlocked: false },
  { icon: Heart, title: 'Dedicado', desc: 'Complete 100 questões', unlocked: false },
  { icon: Crosshair, title: 'Foco máximo', desc: 'Complete 200 questões', unlocked: false },
  { icon: TrendingUp, title: 'Sequência avançada', desc: 'Estude 15 semanas seguidas', unlocked: false },
  { icon: Trophy, title: 'Mestre dos estudos', desc: 'Complete 500 questões', unlocked: false },
  { icon: Crown, title: 'Lenda do saber', desc: 'Complete 1000 questões', unlocked: false },
  { icon: Rocket, title: 'Imbatível', desc: 'Acertar 90% ou mais em 50 revisões', unlocked: false },
  { icon: Gem, title: 'Perfeccionista', desc: 'Acertar 100% em 10 revisões', unlocked: false },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const [medalPage, setMedalPage] = useState(0);
  const [medalsModalOpen, setMedalsModalOpen] = useState(false);
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  return (
    <>
    <AuroraBackground />
    <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="pt-2 pb-1 flex items-end justify-between gap-4">
          <div>
            <h1
              className="m-0 leading-none"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: '32px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Olá
              {userName && (
                <>
                  ,{' '}
                  <span style={{ color: '#2563eb' }}>{userName}</span>
                </>
              )}
              <span style={{ color: '#2563eb' }}>.</span>
              <Sparkles
                className="inline-block ml-2 align-middle text-blue-500/70"
                style={{ width: 18, height: 18, marginTop: -4 }}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </h1>
            <p
              className="mt-2 text-[13px] text-slate-500"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontStyle: 'italic' }}
            >
              Bem vindo ao Papiro, seu ecossistema de estudo.
            </p>
          </div>

          <div
            className="shrink-0 rounded-xl px-4 py-3 text-slate-100"
            style={{
              background: 'linear-gradient(160deg, #1a1f3a 0%, #131a30 35%, #0f172a 100%)',
              border: '1px solid rgba(99,102,241,0.18)',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.02) inset, 0 12px 32px -20px rgba(79,70,229,0.35), 0 4px 14px -8px rgba(15,23,42,0.4)',
              minWidth: '340px',
            }}
          >
            <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-slate-400">
              Sua evolução
            </div>
            <div className="mt-2 flex items-center gap-5">
              <div className="shrink-0 flex items-start gap-2">
                <Flame className="h-6 w-6 text-slate-300/90 shrink-0" strokeWidth={1.5} />
                <div>
                  <div className="text-xl font-bold text-slate-100 leading-none tabular-nums">14</div>
                  <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                    semanas
                    <br />
                    em sequência
                  </div>
                </div>
              </div>
              <div className="h-12 w-px bg-slate-700/60 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <span>Nível 12</span>
                  <span className="text-slate-500">→</span>
                  <span>Nível 13</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(820 / 1500) * 100}%`,
                      background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)',
                      boxShadow: '0 0 8px rgba(96,165,250,0.55)',
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  <span className="tabular-nums">
                    <span className="text-blue-400 font-semibold">820</span>
                    <span className="text-slate-500"> / 1.500 XP</span>
                  </span>
                  <span className="text-slate-500">680 XP p/ próximo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border border-slate-200/70 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12),0_2px_6px_-2px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-500">
              Desempenho geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              {(() => {
                const pct = 72;
                const r = 36;
                const c = Math.PI * r;
                return (
                  <div className="relative w-[90px] h-[52px] shrink-0">
                    <svg viewBox="0 0 90 52" className="w-full h-full">
                      <path
                        d={`M 9 45 A ${r} ${r} 0 0 1 81 45`}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      <path
                        d={`M 9 45 A ${r} ${r} 0 0 1 81 45`}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - pct / 100)}
                      />
                    </svg>
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
                      <div className="text-sm font-bold text-slate-900 leading-none">{pct}%</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">Aproveitamento</div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-3 min-w-0">
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-600 leading-none">↑ 8%</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                    nos últimos
                    <br />
                    14 dias
                  </div>
                </div>
                <svg viewBox="0 0 60 32" className="w-[60px] h-8 shrink-0">
                  <polyline
                    points="2,26 10,22 18,24 26,18 34,20 42,12 50,14 58,6"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="58" cy="6" r="2" fill="#4f46e5" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/70 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12),0_2px_6px_-2px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-500">
              Evolução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Questões resolvidas', value: '1.248', delta: '↑ 18%' },
                { label: 'Horas estudadas', value: '18h 40m', delta: '↑ 12%' },
              ].map((m) => (
                <div key={m.label}>
                  <div className="text-[10px] text-slate-500">{m.label}</div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900 leading-none">{m.value}</span>
                    <span className="text-[11px] font-semibold text-emerald-600 leading-none">{m.delta}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">vs semana passada</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/70 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12),0_2px_6px_-2px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-500">
              Disciplinas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div className="text-[10px] font-medium text-slate-500">Melhores disciplinas</div>
              <div className="text-[10px] font-medium text-slate-500">Piores disciplinas</div>

              {[
                { name: 'Constitucional', pct: 78, color: '#059669' },
                { name: 'Português', pct: 58, color: '#dc2626' },
                { name: 'Administrativo', pct: 74, color: '#059669' },
                { name: 'RLM', pct: 52, color: '#dc2626' },
              ].map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-700 truncate">{d.name}</span>
                  </div>
                  <span className="tabular-nums font-medium" style={{ color: d.color }}>
                    {d.pct}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Row — 2 cards, 50% cada */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="md:order-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Deck "Vocabulário Inglês" atualizado</p>
                  <p className="text-xs text-muted-foreground">2 horas atrás</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sessão de estudo concluída</p>
                  <p className="text-xs text-muted-foreground">5 horas atrás</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-warning rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">25 cards para revisar</p>
                  <p className="text-xs text-muted-foreground">1 dia atrás</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:order-1 flex flex-col gap-4">
        <Card
          className="relative overflow-hidden text-slate-100"
          style={{
            background:
              'linear-gradient(160deg, #1a1f3a 0%, #131a30 35%, #0f172a 100%)',
            border: '1px solid rgba(99,102,241,0.18)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.02) inset, 0 18px 40px -20px rgba(79,70,229,0.35), 0 6px 18px -8px rgba(15,23,42,0.5)',
          }}
        >
          <CardHeader className="pt-5 px-6 pb-3 space-y-0">
            <CardTitle
              className="text-slate-50 flex items-center gap-2.5"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: '19px',
                fontWeight: 600,
                letterSpacing: '-0.018em',
                lineHeight: 1.15,
              }}
            >
              <Medal
                className="h-[19px] w-[19px] shrink-0"
                strokeWidth={1.4}
                style={{
                  color: '#e6c067',
                  filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.5))',
                }}
                aria-hidden="true"
              />
              Quadro de conquistas
            </CardTitle>
            <p
              className="text-slate-500 pl-[27px]"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '12.5px',
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: '0.005em',
              }}
            >
              Medalhas que marcam seu progresso.
            </p>
          </CardHeader>
          <CardContent className="px-6 pt-0 pb-8">
            {/* Medalhas grid */}
            {(() => {
              const medals = ALL_MEDALS;
              const pageSize = 5;
              const totalPages = Math.ceil(medals.length / pageSize);
              const start = medalPage * pageSize;
              const visible = medals.slice(start, start + pageSize);
              return (
                <>
                <div className="mt-7 -mx-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMedalPage((p) => Math.max(0, p - 1))}
                    disabled={medalPage === 0}
                    className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <div className="flex-1 grid grid-cols-5 gap-2">
                  {visible.map((m, idx) => {
                    const i = start + idx;
                    const Icon = m.icon;
                    return (
                      <Tooltip key={i}>
                      <TooltipTrigger asChild>
                      <div
                        className="flex flex-col items-center text-center rounded-xl px-4 pt-3 pb-3 border border-slate-700/40 cursor-default"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.45) 100%)',
                        }}
                      >
                        {/* Hexagon medal */}
                        <div className="relative">
                          <svg viewBox="0 0 64 64" className="h-16 w-16 overflow-visible">
                            <defs>
                              <radialGradient id={`hex-fill-${i}`} cx="50%" cy="35%" r="65%">
                                {m.unlocked ? (
                                  <>
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
                                    <stop offset="55%" stopColor="#1e3a8a" stopOpacity="0.7" />
                                    <stop offset="100%" stopColor="#0c1838" stopOpacity="0.95" />
                                  </>
                                ) : (
                                  <>
                                    <stop offset="0%" stopColor="#475569" stopOpacity="0.35" />
                                    <stop offset="60%" stopColor="#1e293b" stopOpacity="0.55" />
                                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.7" />
                                  </>
                                )}
                              </radialGradient>
                              <linearGradient id={`hex-stroke-${i}`} x1="0" y1="0" x2="0" y2="1">
                                {m.unlocked ? (
                                  <>
                                    <stop offset="0%" stopColor="#93c5fd" />
                                    <stop offset="100%" stopColor="#1d4ed8" />
                                  </>
                                ) : (
                                  <>
                                    <stop offset="0%" stopColor="#64748b" />
                                    <stop offset="100%" stopColor="#334155" />
                                  </>
                                )}
                              </linearGradient>
                              <linearGradient id={`hex-shine-${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            {/* Outer glow for unlocked */}
                            {m.unlocked && (
                              <polygon
                                points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
                                fill="none"
                                stroke="#60a5fa"
                                strokeWidth="0.6"
                                opacity="0.5"
                                style={{ filter: 'blur(2px)' }}
                              />
                            )}

                            {/* Outer hexagon */}
                            <polygon
                              points="32,4 56,18 56,46 32,60 8,46 8,18"
                              fill={`url(#hex-fill-${i})`}
                              stroke={`url(#hex-stroke-${i})`}
                              strokeWidth="1.4"
                              strokeLinejoin="round"
                              style={
                                m.unlocked
                                  ? { filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.45))' }
                                  : undefined
                              }
                            />

                            {/* Inner hexagon (bevel) */}
                            <polygon
                              points="32,10 50.5,21 50.5,43 32,54 13.5,43 13.5,21"
                              fill="none"
                              stroke={m.unlocked ? '#bfdbfe' : '#475569'}
                              strokeWidth="0.6"
                              opacity={m.unlocked ? 0.55 : 0.4}
                              strokeLinejoin="round"
                            />

                            {/* Top shine */}
                            <polygon
                              points="32,5 55,18.3 50.5,21 32,10 13.5,21 9,18.3"
                              fill={`url(#hex-shine-${i})`}
                              opacity={m.unlocked ? 0.7 : 0.3}
                            />
                          </svg>

                          <Icon
                            className="absolute inset-0 m-auto h-[20px] w-[20px]"
                            strokeWidth={1.25}
                            style={{
                              color: m.unlocked ? '#eff6ff' : '#94a3b8',
                              filter: m.unlocked
                                ? 'drop-shadow(0 0 3px rgba(191,219,254,0.45))'
                                : undefined,
                            }}
                          />
                          {!m.unlocked && (
                            <div className="absolute -top-0.5 -right-0.5 rounded-full bg-slate-800 ring-1 ring-slate-700 p-0.5">
                              <Lock className="h-2.5 w-2.5 text-slate-400" strokeWidth={2.2} />
                            </div>
                          )}
                        </div>

                        {/* Progress hairline */}
                        {m.unlocked ? (
                          <div className="mt-2.5 w-full h-px rounded-full bg-slate-700/40 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(m.progress ?? 0) * 100}%`,
                                background:
                                  'linear-gradient(90deg, rgba(96,165,250,0.5) 0%, rgba(147,197,253,0.85) 100%)',
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mt-2.5 w-full h-px rounded-full bg-slate-700/25" />
                        )}
                      </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-slate-900 text-slate-100 border border-slate-700">
                        <div className="font-semibold">{m.title}</div>
                        <div className="text-slate-400 text-[11px]">{m.desc}</div>
                      </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMedalPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={medalPage >= totalPages - 1}
                    className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                    aria-label="Próximo"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMedalPage(p)}
                      aria-label={`Página ${p + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        p === medalPage
                          ? 'w-5 bg-slate-300'
                          : 'w-1.5 bg-slate-600 hover:bg-slate-500'
                      }`}
                    />
                  ))}
                </div>
                </>
              );
            })()}
          </CardContent>
          <Dialog open={medalsModalOpen} onOpenChange={setMedalsModalOpen}>
            <div
              className="px-6 py-3 flex justify-end border-t"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Ver lista plana de medalhas →
                </button>
              </DialogTrigger>
            </div>
            <DialogContent
              className="max-w-4xl border-0 p-0 overflow-hidden text-slate-100"
              style={{
                background:
                  'linear-gradient(160deg, #1a1f3a 0%, #131a30 35%, #0f172a 100%)',
                boxShadow:
                  '0 18px 40px -20px rgba(79,70,229,0.35), 0 6px 18px -8px rgba(15,23,42,0.5)',
              }}
            >
              <DialogHeader className="px-7 pt-6 pb-3 space-y-0">
                <DialogTitle
                  className="text-slate-50 flex items-center gap-2.5"
                  style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontSize: '20px',
                    fontWeight: 600,
                    letterSpacing: '-0.018em',
                    lineHeight: 1.15,
                  }}
                >
                  <Medal
                    className="h-[20px] w-[20px] shrink-0"
                    strokeWidth={1.4}
                    style={{
                      color: '#e6c067',
                      filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.5))',
                    }}
                    aria-hidden="true"
                  />
                  Todas as medalhas
                </DialogTitle>
                <DialogDescription
                  className="text-slate-500 pl-[30px]"
                  style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontStyle: 'italic',
                    fontSize: '12.5px',
                    lineHeight: 1.45,
                    letterSpacing: '0.005em',
                  }}
                >
                  {ALL_MEDALS.filter((m) => m.unlocked).length} de {ALL_MEDALS.length} conquistadas.
                </DialogDescription>
              </DialogHeader>
              <div className="px-7 pb-7 pt-3 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-5 gap-3">
                  {ALL_MEDALS.map((m, i) => {
                    const Icon = m.icon;
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <div
                            className="flex flex-col items-center text-center rounded-xl px-3 pt-3 pb-3 border border-slate-700/40 cursor-default"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.45) 100%)',
                            }}
                          >
                            <div className="relative">
                              <svg viewBox="0 0 64 64" className="h-16 w-16 overflow-visible">
                                <defs>
                                  <radialGradient id={`mhex-fill-${i}`} cx="50%" cy="35%" r="65%">
                                    {m.unlocked ? (
                                      <>
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
                                        <stop offset="55%" stopColor="#1e3a8a" stopOpacity="0.7" />
                                        <stop offset="100%" stopColor="#0c1838" stopOpacity="0.95" />
                                      </>
                                    ) : (
                                      <>
                                        <stop offset="0%" stopColor="#475569" stopOpacity="0.35" />
                                        <stop offset="60%" stopColor="#1e293b" stopOpacity="0.55" />
                                        <stop offset="100%" stopColor="#0f172a" stopOpacity="0.7" />
                                      </>
                                    )}
                                  </radialGradient>
                                  <linearGradient id={`mhex-stroke-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    {m.unlocked ? (
                                      <>
                                        <stop offset="0%" stopColor="#93c5fd" />
                                        <stop offset="100%" stopColor="#1d4ed8" />
                                      </>
                                    ) : (
                                      <>
                                        <stop offset="0%" stopColor="#64748b" />
                                        <stop offset="100%" stopColor="#334155" />
                                      </>
                                    )}
                                  </linearGradient>
                                  <linearGradient id={`mhex-shine-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                  </linearGradient>
                                </defs>
                                {m.unlocked && (
                                  <polygon
                                    points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
                                    fill="none"
                                    stroke="#60a5fa"
                                    strokeWidth="0.6"
                                    opacity="0.5"
                                    style={{ filter: 'blur(2px)' }}
                                  />
                                )}
                                <polygon
                                  points="32,4 56,18 56,46 32,60 8,46 8,18"
                                  fill={`url(#mhex-fill-${i})`}
                                  stroke={`url(#mhex-stroke-${i})`}
                                  strokeWidth="1.4"
                                  strokeLinejoin="round"
                                  style={
                                    m.unlocked
                                      ? { filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.45))' }
                                      : undefined
                                  }
                                />
                                <polygon
                                  points="32,10 50.5,21 50.5,43 32,54 13.5,43 13.5,21"
                                  fill="none"
                                  stroke={m.unlocked ? '#bfdbfe' : '#475569'}
                                  strokeWidth="0.6"
                                  opacity={m.unlocked ? 0.55 : 0.4}
                                  strokeLinejoin="round"
                                />
                                <polygon
                                  points="32,5 55,18.3 50.5,21 32,10 13.5,21 9,18.3"
                                  fill={`url(#mhex-shine-${i})`}
                                  opacity={m.unlocked ? 0.7 : 0.3}
                                />
                              </svg>
                              <Icon
                                className="absolute inset-0 m-auto h-[20px] w-[20px]"
                                strokeWidth={1.25}
                                style={{
                                  color: m.unlocked ? '#eff6ff' : '#94a3b8',
                                  filter: m.unlocked
                                    ? 'drop-shadow(0 0 3px rgba(191,219,254,0.45))'
                                    : undefined,
                                }}
                              />
                              {!m.unlocked && (
                                <div className="absolute -top-0.5 -right-0.5 rounded-full bg-slate-800 ring-1 ring-slate-700 p-0.5">
                                  <Lock className="h-2.5 w-2.5 text-slate-400" strokeWidth={2.2} />
                                </div>
                              )}
                            </div>
                            <div
                              className={`mt-2 text-[11px] font-medium leading-tight ${
                                m.unlocked ? 'text-slate-100' : 'text-slate-400'
                              }`}
                            >
                              {m.title}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 leading-tight">
                              {m.desc}
                            </div>
                            {m.unlocked ? (
                              <div className="mt-2.5 w-full h-px rounded-full bg-slate-700/40 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(('progress' in m ? m.progress : 0) ?? 0) * 100}%`,
                                    background:
                                      'linear-gradient(90deg, rgba(96,165,250,0.5) 0%, rgba(147,197,253,0.85) 100%)',
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="mt-2.5 w-full h-px rounded-full bg-slate-700/25" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-slate-900 text-slate-100 border border-slate-700">
                          <div className="font-semibold">{m.title}</div>
                          <div className="text-slate-400 text-[11px]">{m.desc}</div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Acesso Rápido - Flashcards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Acesse sua plataforma de flashcards completa com todas as funcionalidades de estudo e criação de decks.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <SSRSafeNavLink to="/flashcards" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Abrir Flashcards
                </SSRSafeNavLink>
              </Button>
              <Button variant="outline" asChild>
                <SSRSafeNavLink to="/flashcards?mode=study">
                  <Target className="h-4 w-4 mr-2" />
                  Modo Estudo
                </SSRSafeNavLink>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Repetição Espaçada</Badge>
              <Badge variant="secondary">Multi-formato</Badge>
              <Badge variant="secondary">Estatísticas</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[320px] flex flex-col p-0 overflow-hidden border-0 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12),0_2px_6px_-2px_rgba(15,23,42,0.06)]">
          <div className="relative h-[45%] min-h-[144px] px-6 pt-3 pb-3 flex flex-col overflow-hidden">
            <img
              src="/mountain-journey.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-full w-auto object-contain object-right opacity-90 select-none scale-125 origin-right"
            />
            <div className="relative flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-slate-600">Meta</CardTitle>
              <span className="text-slate-300">|</span>
              <CardTitle className="text-sm font-medium text-slate-600">Últimos registros</CardTitle>
            </div>
            <div
              className="relative mt-3 inline-flex items-center gap-3 rounded-full px-4 py-2 border border-white/40"
              style={{
                background: 'rgba(255,255,255,0.28)',
                backdropFilter: 'blur(6px) saturate(120%)',
                WebkitBackdropFilter: 'blur(6px) saturate(120%)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 18px -14px rgba(15,23,42,0.15)',
              }}
            >
              {[
                { icon: Lightbulb, done: 1, total: 3, label: 'Teorias', color: '#d97706' },
                { icon: CircleHelp, done: 12, total: 50, label: 'Questões', color: '#2563eb' },
                { icon: Scale, done: 2, total: 4, label: 'Legislações', color: '#059669' },
                { icon: Brain, done: 5, total: 20, label: 'Flashcards', color: '#7c3aed' },
              ].map(({ icon: Icon, done, total, label, color }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-default">
                      <Icon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color }}
                        strokeWidth={2}
                      />
                      <span
                        className="text-[12px] tabular-nums leading-none"
                        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
                      >
                        <span className="font-semibold text-slate-900">{done}</span>
                        <span className="text-slate-400">/{total}</span>
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-900 text-slate-100 border border-slate-700">
                    {label}
                  </TooltipContent>
                </Tooltip>
              ))}

              <span className="h-4 w-px bg-slate-300/60 mx-0.5" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" strokeWidth={2} />
                    <span
                      className="text-[13px] tabular-nums leading-none"
                      style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
                    >
                      <span className="font-bold text-blue-700">3</span>
                      <span className="text-slate-400">/12</span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-900 text-slate-100 border border-slate-700">
                  Revisões — sua prioridade da semana
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex-1 px-6 pt-3 pb-4">
            <h3 className="text-sm font-medium text-slate-600">Progresso das atividades</h3>
            <ul className="mt-4 space-y-3">
              {[
                { icon: CircleHelp, label: 'Questões', sub: 'Estudo ativo', current: 1, total: 10, color: '#2563eb', tint: '#dbeafe' },
                { icon: Lightbulb, label: 'Teoria', sub: 'Estudo passivo', current: 3, total: 10, color: '#d97706', tint: '#fef3c7' },
                { icon: Scale, label: 'Legislação', sub: 'Estudo passivo', current: 4, total: 15, color: '#059669', tint: '#d1fae5' },
              ].map(({ icon: Icon, label, sub, current, total, color, tint }) => {
                const pct = (current / total) * 100;
                const r = 13;
                const c = 2 * Math.PI * r;
                return (
                  <li key={label} className="flex items-center gap-3">
                    <div className="relative h-8 w-8 shrink-0">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r={r} fill="none" stroke={tint} strokeWidth="2.5" />
                        <circle
                          cx="16"
                          cy="16"
                          r={r}
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={c}
                          strokeDashoffset={c * (1 - pct / 100)}
                        />
                      </svg>
                      <Icon
                        className="absolute inset-0 m-auto h-3.5 w-3.5"
                        style={{ color }}
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="text-sm text-slate-700 leading-tight">{label}</div>
                      {sub && <div className="text-[10px] text-slate-400 leading-tight">{sub}</div>}
                    </div>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: tint }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums w-14 text-right shrink-0">
                      {current} de {total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200/70 flex justify-end">
            <CronogramaSheet>
              <button
                type="button"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Acessar cronograma →
              </button>
            </CronogramaSheet>
          </div>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Calendário</h3>
                <p className="text-sm text-muted-foreground">Organize sua agenda de estudos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <FileText className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Projetos</h3>
                <p className="text-sm text-muted-foreground">Gerencie seus projetos de estudo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Award className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Conquistas</h3>
                <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}

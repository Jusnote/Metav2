import { useState } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import {
  Brain,
  TrendingUp,
  Target,
  BookOpen,
  Zap,
  Star,
  Flame,
  Trophy,
  Crown,
  Rocket,
  Gem,
  Lock,
  Medal,
  Heart,
  Crosshair,
} from 'lucide-react';
import { AuroraBackground } from '../components/ui/aurora-background';
import { useAuth } from '../hooks/useAuth';
import { HeroRow } from '../components/home/HeroRow';
import { ContinueCta } from '../components/home/ContinueCta';
import { ConstanciaCard } from '../components/home/ConstanciaCard';
import { PontosAtencao } from '../components/home/PontosAtencao';
import { StatsRow } from '../components/home/StatsRow';
import { MedalsBoard } from '../components/home/MedalsBoard';
import { AtividadeRecente } from '../components/home/AtividadeRecente';
import { SparklineCard } from '../components/home/SparklineCard';
import '../components/home/home.css';

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
  const [medalsModalOpen, setMedalsModalOpen] = useState(false);
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  return (
    <>
      <AuroraBackground />

      {/* Defs SVG compartilhadas do mock v4 (anel de XP + metais das medalhas) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60A5FA" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="gBronze" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E2C58F" />
            <stop offset="1" stopColor="#C49A52" />
          </linearGradient>
          <linearGradient id="gSilver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#C7D2DD" />
            <stop offset="1" stopColor="#8FA3B5" />
          </linearGradient>
          <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F2C231" />
            <stop offset="1" stopColor="#D98E04" />
          </linearGradient>
          <linearGradient id="gLock" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#EDF1F5" />
            <stop offset="1" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="gShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,.35)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Conteúdo da Home v4 — fileiras na ordem exata do mock */}
      <div className="home-v4">
        <HeroRow userName={userName} />
        <ContinueCta />
        <div className="grid12 r d3">
          <ConstanciaCard />
          <PontosAtencao />
        </div>
        <StatsRow />
        <div className="grid21 r d5">
          <MedalsBoard
            unlockedCount={ALL_MEDALS.filter((m) => m.unlocked).length}
            totalCount={ALL_MEDALS.length}
            onVerTodas={() => setMedalsModalOpen(true)}
          />
          <AtividadeRecente />
        </div>
        <SparklineCard />
      </div>

      {/* Dialog "Ver todas as medalhas" — preservado da Home anterior (reskin é follow-up) */}
      <Dialog open={medalsModalOpen} onOpenChange={setMedalsModalOpen}>
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
    </>
  );
}

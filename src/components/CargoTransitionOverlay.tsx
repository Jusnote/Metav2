'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Carreira } from '@/types/carreira';

interface CargoTransitionOverlayProps {
  cargo: Carreira | null | undefined;
  /** undefined = não está em transição. null = limpando cargo. Carreira = trocando. */
  active: boolean;
  onComplete: () => void;
}

const HOLD_MS = 1100;
const FADE_IN_MS = 450;
const FADE_OUT_MS = 500;

export function CargoTransitionOverlay({ cargo, active, onComplete }: CargoTransitionOverlayProps) {
  // Tempo total: fade-in (450ms) + hold (1100ms) + fade-out (500ms) ≈ 2050ms
  // O AnimatePresence cuida do fade-out via exit; aqui só agenda o "fim do hold"
  // pra disparar onComplete, que tira o componente do DOM e dispara o navigate.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onComplete, HOLD_MS + FADE_IN_MS);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  const hasCargo = !!cargo;
  const hasFoto = !!cargo?.foto_url;
  const titulo = cargo?.nome ?? 'Sem cargo selecionado';
  const subtitulo = hasCargo
    ? 'Adaptando seu ecossistema...'
    : 'Voltando ao modo aberto...';

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="cargo-transition"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: FADE_IN_MS / 1000, ease: [0.22, 1, 0.36, 1] },
          }}
          exit={{
            opacity: 0,
            transition: { duration: FADE_OUT_MS / 1000, ease: [0.22, 1, 0.36, 1] },
          }}
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(59,130,246,0.22) 0%, rgba(255,255,255,0.96) 45%, rgba(255,255,255,1) 100%)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="flex flex-col items-center gap-5 px-6"
          >
            {/* Card grande do cargo */}
            <div
              className="relative w-[140px] h-[140px] rounded-2xl overflow-hidden flex items-end justify-start"
              style={{
                background: hasFoto
                  ? '#1e3a5f'
                  : 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2a4365 100%)',
                boxShadow:
                  '0 20px 60px -10px rgba(30,58,138,0.35), 0 6px 20px -6px rgba(30,58,138,0.20), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {hasFoto && (
                <img
                  src={cargo!.foto_url!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {hasCargo && (
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: hasFoto
                      ? 'linear-gradient(180deg, rgba(15,23,42,0.05) 30%, rgba(15,23,42,0.85) 100%)'
                      : 'radial-gradient(circle at 30% 25%, rgba(96,165,250,0.22), transparent 55%), radial-gradient(circle at 75% 75%, rgba(167,139,250,0.16), transparent 55%)',
                  }}
                />
              )}
              {!hasCargo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/50 text-5xl font-serif font-bold">∅</span>
                </div>
              )}
              {/* Pulsing ring */}
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-2xl border-2 border-blue-500/60 pointer-events-none"
                animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              />
            </div>

            {/* Texto */}
            <div className="flex flex-col items-center gap-1 max-w-[420px] text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                {subtitulo}
              </span>
              <h2
                className="m-0 text-[26px] font-semibold leading-tight"
                style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                }}
              >
                {titulo}
                <span style={{ color: '#2563eb' }}>.</span>
              </h2>
            </div>

            {/* Indicador de progresso minimalista */}
            <motion.div
              className="h-[2px] w-[120px] bg-blue-100 rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                className="h-full bg-blue-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: (HOLD_MS + FADE_IN_MS) / 1000, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

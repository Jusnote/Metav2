'use client';

import { useEffect } from 'react';
import {
  CargoSelectorCard,
  CargoSelectorExpansion,
  useCargoSelectorState,
} from '@/components/CargoSelector';
import { useCargoAtivo } from '@/hooks/useCargoAtivo';
import type { Carreira } from '@/types/carreira';

export interface CargoStepProps {
  onPicked: (cargo: Carreira) => void;
}

/**
 * Step 0 — Seleção de cargo.
 *
 * Reusa CargoSelectorCard + CargoSelectorExpansion da navbar.
 * Ao montar, se cargo já está ativo (via useCargoAtivo), dispara
 * onPicked imediatamente para que o setup page pule o step.
 *
 * UX: abre o panel de expansão automaticamente se não há cargo ativo.
 */
export function CargoStep({ onPicked }: CargoStepProps) {
  const state = useCargoSelectorState();
  const { cargo } = useCargoAtivo();

  // Se cargo já estava ativo, propaga imediatamente
  useEffect(() => {
    if (cargo) onPicked(cargo);
  }, [cargo, onPicked]);

  // Abre o expansion panel automaticamente se não há cargo
  useEffect(() => {
    if (!cargo) {
      state.setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-2xl">
      {/* Mostra o card atual (se houver cargo) como contexto */}
      <div className="mb-4">
        <CargoSelectorCard state={state} />
      </div>

      {/* Panel de expansão inline — ocupa espaço no fluxo do wizard */}
      <div
        className="rounded-2xl overflow-hidden border border-slate-700/50"
        style={{ background: 'rgba(15,23,42,0.6)' }}
      >
        <CargoSelectorExpansion
          state={state}
          onAfterApply={() => {
            // useCargoAtivo já atualizou; o useEffect acima vai disparar
          }}
        />
      </div>

      {!cargo && (
        <p className="mt-4 text-[12px] text-slate-500">
          Selecione uma carreira acima para continuar.
        </p>
      )}
    </div>
  );
}

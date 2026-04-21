// src/hooks/useFocoObjetivo.ts
'use client';

import { useCallback, useState } from 'react';

const MAX_FOCOS = 3;

/**
 * Estado dos focos ativos. Até 3 carreiras simultâneas; o 4º clique
 * desativa o foco mais antigo (FIFO) e ativa o novo.
 *
 * Fase 1A: estado em memória apenas (não persiste entre navegações).
 * Página abre sempre com nenhum foco ativo (card TODAS selecionado).
 */
export function useFocoObjetivo() {
  const [focos, setFocos] = useState<string[]>([]);

  const toggleFoco = useCallback((carreiraId: string) => {
    setFocos((prev) => {
      if (prev.includes(carreiraId)) {
        return prev.filter((id) => id !== carreiraId);
      }
      if (prev.length >= MAX_FOCOS) {
        return [...prev.slice(1), carreiraId];
      }
      return [...prev, carreiraId];
    });
  }, []);

  const clearFocos = useCallback(() => setFocos([]), []);

  const isActive = useCallback(
    (carreiraId: string) => focos.includes(carreiraId),
    [focos],
  );

  return {
    focos,
    toggleFoco,
    clearFocos,
    isActive,
    hasAnyFoco: focos.length > 0,
  };
}

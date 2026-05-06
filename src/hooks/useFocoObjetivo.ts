// src/hooks/useFocoObjetivo.ts
'use client';

import { useCallback, useEffect, useState } from 'react';

const MAX_FOCOS = 3;
const STORAGE_KEY = 'questoes_focos_v1';

function loadFocos(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveFocos(focos: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(focos));
  } catch {
    // sessionStorage cheio — ignora
  }
}

/**
 * Estado dos focos ativos. Até 3 carreiras simultâneas; o 4º clique
 * desativa o foco mais antigo (FIFO) e ativa o novo.
 *
 * Persiste em sessionStorage pra sobreviver a unmount/remount entre
 * tabs Filtros↔Questões (ObjetivoSection só monta na aba Filtros).
 */
export function useFocoObjetivo() {
  const [focos, setFocos] = useState<string[]>(loadFocos);

  useEffect(() => {
    saveFocos(focos);
  }, [focos]);

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

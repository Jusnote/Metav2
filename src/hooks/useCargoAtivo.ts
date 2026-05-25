'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Carreira } from '@/types/carreira';

const STORAGE_KEY = 'papiro:cargoAtivo';

/**
 * Cargo (carreira) ativo no ecossistema. Armazenado em localStorage por
 * enquanto — quando integrarmos com Supabase user_metadata, só o getter/setter
 * mudam. Componentes consumidores não mudam.
 *
 * NÃO afeta (ainda) o filtro global de questões/lei seca/etc — apenas é
 * exibido na navbar. A integração com filtragem global é fase 2.
 */
export function useCargoAtivo() {
  const [cargo, setCargoState] = useState<Carreira | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hidrata do localStorage no mount (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setCargoState(JSON.parse(raw) as Carreira);
      }
    } catch {
      // localStorage indisponível ou JSON inválido — ignora
    }
    setHydrated(true);
  }, []);

  // Sync entre tabs do mesmo browser
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setCargoState(e.newValue ? (JSON.parse(e.newValue) as Carreira) : null);
      } catch {
        setCargoState(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCargo = useCallback((next: Carreira | null) => {
    setCargoState(next);
    if (typeof window !== 'undefined') {
      try {
        if (next) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  return { cargo, setCargo, hydrated };
}

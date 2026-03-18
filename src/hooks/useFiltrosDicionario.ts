/**
 * Hook: useFiltrosDicionario
 *
 * Carrega o dicionario de filtros da API e cacheia no localStorage (24h).
 * Retorna mapas alias->canonical para bancas, orgaos, cargos.
 *
 * Destino no projeto: hooks/useFiltrosDicionario.ts
 */
import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.projetopapiro.com.br';
const CACHE_KEY = 'filtros_dicionario';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h em ms

export interface FiltrosDicionario {
  bancas: Record<string, string>;   // alias lowercase -> canonical
  orgaos: Record<string, string>;
  cargos: Record<string, string>;
  materias: string[];
  assuntos: string[];
  materia_assuntos: Record<string, string[]>;
  anos: { min: number; max: number };
}

interface CacheEntry {
  data: FiltrosDicionario;
  timestamp: number;
}

function loadFromCache(): FiltrosDicionario | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function saveToCache(data: FiltrosDicionario): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage cheio ou indisponivel — ignora
  }
}

export function useFiltrosDicionario() {
  const [dicionario, setDicionario] = useState<FiltrosDicionario | null>(
    () => loadFromCache()
  );
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Se ja tem cache valido ou ja buscou, nao busca de novo
    if (dicionario || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchDicionario = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/v1/filtros/dicionario`, {
          headers: { 'accept': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: FiltrosDicionario = await response.json();
        saveToCache(data);
        setDicionario(data);
      } catch (err) {
        console.error('Erro ao carregar dicionario de filtros:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDicionario();
  }, [dicionario]);

  return { dicionario, loading };
}

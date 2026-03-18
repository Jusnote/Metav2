'use client';

/**
 * SearchFilterTag — Componente visual para chips de filtro na SearchBar.
 * Usado inline na SmartSearchBarPlate como componente React puro.
 * Reservado: futura integração como Plate void element.
 */

import { cn } from '@/lib/utils';

export type FilterType = 'banca' | 'ano' | 'orgao' | 'cargo' | 'materia' | 'assunto';

const FILTER_TAG_STYLES: Record<FilterType, { bg: string; text: string; border: string; icon: string }> = {
  banca:   { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', icon: '🏛️' },
  ano:     { bg: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-700 dark:text-orange-300',   border: 'border-orange-200 dark:border-orange-800',   icon: '📅' },
  orgao:   { bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-300',       border: 'border-blue-200 dark:border-blue-800',       icon: '🏢' },
  cargo:   { bg: 'bg-purple-100 dark:bg-purple-900/40',   text: 'text-purple-700 dark:text-purple-300',   border: 'border-purple-200 dark:border-purple-800',   icon: '👤' },
  materia: { bg: 'bg-teal-100 dark:bg-teal-900/40',       text: 'text-teal-700 dark:text-teal-300',       border: 'border-teal-200 dark:border-teal-800',       icon: '📚' },
  assunto: { bg: 'bg-indigo-100 dark:bg-indigo-900/40',   text: 'text-indigo-700 dark:text-indigo-300',   border: 'border-indigo-200 dark:border-indigo-800',   icon: '📝' },
};

export { FILTER_TAG_STYLES };

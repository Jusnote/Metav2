'use client';

import React from 'react';
import { SingleLinePlugin } from 'platejs';
import { SlashInputPlugin, SlashPlugin } from '@platejs/slash-command/react';

import { SearchSlashInputElement } from '@/components/ui/search-slash-node';

// ---------------------------------------------------------------------------
// Filter types & context (compartilhado entre SmartSearchBarPlate e slash-node)
// ---------------------------------------------------------------------------
export type FilterType = 'banca' | 'ano' | 'orgao' | 'cargo' | 'materia' | 'assunto';

export interface FilterChip {
  type: FilterType;
  value: string;
}

export interface SearchFiltersContextValue {
  filters: FilterChip[];
  addFilter: (type: FilterType, value: string) => void;
  removeFilter: (type: FilterType, value: string) => void;
}

export const SearchFiltersContext = React.createContext<SearchFiltersContextValue | null>(null);

// ---------------------------------------------------------------------------
// Kit para o editor de busca (sem inline filter nodes — chips ficam abaixo)
// ---------------------------------------------------------------------------
export const SearchFilterKit = [
  SingleLinePlugin,
  SlashPlugin,
  SlashInputPlugin.withComponent(SearchSlashInputElement),
];

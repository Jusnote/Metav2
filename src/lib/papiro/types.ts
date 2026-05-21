/**
 * PAPIRO — tipos derivados manuais.
 *
 * Tipos brutos das tabelas são gerados por `npm run papiro:types`
 * em src/types/database.papiro.ts. Aqui re-exportamos com nomes ergonômicos
 * + definimos composições usadas como retorno dos hooks.
 */

import type { Database } from '@/types/database.papiro';

// --- Re-exports ergonômicos ---
export type PapiroDisciplina = Database['papiro']['Tables']['disciplina']['Row'];
export type PapiroMacroArea = Database['papiro']['Tables']['macro_area']['Row'];
export type PapiroTema = Database['papiro']['Tables']['tema']['Row'];
export type PapiroResumo = Database['papiro']['Tables']['resumo']['Row'];
export type PapiroTemaPrereq = Database['papiro']['Tables']['tema_prereq']['Row'];

export type StatusResumo = 'rascunho' | 'revisao' | 'publicado';

// --- Composições ---

export interface PapiroPrereqResolvido {
  slug_hierarquico: string;
  nome: string;
}

export interface PapiroTemaComStatus extends PapiroTema {
  temResumoPublicado: boolean;
  prereqs: PapiroPrereqResolvido[];
}

export interface PapiroStats {
  temasTotal: number;
  tempoTotalMin: number;
  temasDisponiveis: number;
}

// usePapiroDisciplinas() retorno
export interface PapiroDisciplinaResumo {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  stats: PapiroStats;
  macroAreasCount: number;
}
export interface PapiroDisciplinasData {
  disponiveis: PapiroDisciplinaResumo[];
  emProducao: PapiroDisciplinaResumo[];
}

// usePapiroDisciplina(slug) retorno
export interface PapiroMacroAreaResumo {
  id: string;
  nome: string;
  slug: string; // ex: "informatica.redes_internet"
  ordem: number;
  stats: PapiroStats;
}
export interface PapiroDisciplinaData {
  disciplina: PapiroDisciplina;
  macroAreasDisponiveis: PapiroMacroAreaResumo[];
  macroAreasEmProducao: PapiroMacroAreaResumo[];
}

// usePapiroTrilha(slug) retorno
export interface PapiroTrilhaData {
  id: string;
  slug: string;
  nome: string;
  disciplinaSlug: string;
  disciplinaNome: string;
  stats: PapiroStats;
  temas: PapiroTemaComStatus[];
}

// usePapiroTema(slug) retorno
export interface PapiroTemaSibling {
  slug_hierarquico: string;
  nome: string;
  ordem_curricular: number;
}
export interface PapiroTemaData {
  tema: PapiroTema;
  resumo: PapiroResumo | null;
  prev: PapiroTemaSibling | null;
  next: PapiroTemaSibling | null;
  prereqs: PapiroPrereqResolvido[];
  indice: { atual: number; total: number };
  macroAreaNome: string;
  macroAreaSlug: string;
  disciplinaNome: string;
  disciplinaSlug: string;
  macroAreaTail: string;
}
